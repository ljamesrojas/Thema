import { describe, expect, it } from "vitest";
import { CONCURRENCY, concurrencyFrom, MAX_CONCURRENCY } from "../src/index.js";

describe("concurrencyFrom", () => {
  it("uses SPEC's 3 at a time when THEMA_CONCURRENCY isn't set", () => {
    expect(concurrencyFrom({})).toBe(CONCURRENCY);
    expect(CONCURRENCY).toBe(3);
  });

  it("takes a whole number from 1 to the maximum", () => {
    expect(concurrencyFrom({ THEMA_CONCURRENCY: "1" })).toBe(1);
    expect(concurrencyFrom({ THEMA_CONCURRENCY: "2" })).toBe(2);
    expect(concurrencyFrom({ THEMA_CONCURRENCY: String(MAX_CONCURRENCY) })).toBe(MAX_CONCURRENCY);
  });

  it("falls back to the default for anything else, so a typo can't stop the worker", () => {
    for (const value of ["", "0", "-1", "1.5", "two", String(MAX_CONCURRENCY + 1)]) {
      expect(concurrencyFrom({ THEMA_CONCURRENCY: value }), value).toBe(CONCURRENCY);
    }
  });
});
