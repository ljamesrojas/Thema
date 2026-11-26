// Serverless mode (THEMA_EXTRACTION=serverless): extraction jobs and the daily limit in Postgres,
// so Thema runs on Vercel alone, with no Redis and no worker server. A job runs inside the web
// app's own function after the response (`schedule`: Next's after()), one at a time by default,
// and a status check starts the next one waiting. Same contracts as the local and BullMQ queues
// (test/server/pg-jobs.test.ts runs them on PGlite).
import {
  ANONYMOUS_DAILY_EXTRACTIONS,
  ATTEMPTS,
  cacheKey,
  CACHE_TTL_MS,
  errorMessage,
  isUnrecoverable,
  jobIdFor,
  nextUtcMidnight,
  utcDay,
  withoutScreenshot,
  type ExtractionQueue,
  type ExtractionResult,
  type ExtractionStage,
  type JobSnapshot,
  type JobStatus,
  type RateLimiter,
  type RunExtraction,
} from "@thema/jobs";
import type { Db } from "./db";

/**
 * A job still "running" after this long lost its function (Vercel stops one after 300 s): it goes
 * back in the queue, or fails when it has used its attempts.
 */
export const STALE_MS = 6 * 60 * 1000;
/** One run of the queue stops starting new jobs after this long, to end well inside 300 s. */
export const PUMP_BUDGET_MS = 120_000;
/** Advisory lock taken while claiming a job, so two functions can't both take the last slot. */
const CLAIM_LOCK = 7_158_001;
const STOPPED = "The extraction stopped before it finished. Add the site again to retry.";

interface Row {
  id: string;
  url: string;
  status: JobStatus;
  stage: ExtractionStage | null;
  result: ExtractionResult | null;
  error: string | null;
}

const COLUMNS = `"id", "url", "status", "stage", "result", "error"`;

function snapshotOf(row: Row): JobSnapshot {
  const snapshot: JobSnapshot = { id: row.id, url: row.url, status: row.status };
  if (row.status === "running" && row.stage) snapshot.stage = row.stage;
  if (row.status === "done" && row.result) snapshot.result = row.result;
  if (row.status === "failed" && row.error !== null) snapshot.error = row.error;
  return snapshot;
}

export interface PostgresQueueOptions {
  db: Db;
  run: RunExtraction;
  /** Runs work after the response: Next's after() on Vercel; tests start it right away. */
  schedule: (task: () => Promise<void>) => void;
  /** Extractions at once across every function (default 1: a Vercel function has 2 GB). */
  concurrency?: number;
  attempts?: number;
  now?: () => Date;
}

