// What the API routes depend on, in one place: the extraction queue, the rate limiter, DNS and
// the clock. Built once per server process from the environment; tests swap in fakes.
import { lookup as dnsLookup } from "node:dns/promises";
import {
  ANONYMOUS_DAILY_EXTRACTIONS,
  concurrencyFrom,
  createLocalQueue,
  createMemoryRateLimiter,
  type ExtractionQueue,
  type RateLimiter,
} from "@thema/jobs";
import type { Lookup } from "@thema/url-guard";
import type { Account, Provider } from "./auth";
import type { Pool } from "pg";
import type { Db } from "./db";
import type { ProjectStore } from "./project-store";
import {
  createMemoryStats,
  createPostgresStats,
  createRedisStats,
  recordSafely,
  type Stats,
} from "./stats";
import {
  createMemoryScreenshotStore,
  createR2ScreenshotStore,
  type ScreenshotStore,
} from "./screenshot-store";

/** Sign-in and saved projects; null when the server has no database or sign-in configured. */
export interface Accounts {
  projects: ProjectStore;
  /** The signed-in account for a request, or null. */
  session(request: Request): Promise<Account | null>;
  /** Better Auth's routes (/api/auth/*). */
  handler(request: Request): Promise<Response>;
  providers: Provider[];
  /** Delete the user, with their sessions and sign-in links (the database cascades). */
  deleteUser(userId: string): Promise<void>;
}

export interface Services {
  queue: ExtractionQueue;
  limiter: RateLimiter;
  /** New extractions an anonymous client may start per UTC day. */
  dailyLimit: number;
  /**
   * New extractions everyone together may start per UTC day (serverless mode, where they share
   * the host's free monthly CPU time). Undefined: no such limit.
   */
  dailyTotal?: number;
  /** DNS for the SSRF guard. */
  lookup: Lookup;
  now: () => Date;
  accounts: Accounts | null;
  /** Saved projects' screenshots, kept after the queue's 24 hours. */
  screenshots: ScreenshotStore;
  /** Anonymous daily totals (server/stats.ts). */
  stats: Stats;
}

const systemLookup: Lookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/** Where extractions run: a worker server (Redis), this app on Vercel (Postgres), or in-process. */
export type ExtractionMode = "redis" | "serverless" | "local";

export function extractionMode(env: Record<string, string | undefined>): ExtractionMode {
  if (env.REDIS_URL) return "redis";
  if (env.THEMA_EXTRACTION === "serverless") {
    if (!env.DATABASE_URL) throw new Error("THEMA_EXTRACTION=serverless needs DATABASE_URL.");
    return "serverless";
  }
  return "local";
}

/** Serverless mode's limit on new extractions per UTC day, for everyone together. */
export const DAILY_TOTAL = 20;

const positiveInteger = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

/**
 * From the environment:
 * - REDIS_URL set: BullMQ + Redis (jobs run in `pnpm --filter @thema/worker queue`), Redis limiter
 *   and daily totals.
 * - THEMA_EXTRACTION=serverless (needs DATABASE_URL): jobs, limits and totals in Postgres, and
 *   extractions run in this app's own function after the response (Vercel), one at a time
 *   (THEMA_CONCURRENCY), at most THEMA_DAILY_TOTAL (default 20) new ones a day for everyone.
 * - Otherwise: the in-memory queue, running the worker's extraction in this process (development).
 * - THEMA_DAILY_EXTRACTIONS overrides the anonymous daily limit (default 3, SPEC).
 * - DATABASE_URL + BETTER_AUTH_SECRET + a GitHub or Google client: accounts and saved projects.
 * - R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: screenshots in R2
 *   (otherwise in memory, so they last until the server restarts).
 */
