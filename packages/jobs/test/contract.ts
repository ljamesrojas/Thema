// The behaviour both queues must share. Run against the local queue always, and against BullMQ
// when REDIS_URL is set (test/bull.test.ts).
import { extractSystem, type StyleSample } from "@thema/engine";
import { BlockedUrlError } from "@thema/url-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import samples from "../../../fixtures/light-saas/samples.json";
import type {
  ExtractionOutput,
  ExtractionQueue,
  JobSnapshot,
  RunExtraction,
} from "../src/index.js";

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** A fake extraction result built from a recorded fixture through the real engine. */
export function fakeOutput(url: string): ExtractionOutput {
  const { system, warnings, derived } = extractSystem({
    samples: samples as StyleSample[],
    source: { url, borrowed: [], screenshot: "" },
    name: new URL(url).hostname,
    createdAt: "2026-11-13T00:00:00.000Z",
  });
  return { url, system, warnings, derived, screenshot: PNG };
}

/** A controllable stand-in for the worker's extraction. */
export class FakeRun {
  calls: string[] = [];
  active = 0;
  maxActive = 0;
  /** Errors to throw, in order, before succeeding. */
  failures: Error[] = [];
  private gate: Promise<void> | null = null;
  private openGate: () => void = () => {};

  hold() {
    this.gate = new Promise((resolve) => {
      this.openGate = resolve;
    });
  }

  release() {
    this.gate = null;
    this.openGate();
  }

  run: RunExtraction = async (url) => {
    this.calls.push(url);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      if (this.gate) await this.gate;
      const failure = this.failures.shift();
      if (failure) throw failure;
      return fakeOutput(url);
    } finally {
      this.active -= 1;
    }
  };
}

export interface Harness {
  queue: ExtractionQueue;
  fake: FakeRun;
  clock: { now: Date };
  close(): Promise<void>;
}

async function until(condition: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Polls until the job is done or failed. */
export async function finished(queue: ExtractionQueue, id: string): Promise<JobSnapshot> {
  let last: JobSnapshot | null = null;
  await until(async () => {
    last = await queue.get(id);
    return last?.status === "done" || last?.status === "failed";
  }, `job ${id}`);
  if (!last) throw new Error("unreachable");
  return last;
}

export function queueContract(name: string, makeHarness: () => Promise<Harness>) {
  describe(`${name}: queue contract`, () => {
    let h: Harness;
    beforeEach(async () => {
      h = await makeHarness();
    });
    afterEach(async () => {
      h.fake.release();
      await h.close();
    });

    it("runs a job and reports the result without the screenshot", async () => {
      const job = await h.queue.submit("https://north.example/");
      expect(["queued", "running"]).toContain(job.status);
      const done = await finished(h.queue, job.id);
      expect(done.status).toBe("done");
      expect(done.url).toBe("https://north.example/");
      expect(done.result?.system.meta.name).toBe("north.example");
      expect(done.result?.warnings).toContain("no-dark-theme");
      expect(done.result).not.toHaveProperty("screenshot");
      expect(await h.queue.screenshot(job.id)).toEqual(PNG);
    });

    it("caches by URL and UTC day: the same URL today is the same job, run once", async () => {
      const first = await h.queue.submit("https://north.example/");
      await finished(h.queue, first.id);
      const again = await h.queue.submit("https://north.example/#pricing");
      expect(again.id).toBe(first.id);
      expect(again.status).toBe("done");
      expect((await h.queue.find("https://north.example/"))?.id).toBe(first.id);
      expect(h.fake.calls).toHaveLength(1);

      const other = await h.queue.submit("https://north.example/?page=2");
      expect(other.id).not.toBe(first.id);
      await finished(h.queue, other.id);
    });

    it("starts a new job on the next UTC day", async () => {
      h.clock.now = new Date("2026-11-13T23:59:00.000Z");
      const today = await h.queue.submit("https://north.example/");
      await finished(h.queue, today.id);
      h.clock.now = new Date("2026-11-14T00:01:00.000Z");
      expect(await h.queue.find("https://north.example/")).toBeNull();
      const tomorrow = await h.queue.submit("https://north.example/");
      expect(tomorrow.id).not.toBe(today.id);
      await finished(h.queue, tomorrow.id);
      expect(h.fake.calls).toHaveLength(2);
    });

    it("retries once, then succeeds", async () => {
      h.fake.failures = [new Error("net::ERR_TIMED_OUT")];
      const job = await h.queue.submit("https://north.example/");
      expect((await finished(h.queue, job.id)).status).toBe("done");
      expect(h.fake.calls).toHaveLength(2);
    });

    it("fails after two attempts, reports the first line, and doesn't cache the failure", async () => {
      h.fake.failures = [new Error("bot check"), new Error("bot check\ncall log: …")];
      const job = await h.queue.submit("https://north.example/");
      const failed = await finished(h.queue, job.id);
      expect(failed).toMatchObject({ status: "failed", error: "bot check" });
      expect(h.fake.calls).toHaveLength(2);
      expect(await h.queue.find("https://north.example/")).toBeNull();

      const retried = await h.queue.submit("https://north.example/");
      expect((await finished(h.queue, retried.id)).status).toBe("done");
      expect(h.fake.calls).toHaveLength(3);
    });

    it("never retries a blocked URL", async () => {
      h.fake.failures = [new BlockedUrlError("evil.example resolves to a non-public address")];
      const job = await h.queue.submit("https://evil.example/");
      const failed = await finished(h.queue, job.id);
      expect(failed.status).toBe("failed");
      expect(failed.error).toMatch(/non-public/);
      expect(h.fake.calls).toHaveLength(1);
    });

    it("runs at most 3 jobs at a time", async () => {
      h.fake.hold();
      const jobs = await Promise.all(
        ["a", "b", "c", "d", "e"].map((host) => h.queue.submit(`https://${host}.example/`)),
      );
      await until(() => h.fake.active === 3, "3 running jobs");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(h.fake.active).toBe(3);
      h.fake.release();
      for (const job of jobs) expect((await finished(h.queue, job.id)).status).toBe("done");
      expect(h.fake.maxActive).toBe(3);
      expect(h.fake.calls).toHaveLength(5);
    });

    it("returns null for unknown jobs", async () => {
      expect(await h.queue.get("0".repeat(24))).toBeNull();
      expect(await h.queue.screenshot("0".repeat(24))).toBeNull();
    });
  });
}
