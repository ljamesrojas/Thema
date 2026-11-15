import { describe, expect, it } from "vitest";
import type { RateLimiter } from "../src/index.js";

/** The daily limit both limiters (memory, Redis) must share. */
export function rateLimitContract(
  name: string,
  make: (clock: { now: Date }) => Promise<{ limiter: RateLimiter; close: () => Promise<void> }>,
) {
  describe(`${name}: daily rate limit`, () => {
    it("allows 3 a day per client, then refuses until UTC midnight", async () => {
      const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
      const { limiter, close } = await make(clock);
      try {
        const results = [];
        for (let i = 0; i < 5; i += 1) results.push(await limiter.consume("client-a"));
        expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
        expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0, 0]);
        expect(results[3]?.resetAt.toISOString()).toBe("2026-11-14T00:00:00.000Z");

        expect((await limiter.consume("client-b")).allowed).toBe(true);

        clock.now = new Date("2026-11-14T00:00:01.000Z");
        expect(await limiter.consume("client-a")).toMatchObject({ allowed: true, remaining: 2 });
      } finally {
        await close();
      }
    });

    it("takes a per-client limit (signed-in plans)", async () => {
      const clock = { now: new Date("2026-11-13T10:00:00.000Z") };
      const { limiter, close } = await make(clock);
      try {
        const results = [];
        for (let i = 0; i < 11; i += 1) results.push(await limiter.consume("user:ana", 10));
        expect(results.filter((r) => r.allowed)).toHaveLength(10);
        expect(results[9]?.remaining).toBe(0);
        expect(results[10]?.allowed).toBe(false);
        expect((await limiter.consume("client-c")).remaining).toBe(2);
      } finally {
        await close();
      }
    });
  });
}
