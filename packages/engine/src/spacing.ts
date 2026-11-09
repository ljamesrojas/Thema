import { BASE8_SHARE, SPACING_MAX_PX, SPACING_MIN_COUNT } from "./constants.js";
import type { StyleSample, ThemaSystem } from "./types.js";

type Spacing = ThemaSystem["spacing"];

/** Each sample's distinct spacing values: padding, margin and gap, rounded, > 0 and ≤ max. */
function spacingValues(sample: StyleSample): Set<number> {
  const raw = [
    ...sample.padding,
    ...sample.margin,
    ...(sample.gap === undefined ? [] : [sample.gap]),
  ];
  return new Set(raw.map(Math.round).filter((v) => v > 0 && v <= SPACING_MAX_PX));
}

/**
 * One sample per distinct style: tag, class and spacing values. 100 identical decorative dots are
 * one element style, so they cast one vote for the base, not 100. Without a class (synthetic
 * fixtures, older recordings) the key is tag + values.
 */
function distinctStyles(samples: readonly StyleSample[]): StyleSample[] {
  const seen = new Set<string>();
  return samples.filter((s) => {
    const key = JSON.stringify([s.tag, s.className ?? "", s.padding, s.margin, s.gap ?? 0]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Count how many samples use each value. */
function countBySample(sets: readonly Set<number>[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const set of sets) for (const v of set) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/**
 * Base unit (4 or 8): 8 when at least BASE8_SHARE of the common values (seen on ≥ 2 samples,
 * weighted by count) are multiples of 8. A robust form of SPEC's "GCD of common values":
 * one stray 12px can't break it. Values off the 4-grid (2, 6, 10, 14…) count against 8: on our
 * sites they're what marks a non-8 system, and ignoring them made 8 of 19 base-4 sites read 8.
 */
export function detectBase(counts: ReadonlyMap<number, number>): 4 | 8 {
  let common = 0;
  let multiplesOf8 = 0;
  for (const [value, count] of counts) {
    if (count < SPACING_MIN_COUNT) continue;
    common += count;
    if (value % 8 === 0) multiplesOf8 += count;
  }
  return common > 0 && multiplesOf8 / common >= BASE8_SHARE ? 8 : 4;
}

/** Nearest multiple of base, halves rounding up. Values below half a step snap to 0. */
export function snap(value: number, base: number): number {
  return Math.round(value / base) * base;
}

/**
 * Find the spacing base unit and scale (px) from padding, margin and gap values.
 * The base counts each distinct element style once; the scale counts every sample.
 * Values are snapped to the base; values seen on fewer than 2 samples are outliers and dropped.
 */
export function analyzeSpacing(samples: readonly StyleSample[]): Spacing {
  const sets = samples.map(spacingValues);
  const base = detectBase(countBySample(distinctStyles(samples).map(spacingValues)));

  const snapped = countBySample(
    sets.map((set) => new Set([...set].map((v) => snap(v, base)).filter((v) => v > 0))),
  );
  const scale = [...snapped]
    .filter(([, count]) => count >= SPACING_MIN_COUNT)
    .map(([value]) => value)
    .sort((a, b) => a - b);
  return { base, scale };
}
