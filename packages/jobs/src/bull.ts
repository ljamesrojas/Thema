// The hosted queue: BullMQ on Redis. The API side (createBullQueue) enqueues and reads jobs; a
// long-running worker process (startBullWorker, `pnpm --filter @thema/worker queue`) runs them.
// Same contract as the local queue: one job per URL + UTC day, 3 at a time, one retry.
import { readFileSync } from "node:fs";
import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import {
  ANONYMOUS_DAILY_EXTRACTIONS,
  ATTEMPTS,
  cacheKey,
  CACHE_TTL_MS,
  CONCURRENCY,
  errorMessage,
  isUnrecoverable,
  jobIdFor,
  nextUtcMidnight,
  utcDay,
  withoutScreenshot,
  type ExtractionQueue,
  type ExtractionResult,
  type JobSnapshot,
  type JobStatus,
  type RateLimiter,
  type RunExtraction,
} from "./index.js";

export const QUEUE_NAME = "thema-extract";

interface JobData {
  url: string;
}

/** A finished job's return value in Redis: JSON, so the PNG is base64. */
interface StoredOutput extends ExtractionResult {
  screenshot: string;
}

/**
 * The certificate authority that signed Thema's Redis TLS certificate (deploy/worker sets Redis
 * up with its own CA): REDIS_TLS_CA holds the PEM text (Vercel; literal "\n" escapes are
 * accepted, since some dashboards store one line), REDIS_TLS_CA_FILE a path to it (the worker
 * VM). Undefined when neither is set: then a `rediss://` URL trusts the usual public CAs.
 */
export function redisTlsCa(env: Record<string, string | undefined>): string | undefined {
  if (env.REDIS_TLS_CA) return env.REDIS_TLS_CA.replace(/\\n/g, "\n");
  if (env.REDIS_TLS_CA_FILE) return readFileSync(env.REDIS_TLS_CA_FILE, "utf8");
  return undefined;
}

/**
 * A Redis connection BullMQ can use (it needs `maxRetriesPerRequest: null` for workers). For a
 * `rediss://` URL, `ca` is the authority its certificate must chain to (see redisTlsCa).
 */
export function redisConnection(
  url: string,
  options: { ca?: string | undefined; lazyConnect?: boolean } = {},
): Redis {
  const tls = url.startsWith("rediss://") && options.ca ? { tls: { ca: options.ca } } : {};
  return new Redis(url, {
    maxRetriesPerRequest: null,
    ...tls,
    ...(options.lazyConnect ? { lazyConnect: true } : {}),
  });
}

const STATUS: Record<string, JobStatus> = {
  active: "running",
  completed: "done",
  failed: "failed",
};

async function snapshotOf(job: Job<JobData, StoredOutput>): Promise<JobSnapshot> {
  const status = STATUS[await job.getState()] ?? "queued";
  const snapshot: JobSnapshot = { id: job.id ?? "", url: job.data.url, status };
  const progress: unknown = job.progress;
  if (status === "running" && typeof progress === "object" && progress !== null) {
    const stage = (progress as { stage?: unknown }).stage;
    if (stage === "fetching" || stage === "reading" || stage === "naming") snapshot.stage = stage;
  }
  if (status === "done") {
    const { url, system, warnings, derived } = job.returnvalue;
    snapshot.result = { url, system, warnings, derived };
  }
  if (status === "failed") snapshot.error = errorMessage(job.failedReason);
  return snapshot;
}

export interface BullQueue extends ExtractionQueue {
  close(): Promise<void>;
}

export function createBullQueue(options: {
  connection: Redis;
  attempts?: number;
  /** First retry delay; doubles after that. */
  backoffMs?: number;
  now?: () => Date;
}): BullQueue {
  const { connection, attempts = ATTEMPTS, backoffMs = 5_000, now = () => new Date() } = options;
  const queue = new Queue<JobData, StoredOutput>(QUEUE_NAME, { connection });
  const ttlSeconds = CACHE_TTL_MS / 1000;

  const get = async (id: string) => {
    const job = await queue.getJob(id);
    return job ? snapshotOf(job) : null;
  };

  return {
    get,
    async find(url) {
      const snapshot = await get(jobIdFor(cacheKey(url, now())));
      return snapshot && snapshot.status !== "failed" ? snapshot : null;
    },
    async submit(url) {
      const id = jobIdFor(cacheKey(url, now()));
      const existing = await queue.getJob(id);
      if (existing) {
        const snapshot = await snapshotOf(existing);
        if (snapshot.status !== "failed") return snapshot;
        await existing.remove(); // failures aren't cached: try again
      }
      // Adding an id that already exists is a no-op in BullMQ, so concurrent submits share a job.
      const job = await queue.add(
        "extract",
        { url },
        {
          jobId: id,
          attempts,
          backoff: { type: "exponential", delay: backoffMs },
          removeOnComplete: { age: ttlSeconds },
          removeOnFail: { age: ttlSeconds },
        },
      );
      return snapshotOf(job);
    },
    async screenshot(id) {
      const job = await queue.getJob(id);
      if (!job || (await job.getState()) !== "completed") return null;
      return new Uint8Array(Buffer.from(job.returnvalue.screenshot, "base64"));
    },
    close: () => queue.close(),
  };
}

/** The worker process: runs queued extractions, 3 at a time. Blocked URLs fail without retry. */
export function startBullWorker(options: {
  connection: Redis;
  run: RunExtraction;
  concurrency?: number;
}): Worker<JobData, StoredOutput> {
  const { connection, run, concurrency = CONCURRENCY } = options;
  return new Worker<JobData, StoredOutput>(
    QUEUE_NAME,
    async (job) => {
      try {
        const output = await run(job.data.url, (stage) => {
          void job.updateProgress({ stage });
        });
        return {
          ...withoutScreenshot(output),
          screenshot: Buffer.from(output.screenshot).toString("base64"),
        };
      } catch (error) {
        if (isUnrecoverable(error)) throw new UnrecoverableError(errorMessage(error));
        throw error;
      }
    },
    { connection, concurrency },
  );
}

/** The daily limit in Redis: one counter per client and UTC day, expiring at midnight. */
export function createRedisRateLimiter(options: {
  connection: Redis;
  limit?: number;
  now?: () => Date;
}): RateLimiter {
  const {
    connection,
    limit: defaultLimit = ANONYMOUS_DAILY_EXTRACTIONS,
    now = () => new Date(),
  } = options;
  return {
    async consume(clientId, limit = defaultLimit) {
      const date = now();
      const resetAt = nextUtcMidnight(date);
      const key = `thema:rate:${clientId}:${utcDay(date)}`;
      const used = await connection.incr(key);
      if (used === 1) await connection.expireat(key, Math.ceil(resetAt.getTime() / 1000));
      if (used > limit) await connection.decr(key); // a refused request doesn't count
      const allowed = used <= limit;
      return { allowed, remaining: allowed ? limit - used : 0, resetAt };
    },
  };
}
