// @vitest-environment node
// Serverless mode's queue and daily limit on a real Postgres (PGlite): the same contracts the
// local and BullMQ queues pass (packages/jobs/test), plus what only this queue has to handle:
// jobs whose function died, one extraction at a time, and cleanup after 24 hours.
import { describe, expect, it } from "vitest";
import { createPostgresQueue, createPostgresRateLimiter, STALE_MS } from "@/server/pg-jobs";
import { FakeRun, finished, queueContract } from "../../../../packages/jobs/test/contract";
import { rateLimitContract } from "../../../../packages/jobs/test/rate-limit-contract";
import { testDb } from "./pglite";

/** A queue on a fresh database. `schedule` starts work right away, as after() would later. */
async function harness(concurrency = 3) {
  const db = await testDb();
  const fake = new FakeRun();
  const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
  const running = new Set<Promise<void>>();
  const queue = createPostgresQueue({
    db,
    run: fake.run,
    now: () => clock.now,
    concurrency,
    schedule: (task) => {
      const work = task().finally(() => running.delete(work));
      running.add(work);
    },
  });
  return {
    db,
    queue,
    fake,
    clock,
    /** Every pump started so far has returned. */
    idle: async () => {
      while (running.size > 0) await Promise.all(running);
    },
    async close() {
      fake.release();
      while (running.size > 0) await Promise.all(running);
      await db.close();
    },
  };
}

queueContract("postgres", () => harness());

rateLimitContract("postgres", async (clock) => {
  const db = await testDb();
  return { limiter: createPostgresRateLimiter({ db, now: () => clock.now }), close: db.close };
});

describe("postgres queue (serverless mode)", () => {
  it("runs one extraction at a time by default; waiting jobs start as others finish", async () => {
    const db = await testDb();
    const fake = new FakeRun();
    const running = new Set<Promise<void>>();
    const queue = createPostgresQueue({
      db,
      run: fake.run,
      schedule: (task) => {
        const work = task().finally(() => running.delete(work));
        running.add(work);
      },
    });
    fake.hold();
    const jobs = await Promise.all(
      ["a", "b", "c"].map((host) => queue.submit(`https://${host}.example/`)),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fake.active).toBe(1);
    fake.release();
    for (const job of jobs) expect((await finished(queue, job.id)).status).toBe("done");
    expect(fake.maxActive).toBe(1);
    while (running.size > 0) await Promise.all(running);
    await db.close();
  });

  it("puts a job whose function died back in the queue, then fails it when out of attempts", async () => {
    const h = await harness(1);
    // A job left "running" by a function that stopped (no pump is working on it).
    await h.db.query(
      `INSERT INTO "extraction_jobs" ("id", "url", "status", "attempts", "created_at", "started_at")
       VALUES ('${"a".repeat(24)}', 'https://dead.example/', 'running', 1, $1, $1)`,
      [h.clock.now],
    );
    // Too recent to be dead: it still holds the only slot.
    const waiting = await h.queue.submit("https://north.example/");
    await h.idle();
    expect((await h.queue.get(waiting.id))?.status).toBe("queued");
    expect(h.fake.calls).toEqual([]);

    // Past STALE_MS: a status check recovers it (one attempt left) and the queue moves on.
    h.clock.now = new Date(h.clock.now.getTime() + STALE_MS + 1000);
    await h.queue.get(waiting.id);
    expect((await finished(h.queue, "a".repeat(24))).status).toBe("done");
    expect((await finished(h.queue, waiting.id)).status).toBe("done");

    // Out of attempts: failed, with a message saying so.
    await h.db.query(
      `INSERT INTO "extraction_jobs" ("id", "url", "status", "attempts", "created_at", "started_at")
       VALUES ('${"b".repeat(24)}', 'https://gone.example/', 'running', 2, $1, $2)`,
      [h.clock.now, new Date(h.clock.now.getTime() - STALE_MS - 1000)],
    );
    await h.queue.get("b".repeat(24));
    await h.idle();
    const failed = await h.queue.get("b".repeat(24));
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed?.error).toMatch(/stopped before it finished/);
    await h.close();
  });

  it("deletes jobs and their screenshots after 24 hours", async () => {
    const h = await harness();
    const job = await h.queue.submit("https://north.example/");
    await finished(h.queue, job.id);
    h.clock.now = new Date("2026-11-14T10:00:01.000Z");
    expect(await h.queue.get(job.id)).toBeNull();
    expect(await h.queue.screenshot(job.id)).toBeNull();
    await h.queue.submit("https://other.example/");
    const { rows } = await h.db.query<{ id: string }>(`SELECT "id" FROM "extraction_jobs"`);
    expect(rows.map((r) => r.id)).not.toContain(job.id);
    await h.close();
  });
});
