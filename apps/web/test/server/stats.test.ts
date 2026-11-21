// @vitest-environment node
// The anonymous daily totals: one contract for memory and Redis (Redis runs only with REDIS_URL,
// like the job queue's contract), plus the routes that count.
import { Redis } from "ioredis";
import { afterAll, describe, expect, it } from "vitest";
import { createMemoryStats, createRedisStats, recordSafely, type Stats } from "@/server/stats";

const clock = { now: new Date("2026-11-21T10:00:00.000Z") };
const now = () => clock.now;
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;
afterAll(() => redis?.disconnect());

const makers: [string, () => Promise<Stats>][] = [
  ["memory", () => Promise.resolve(createMemoryStats(now))],
];
if (redis) {
  makers.push([
    "redis",
    async () => {
      const keys = await redis.keys("thema:stats:*");
      if (keys.length) await redis.del(...keys);
      return createRedisStats(redis, now);
    },
  ]);
}

describe.each(makers)("stats (%s)", (_name, make) => {
  it("counts events per UTC day and distinct projects for blends and exports", async () => {
    clock.now = new Date("2026-11-20T23:00:00.000Z");
    const stats = await make();
    await stats.record("blend", "p1");
    clock.now = new Date("2026-11-21T10:00:00.000Z");
    for (const id of ["p1", "p1", "p2"]) await stats.record("blend", id);
    await stats.record("export", "p1");
    await stats.record("extraction");
    await stats.record("signup");

    const { days, window } = await stats.report(2);
    expect(days.map((d) => d.day)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(days[0]?.counts.blend).toBe(1);
    expect(days[1]?.counts).toEqual({ extraction: 1, blend: 3, export: 1, signup: 1 });
    expect(days[1]?.projects).toEqual({ blend: 2, export: 1 });
    // Over both days, p1 counts once.
    expect(window).toEqual({ blend: 2, export: 1 });
  });

  it("reports empty days as zeros", async () => {
    const stats = await make();
    const { days } = await stats.report(3);
    expect(days).toHaveLength(3);
    expect(days[0]?.counts).toEqual({ extraction: 0, blend: 0, export: 0, signup: 0 });
  });
});

describe("recordSafely", () => {
  it("never lets a counting failure break the request", async () => {
    const broken: Stats = {
      record: () => Promise.reject(new Error("redis down")),
      report: () => Promise.reject(new Error("redis down")),
    };
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await expect(recordSafely(broken, "blend", "p1")).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(1);
  });
});
