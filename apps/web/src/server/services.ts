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

export interface Services {
  queue: ExtractionQueue;
  limiter: RateLimiter;
  /** New extractions an anonymous client may start per UTC day. */
  dailyLimit: number;
  /** DNS for the SSRF guard. */
  lookup: Lookup;
  now: () => Date;
}

const systemLookup: Lookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/**
 * From the environment:
 * - REDIS_URL set: BullMQ + Redis (jobs run in `pnpm --filter @thema/worker queue`), Redis limiter.
 * - Otherwise: the in-memory queue, running the worker's extraction in this process (development).
 * - THEMA_DAILY_EXTRACTIONS overrides the anonymous daily limit (default 3, SPEC).
 */
async function fromEnvironment(): Promise<Services> {
  const now = () => new Date();
  const configured = Number(process.env.THEMA_DAILY_EXTRACTIONS);
  const dailyLimit =
    Number.isInteger(configured) && configured > 0 ? configured : ANONYMOUS_DAILY_EXTRACTIONS;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const bull = await import("@thema/jobs/bull");
    const connection = bull.redisConnection(redisUrl);
    return {
      queue: bull.createBullQueue({ connection, now }),
      limiter: bull.createRedisRateLimiter({ connection, limit: dailyLimit, now }),
      dailyLimit,
      lookup: systemLookup,
      now,
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
  };
}

// On globalThis, so the dev server's module reloads keep the same queue (and its jobs).
const KEY = Symbol.for("thema.services");
type Holder = { [KEY]?: Promise<Services> };

export function getServices(): Promise<Services> {
  const holder = globalThis as Holder;
  holder[KEY] ??= fromEnvironment();
  return holder[KEY];
}

/** Tests: use these services (undefined goes back to the environment's). */
export function setServices(services: Services | undefined): void {
  const holder = globalThis as Holder;
  if (services) holder[KEY] = Promise.resolve(services);
  else delete holder[KEY];
}
