import { describe, expect, it } from "vitest";
import { analyzeSpacing, detectBase, snap } from "../src/spacing.js";
import type { StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

type Quad = [number, number, number, number];

/** A sample with the given padding (uniform if a number) and optional margin/gap. */
const box = (padding: number | Quad, margin: Quad = [0, 0, 0, 0], gap?: number): StyleSample =>
  sample({
    padding: typeof padding === "number" ? [padding, padding, padding, padding] : padding,
    margin,
    ...(gap === undefined ? {} : { gap }),
  });

/** n identical boxes. */
const times = (n: number, make: () => StyleSample): StyleSample[] =>
  Array.from({ length: n }, make);

describe("detectBase", () => {
  it("is 8 when at least 75% of common values are multiples of 8", () => {
    expect(
      detectBase(
        new Map([
          [8, 3],
          [16, 3],
          [12, 2],
        ]),
      ),
    ).toBe(8); // 6/8 = 75%
    expect(
      detectBase(
        new Map([
          [8, 3],
          [16, 2],
          [12, 2],
        ]),
      ),
    ).toBe(4); // 5/7 ≈ 71%
  });

  it("ignores values seen only once", () => {
    expect(
      detectBase(
        new Map([
          [8, 4],
          [16, 4],
          [6, 1],
          [10, 1],
          [14, 1],
        ]),
      ),
    ).toBe(8);
  });

  it("defaults to 4 with no common values", () => {
    expect(detectBase(new Map())).toBe(4);
    expect(detectBase(new Map([[8, 1]]))).toBe(4);
  });
});

describe("snap", () => {
  it("rounds to the nearest multiple of base, halves up", () => {
    expect(snap(14, 4)).toBe(16); // 3.5 → 4
    expect(snap(13, 4)).toBe(12);
    expect(snap(10, 4)).toBe(12); // 2.5 → 3
    expect(snap(12, 8)).toBe(16); // 1.5 → 2
    expect(snap(3, 4)).toBe(4);
    expect(snap(1, 4)).toBe(0);
  });
});

describe("analyzeSpacing", () => {
  it("finds base 8 on an 8px grid and snaps the odd value", () => {
    const samples = [
      ...times(3, () => box(8)),
      ...times(3, () => box(16)),
      ...times(2, () => box(24)),
      box(14),
      box(14),
    ];
    // 14 is common (2×) and not a multiple of 8: 8/10 = 80% → base 8; 14 snaps to 16.
    expect(analyzeSpacing(samples)).toEqual({ base: 8, scale: [8, 16, 24] });
  });

  it("finds base 4 when many common values sit between multiples of 8", () => {
    const samples = [
      ...times(2, () => box(4)),
      ...times(3, () => box(12)),
      ...times(3, () => box(16)),
    ];
    expect(analyzeSpacing(samples)).toEqual({ base: 4, scale: [4, 12, 16] });
  });

  it("counts each value once per sample, so 4-sided padding isn't 4 votes", () => {
    // 20 appears on 4 sides of one sample only → still a one-off.
    const samples = [box(20), box([8, 0, 8, 0]), box([8, 0, 0, 0])];
    expect(analyzeSpacing(samples).scale).toEqual([8]);
  });

  it("collects padding, margin and gap", () => {
    const samples = [box(0, [0, 0, 24, 0], 12), box(0, [24, 0, 0, 0]), box(12)];
    expect(analyzeSpacing(samples).scale).toEqual([12, 24]);
  });

  it("drops one-offs, zeros, negatives and layout-sized values", () => {
    const samples = [
      box(16),
      box(16),
      box(36), // one-off
      box(0, [-8, 0, 0, 0]),
      box(0, [300, 0, 300, 0]),
      box(0, [300, 0, 300, 0]),
    ];
    expect(analyzeSpacing(samples)).toEqual({ base: 8, scale: [16] });
  });

  it("merges values that snap together", () => {
    // 14 and 16 are one-offs on their own but both snap to 16.
    expect(analyzeSpacing([box(14), box(16)]).scale).toEqual([16]);
  });

  it("returns base 4 and an empty scale for no input", () => {
    expect(analyzeSpacing([])).toEqual({ base: 4, scale: [] });
  });
});
