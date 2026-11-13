// Extraction jobs behind one interface, so the API doesn't care where the browser runs: an
// in-memory queue for development (runs the worker's extraction in-process) and a BullMQ + Redis
// queue (./bull) for a hosted worker. Both cache by URL + UTC day and run 3 jobs at a time.
import { createHash } from "node:crypto";
import type { ExtractWarning, ThemaSystem } from "@thema/engine";
import { BlockedUrlError } from "@thema/url-guard";

/** What one extraction produces (the worker's extract → the engine's extractSystem). */
export interface ExtractionOutput {
  /** The page URL after redirects. */
  url: string;
  system: ThemaSystem;
  warnings: ExtractWarning[];
  /** Token paths filled by a fallback rule or default instead of measured. */
  derived: string[];
  /** Full-page PNG of the light pass. */
  screenshot: Uint8Array;
}

/** The result as a job reports it; the screenshot is fetched separately (it's large). */
export type ExtractionResult = Omit<ExtractionOutput, "screenshot">;

/** Runs one extraction. Passed in, so this package never imports the browser. */
export type RunExtraction = (url: string) => Promise<ExtractionOutput>;

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobSnapshot {
  /** Derived from URL + UTC day: the same URL on the same day is the same job. */
  id: string;
  url: string;
  status: JobStatus;
  result?: ExtractionResult;
  error?: string;
}

export interface ExtractionQueue {
  /** Today's job for this URL, unless there is none or it failed (failures aren't cached). */
  find(url: string): Promise<JobSnapshot | null>;
  /** Today's job for this URL, enqueueing a new one when there is none or it failed. */
  submit(url: string): Promise<JobSnapshot>;
  get(id: string): Promise<JobSnapshot | null>;
  /** The PNG of a finished job. */
  screenshot(id: string): Promise<Uint8Array | null>;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Results are kept this long (the cache is also keyed by day, so a new day re-extracts). */
export const CACHE_TTL_MS = DAY_MS;
/** Extractions running at once (SPEC: 3 at a time). */
export const CONCURRENCY = 3;
/** Tries per job: one retry for flaky pages. Blocked URLs are never retried. */
export const ATTEMPTS = 2;
/** Longest error message a job reports (browser errors can carry whole call logs). */
export const MAX_ERROR_LENGTH = 300;

/** "2026-11-13" for the UTC day of `date`. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The next UTC midnight after `date`: when a day's cache key and rate limit roll over. */
export function nextUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

/** Cache key: the URL without its fragment, plus the UTC day. */
export function cacheKey(url: string, now: Date): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return `${parsed.href}|${utcDay(now)}`;
}

/** The job id for a cache key: stable, URL-safe, and doesn't put the URL in paths. */
export function jobIdFor(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/** A failure retrying can't fix: the URL is blocked by the SSRF guard. */
export function isUnrecoverable(error: unknown): boolean {
  return (
    error instanceof BlockedUrlError || (error instanceof Error && error.name === "BlockedUrlError")
  );
}

/** The message a failed job reports. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split("\n")[0] ?? "";
  return firstLine.length > MAX_ERROR_LENGTH
    ? `${firstLine.slice(0, MAX_ERROR_LENGTH - 1)}…`
    : firstLine;
}

export function withoutScreenshot(output: ExtractionOutput): ExtractionResult {
  const { url, system, warnings, derived } = output;
  return { url, system, warnings, derived };
}

// --- In-memory queue (development) ----------------------------------------------------------

export interface LocalQueueOptions {
  run: RunExtraction;
  concurrency?: number;
  attempts?: number;
  now?: () => Date;
}

export interface LocalQueue extends ExtractionQueue {
  /** Resolves when the job has finished (done or failed). Tests and the dev server use it. */
  settled(id: string): Promise<void>;
}

interface Entry {
  snapshot: JobSnapshot;
  screenshot?: Uint8Array;
  createdAt: number;
  settled: Promise<void>;
  markSettled: () => void;
}

