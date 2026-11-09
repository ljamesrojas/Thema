import { describe, expect, it } from "vitest";
import { analyzeSpacing, detectBase, snap } from "../src/spacing.js";
import type { StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

type Quad = [number, number, number, number];

let boxId = 0;

/**
 * A sample with the given padding (uniform if a number) and optional margin/gap. Each box gets
 * its own class, so it counts as a distinct style when finding the base.
 */
const box = (padding: number | Quad, margin: Quad = [0, 0, 0, 0], gap?: number): StyleSample =>
  sample({
    className: `box-${(boxId += 1)}`,
    padding: typeof padding === "number" ? [padding, padding, padding, padding] : padding,
    margin,
    ...(gap === undefined ? {} : { gap }),
  });

/** A sample with uniform padding and an explicit tag/class, for the dedupe tests. */
const styled = (tag: string, className: string | undefined, padding: number): StyleSample =>
  sample({
    tag,
    ...(className === undefined ? {} : { className }),
    padding: [padding, padding, padding, padding],
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

  it("counts values off the 4-grid (6, 10, 14) against 8", () => {
    // Ignoring them was tried and rejected: on our sites 2/6/10/14 are what marks a non-8
    // system. Without them, base-4 sites read up to 90% multiples of 8 (Duolingo) while the
    // base-8 Tailwind reads 85%, so no threshold separates them (18/19 → 10/19 sites).
    expect(
      detectBase(
        new Map([
          [8, 4],
          [16, 2],
          [6, 2],
          [10, 2],
        ]),
      ),
    ).toBe(4); // 6/10 = 60%; with 6 and 10 ignored it would be 100% → 8
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

describe("analyzeSpacing: each distinct style counts once for the base", () => {
  const grid = () => ["a", "b", "c", "d"].map((cls, i) => styled("div", cls, i % 2 ? 16 : 8));

  it("doesn't let 100 identical decorative elements outvote the real grid (Vercel's dots)", () => {
    // 100 × span.dot with 12px: one style, so a one-off. Without dedupe it would be 12×100.
    const dots = Array.from({ length: 100 }, () => styled("span", "dot", 12));
    expect(analyzeSpacing([...dots, ...grid()]).base).toBe(8);
  });

  it("counts the same values on different classes separately", () => {
    const samples = [styled("div", "x", 12), styled("div", "y", 12), ...grid()];
    // 12 on two styles: 8 ×2, 16 ×2, 12 ×2 → 67% multiples of 8 → base 4.
    expect(analyzeSpacing(samples).base).toBe(4);
  });

  it("falls back to tag + values when samples have no class (older recordings)", () => {
    const repeated = Array.from({ length: 3 }, () => styled("div", undefined, 12));
    const samples = [...repeated, styled("section", undefined, 8), styled("article", undefined, 8)];
    // Three identical divs are one style (12 ×1, a one-off); 8 is on two tags → base 8.
    expect(analyzeSpacing(samples).base).toBe(8);
  });

  it("leaves the scale alone: repeated elements still put their value on the scale", () => {
    const repeated = Array.from({ length: 3 }, () => styled("div", undefined, 24));
    const samples = [...repeated, styled("section", undefined, 8), styled("article", undefined, 8)];
    expect(analyzeSpacing(samples)).toEqual({ base: 8, scale: [8, 24] });
  });
});