async function fromEnvironment(): Promise<Services> {
  const env = process.env;
  const now = () => new Date();
  const mode = extractionMode(env);
  const database = env.DATABASE_URL ? await databaseFrom(env.DATABASE_URL) : null;
  const db = database?.db ?? null;
  const dailyLimit = positiveInteger(env.THEMA_DAILY_EXTRACTIONS, ANONYMOUS_DAILY_EXTRACTIONS);
  const common = { dailyLimit, lookup: systemLookup, now, screenshots: screenshotsFromEnv() };

  if (mode === "redis" && env.REDIS_URL) {
    const bull = await import("@thema/jobs/bull");
    const connection = bull.redisConnection(env.REDIS_URL, { ca: bull.redisTlsCa(env) });
    const stats = createRedisStats(connection, now);
    return {
      ...common,
      queue: bull.createBullQueue({ connection, now }),
      limiter: bull.createRedisRateLimiter({ connection, limit: dailyLimit, now }),
      stats,
      accounts: await accountsFromEnv(stats, database),
    };
  }

  if (mode === "serverless" && db) {
    const [
      { after },
      { createPostgresQueue, createPostgresRateLimiter },
      { launchServerlessChromium },
    ] = await Promise.all([import("next/server"), import("./pg-jobs"), import("./chromium")]);
    const stats = createPostgresStats(db, now);
    return {
      ...common,
      queue: createPostgresQueue({
        db,
        now,
        concurrency: env.THEMA_CONCURRENCY ? concurrencyFrom(env) : 1,
        run: async (url, onStage) =>
          (await import("@thema/worker/job")).runExtraction(url, {
            now,
            onStage,
            launch: launchServerlessChromium,
          }),
        // After the response, inside the same function (up to its maxDuration).
        schedule: (task) => after(task),
      }),
      limiter: createPostgresRateLimiter({ db, limit: dailyLimit, now }),
      dailyTotal: positiveInteger(env.THEMA_DAILY_TOTAL, DAILY_TOTAL),
      stats,
      accounts: await accountsFromEnv(stats, database),
    };
  }

  const stats = createMemoryStats(now);
  return {
    ...common,
    queue: createLocalQueue({
      // Imported on first use, so Playwright only loads when an extraction actually runs.
      run: async (url, onStage) =>
        (await import("@thema/worker/job")).runExtraction(url, { now, onStage }),
      now,
    }),
    limiter: createMemoryRateLimiter({ limit: dailyLimit, now }),
    stats,
    accounts: await accountsFromEnv(stats, database),
  };
}

/** One connection pool for everything that uses Postgres (Better Auth takes the pool itself). */
async function databaseFrom(url: string): Promise<{ pool: Pool; db: Db }> {
  const [{ default: pg }, { poolDb }] = await Promise.all([import("pg"), import("./db")]);
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { pool, db: poolDb(pool) };
}

async function accountsFromEnv(
  stats: Stats,
  database: { pool: Pool; db: Db } | null,
): Promise<Accounts | null> {
  const { authConfigFromEnv, createAuth, providersOf, sessionReader } = await import("./auth");
  const config = authConfigFromEnv(process.env);
  if (!config || !database) return null;
  const { pool, db } = database;
  const { createPostgresProjectStore } = await import("./project-store");
  const auth = createAuth(pool, config, {}, () => recordSafely(stats, "signup"));
  return {
    projects: createPostgresProjectStore(db),
    session: sessionReader(auth),
    handler: (request) => auth.handler(request),
    providers: providersOf(config),
    deleteUser: async (userId) => {
      await db.query(`DELETE FROM "user" WHERE "id" = $1`, [userId]);
    },
  };
}

function screenshotsFromEnv(): ScreenshotStore {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (R2_ACCOUNT_ID && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return createR2ScreenshotStore({
      accountId: R2_ACCOUNT_ID,
      bucket: R2_BUCKET,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    });
  }
  return createMemoryScreenshotStore();
}

// On globalThis, so the dev server's module reloads keep the same queue (and its jobs).
const KEY = Symbol.for("thema.services");
type Holder = { [KEY]?: Promise<Services> };

export function getServices(): Promise<Services> {
  const holder = globalThis as Holder;
  if (!holder[KEY]) {
    const pending = fromEnvironment();
    holder[KEY] = pending;
    // A failed start isn't kept: the next request tries again instead of repeating the error.
    pending.catch(() => {
      if (holder[KEY] === pending) delete holder[KEY];
    });
  }
  return holder[KEY];
}

/** Tests: use these services (undefined goes back to the environment's). */
export function setServices(services: Services | undefined): void {
  const holder = globalThis as Holder;
  if (services) holder[KEY] = Promise.resolve(services);
  else delete holder[KEY];
}