/** Runs extractions in this process, at most `concurrency` at a time. State lives in memory. */
export function createLocalQueue(options: LocalQueueOptions): LocalQueue {
  const { run, concurrency = CONCURRENCY, attempts = ATTEMPTS, now = () => new Date() } = options;
  const entries = new Map<string, Entry>();
  const waiting: string[] = [];
  let running = 0;

  const prune = () => {
    const cutoff = now().getTime() - CACHE_TTL_MS;
    for (const [id, entry] of entries) {
      if (entry.createdAt <= cutoff && entry.snapshot.status !== "running") entries.delete(id);
    }
  };
  const copy = (entry: Entry): JobSnapshot => ({ ...entry.snapshot });

  async function execute(entry: Entry) {
    running += 1;
    entry.snapshot.status = "running";
    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const output = await run(entry.snapshot.url);
          entry.snapshot = { ...entry.snapshot, status: "done", result: withoutScreenshot(output) };
          entry.screenshot = output.screenshot;
          return;
        } catch (error) {
          if (isUnrecoverable(error) || attempt === attempts) {
            entry.snapshot = { ...entry.snapshot, status: "failed", error: errorMessage(error) };
            return;
          }
        }
      }
    } finally {
      running -= 1;
      entry.markSettled();
      pump();
    }
  }

  function pump() {
    while (running < concurrency && waiting.length > 0) {
      const id = waiting.shift();
      const entry = id === undefined ? undefined : entries.get(id);
      if (entry) void execute(entry);
    }
  }

  const todays = (url: string) => {
    prune();
    const id = jobIdFor(cacheKey(url, now()));
    return { id, entry: entries.get(id) };
  };

  return {
    find(url) {
      const { entry } = todays(url);
      return Promise.resolve(entry && entry.snapshot.status !== "failed" ? copy(entry) : null);
    },
    submit(url) {
      const { id, entry: existing } = todays(url);
      if (existing && existing.snapshot.status !== "failed") return Promise.resolve(copy(existing));
      let markSettled = () => {};
      const settled = new Promise<void>((resolve) => {
        markSettled = resolve;
      });
      const entry: Entry = {
        snapshot: { id, url, status: "queued" },
        createdAt: now().getTime(),
        settled,
        markSettled,
      };
      entries.set(id, entry);
      waiting.push(id);
      pump();
      return Promise.resolve(copy(entry));
    },
    get(id) {
      prune();
      const entry = entries.get(id);
      return Promise.resolve(entry ? copy(entry) : null);
    },
    screenshot(id) {
      prune();
      return Promise.resolve(entries.get(id)?.screenshot ?? null);
    },
    settled(id) {
      return entries.get(id)?.settled ?? Promise.resolve();
    },
  };
}

// --- Rate limit ---------------------------------------------------------------------------

/** New extractions an anonymous user may start per UTC day (SPEC: 3). Cache hits are free. */
export const ANONYMOUS_DAILY_EXTRACTIONS = 3;

export interface RateDecision {
  allowed: boolean;
  /** Extractions left today after this one. */
  remaining: number;
  /** When the count resets (next UTC midnight). */
  resetAt: Date;
}

export interface RateLimiter {
  /** Count one extraction for this client, unless they're already at the limit. */
  consume(clientId: string): Promise<RateDecision>;
}

export function createMemoryRateLimiter(
  options: { limit?: number; now?: () => Date } = {},
): RateLimiter {
  const { limit = ANONYMOUS_DAILY_EXTRACTIONS, now = () => new Date() } = options;
  const counts = new Map<string, number>();
  return {
    consume(clientId) {
      const date = now();
      const day = utcDay(date);
      for (const key of counts.keys()) if (!key.endsWith(`|${day}`)) counts.delete(key);
      const key = `${clientId}|${day}`;
      const used = counts.get(key) ?? 0;
      const allowed = used < limit;
      if (allowed) counts.set(key, used + 1);
      return Promise.resolve({
        allowed,
        remaining: Math.max(0, limit - used - (allowed ? 1 : 0)),
        resetAt: nextUtcMidnight(date),
      });
    },
  };
}
