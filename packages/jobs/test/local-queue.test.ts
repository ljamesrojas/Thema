import { describe, expect, it } from "vitest";
import { cacheKey, createLocalQueue, jobIdFor, nextUtcMidnight, utcDay } from "../src/index.js";
import { FakeRun, queueContract } from "./contract.js";

function harness() {
  const fake = new FakeRun();
  const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
  const queue = createLocalQueue({ run: fake.run, now: () => clock.now });
  return { queue, fake, clock };
}

queueContract("local", () => Promise.resolve({ ...harness(), close: () => Promise.resolve() }));

describe("local queue", () => {
  it("forgets results after 24 h", async () => {
    const { queue, clock } = harness();
    const job = await queue.submit("https://north.example/");
    await queue.settled(job.id);
    expect(await queue.get(job.id)).not.toBeNull();
    clock.now = new Date("2026-11-14T10:00:00.000Z");
    expect(await queue.get(job.id)).toBeNull();
    expect(await queue.screenshot(job.id)).toBeNull();
  });

  it("settled() resolves when the job finishes", async () => {
    const { queue } = harness();
    const job = await queue.submit("https://north.example/");
    await queue.settled(job.id);
    expect((await queue.get(job.id))?.status).toBe("done");
  });
});

describe("cache keys", () => {
  it("keys by URL without the fragment, plus the UTC day", () => {
    const now = new Date("2026-11-13T23:30:00.000-05:00"); // already Nov 14 in UTC
    expect(cacheKey("https://North.example/a#top", now)).toBe("https://north.example/a|2026-11-14");
    expect(utcDay(now)).toBe("2026-11-14");
    expect(nextUtcMidnight(now).toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });

  it("derives a stable 24-hex job id", () => {
    const id = jobIdFor("https://north.example/|2026-11-13");
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(jobIdFor("https://north.example/|2026-11-13")).toBe(id);
    expect(jobIdFor("https://north.example/|2026-11-14")).not.toBe(id);
  });
});
