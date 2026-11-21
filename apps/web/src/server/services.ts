// What the API routes depend on, in one place: the extraction queue, the rate limiter, DNS and
// the clock. Built once per server process from the environment; tests swap in fakes.
import { lookup as dnsLookup } from "node:dns/promises";
import {
  ANONYMOUS_DAILY_EXTRACTIONS,
  createLocalQueue,
  createMemoryRateLimiter,
  type ExtractionQueue,
  type RateLimiter,
} from "@thema/jobs";
import type { Lookup } from "@thema/url-guard";
import type { Account, Provider } from "./auth";
import type { ProjectStore } from "./project-store";
import { createMemoryStats, createRedisStats, recordSafely, type Stats } from "./stats";
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

/**
 * From the environment:
 * - REDIS_URL set: BullMQ + Redis (jobs run in `pnpm --filter @thema/worker queue`), Redis limiter.
 * - Otherwise: the in-memory queue, running the worker's extraction in this process (development).
 * - THEMA_DAILY_EXTRACTIONS overrides the anonymous daily limit (default 3, SPEC).
 * - DATABASE_URL + BETTER_AUTH_SECRET + a GitHub or Google client: accounts and saved projects.
 * - R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: screenshots in R2
 *   (otherwise in memory, so they last until the server restarts).
 * - Anonymous daily totals go to Redis with REDIS_URL, else to memory.
 */
async function fromEnvironment(): Promise<Services> {
  const now = () => new Date();
  const redisUrl = process.env.REDIS_URL;
  const bull = redisUrl ? await import("@thema/jobs/bull") : null;
  const connection =
    bull && redisUrl ? bull.redisConnection(redisUrl, { ca: bull.redisTlsCa(process.env) }) : null;
  const stats = connection ? createRedisStats(connection, now) : createMemoryStats(now);
  const shared = {
    accounts: await accountsFromEnv(stats),
    screenshots: screenshotsFromEnv(),
    stats,
  };
  const configured = Number(process.env.THEMA_DAILY_EXTRACTIONS);
  const dailyLimit =
    Number.isInteger(configured) && configured > 0 ? configured : ANONYMOUS_DAILY_EXTRACTIONS;
  if (bull && connection) {
    return {
      queue: bull.createBullQueue({ connection, now }),
      limiter: bull.createRedisRateLimiter({ connection, limit: dailyLimit, now }),
      dailyLimit,
      lookup: systemLookup,
      now,
      ...shared,
    };
  }
  return {
    queue: createLocalQueue({
      // Imported on first use, so Playwright only loads when an extraction actually runs.
      run: async (url, onStage) =>
        (await import("@thema/worker/job")).runExtraction(url, { now, onStage }),
      now,
    }),
    limiter: createMemoryRateLimiter({ limit: dailyLimit, now }),
    dailyLimit,
    lookup: systemLookup,
    now,
    ...shared,
  };
}

async function accountsFromEnv(stats: Stats): Promise<Accounts | null> {
  const { authConfigFromEnv, createAuth, providersOf, sessionReader } = await import("./auth");
  const config = authConfigFromEnv(process.env);
  if (!config || !process.env.DATABASE_URL) return null;
  const [{ default: pg }, { poolDb }, { createPostgresProjectStore }] = await Promise.all([
    import("pg"),
    import("./db"),
    import("./project-store"),
  ]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  const auth = createAuth(pool, config, {}, () => recordSafely(stats, "signup"));
  const db = poolDb(pool);
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