export function createPostgresQueue(options: PostgresQueueOptions): ExtractionQueue {
  const {
    db,
    run,
    schedule,
    concurrency = 1,
    attempts = ATTEMPTS,
    now = () => new Date(),
  } = options;
  const cutoff = () => new Date(now().getTime() - CACHE_TTL_MS);

  const load = async (id: string): Promise<Row | null> => {
    const { rows } = await db.query<Row>(
      `SELECT ${COLUMNS} FROM "extraction_jobs" WHERE "id" = $1 AND "created_at" > $2`,
      [id, cutoff()],
    );
    return rows[0] ?? null;
  };

  /** Take the oldest waiting job if a slot is free, under a lock; dead runs are cleared first. */
  const claim = () =>
    db.transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock($1)`, [CLAIM_LOCK]);
      const time = now();
      await tx.query(
        `UPDATE "extraction_jobs"
         SET "status" = CASE WHEN "attempts" >= $2 THEN 'failed' ELSE 'queued' END,
             "error" = CASE WHEN "attempts" >= $2 THEN $3 ELSE NULL END,
             "stage" = NULL
         WHERE "status" = 'running' AND "started_at" < $1`,
        [new Date(time.getTime() - STALE_MS), attempts, STOPPED],
      );
      const { rows: counted } = await tx.query<{ running: number }>(
        `SELECT count(*)::int AS "running" FROM "extraction_jobs" WHERE "status" = 'running'`,
      );
      if ((counted[0]?.running ?? 0) >= concurrency) return null;
      const { rows } = await tx.query<{ id: string; url: string; attempts: number }>(
        `UPDATE "extraction_jobs"
         SET "status" = 'running', "attempts" = "attempts" + 1, "started_at" = $1, "stage" = NULL
         WHERE "id" = (
           SELECT "id" FROM "extraction_jobs"
           WHERE "status" = 'queued' AND "created_at" > $2
           ORDER BY "created_at", "id" LIMIT 1
         )
         RETURNING "id", "url", "attempts"`,
        [time, cutoff()],
      );
      return rows[0] ?? null;
    });

  async function execute(job: { id: string; url: string; attempts: number }) {
    // Stages are written in order; a failed write only loses a progress label.
    let stages: Promise<unknown> = Promise.resolve();
    const onStage = (stage: ExtractionStage) => {
      stages = stages
        .then(() =>
          db.query(
            `UPDATE "extraction_jobs" SET "stage" = $2 WHERE "id" = $1 AND "status" = 'running'`,
            [job.id, stage],
          ),
        )
        .catch(() => undefined);
    };
    try {
      const output = await run(job.url, onStage);
      await stages;
      await db.query(
        `UPDATE "extraction_jobs"
         SET "status" = 'done', "stage" = NULL, "error" = NULL, "result" = $2::jsonb, "screenshot" = $3
         WHERE "id" = $1`,
        [job.id, JSON.stringify(withoutScreenshot(output)), Buffer.from(output.screenshot)],
      );
    } catch (error) {
      await stages;
      const final = isUnrecoverable(error) || job.attempts >= attempts;
      await db.query(
        `UPDATE "extraction_jobs" SET "status" = $2, "stage" = NULL, "error" = $3 WHERE "id" = $1`,
        [job.id, final ? "failed" : "queued", final ? errorMessage(error) : null],
      );
    }
  }

  /** Run waiting jobs while a slot is free, for at most PUMP_BUDGET_MS. */
  async function pump() {
    const started = performance.now();
    while (performance.now() - started < PUMP_BUDGET_MS) {
      const job = await claim();
      if (!job) return;
      await execute(job);
    }
  }

  const kick = () =>
    schedule(() =>
      pump().catch((error: unknown) => {
        console.error("Extraction queue:", error);
      }),
    );

  return {
    async find(url) {
      const row = await load(jobIdFor(cacheKey(url, now())));
      return row && row.status !== "failed" ? snapshotOf(row) : null;
    },
    async submit(url) {
      const id = jobIdFor(cacheKey(url, now()));
      await db.query(`DELETE FROM "extraction_jobs" WHERE "created_at" <= $1`, [cutoff()]);
      const existing = await load(id);
      if (existing && existing.status !== "failed") {
        if (existing.status !== "done") kick();
        return snapshotOf(existing);
      }
      if (existing) await db.query(`DELETE FROM "extraction_jobs" WHERE "id" = $1`, [id]);
      // A concurrent submit of the same URL inserts nothing and shares the job.
      await db.query(
        `INSERT INTO "extraction_jobs" ("id", "url", "status", "created_at")
         VALUES ($1, $2, 'queued', $3) ON CONFLICT ("id") DO NOTHING`,
        [id, url, now()],
      );
      kick();
      const row = await load(id);
      return row ? snapshotOf(row) : { id, url, status: "queued" };
    },
    async get(id) {
      const row = await load(id);
      // Waiting or possibly dead: a status check gives the queue a chance to move.
      if (row && (row.status === "queued" || row.status === "running")) kick();
      return row ? snapshotOf(row) : null;
    },
    async screenshot(id) {
      const { rows } = await db.query<{ screenshot: Uint8Array | null }>(
        `SELECT "screenshot" FROM "extraction_jobs"
         WHERE "id" = $1 AND "status" = 'done' AND "created_at" > $2`,
        [id, cutoff()],
      );
      const png = rows[0]?.screenshot;
      return png ? Uint8Array.from(png) : null;
    },
  };
}

/** The daily limit in Postgres: one row per client and UTC day, counted atomically. */
export function createPostgresRateLimiter(options: {
  db: Db;
  limit?: number;
  now?: () => Date;
}): RateLimiter {
  const { db, limit: defaultLimit = ANONYMOUS_DAILY_EXTRACTIONS, now = () => new Date() } = options;
  return {
    async consume(clientId, limit = defaultLimit) {
      const date = now();
      const day = utcDay(date);
      await db.query(`DELETE FROM "rate_limits" WHERE "day" < $1::date`, [day]);
      // Counts up only while under the limit, so a refused request doesn't count.
      const { rows } = await db.query<{ count: number }>(
        `INSERT INTO "rate_limits" ("key", "day", "count") VALUES ($1, $2::date, 1)
         ON CONFLICT ("key", "day") DO UPDATE SET "count" = "rate_limits"."count" + 1
         WHERE "rate_limits"."count" < $3
         RETURNING "count"`,
        [clientId, day, limit],
      );
      const used = rows[0]?.count;
      const allowed = used !== undefined && used <= limit;
      return {
        allowed,
        remaining: allowed ? limit - used : 0,
        resetAt: nextUtcMidnight(date),
      };
    },
  };
}
