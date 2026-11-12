import {
  CENTER_TOLERANCE_PX,
  CONTAINER_MIN_MARGIN,
  CAPPED_MIN_COUNT,
  CONTAINER_MIN_WIDTH,
  GUTTER_MIN,
  LAYOUT_DEFAULTS,
  SECTION_MIN_PADDING,
  SECTION_MIN_WIDTH_SHARE,
} from "./constants.js";
import type { StyleSample, ThemaSystem } from "./types.js";

type Layout = ThemaSystem["layout"];

export interface LayoutAnalysis {
  layout: Layout;
  /** Keys filled by a default instead of measured. */
  derived: (keyof Layout)[];
}

/** One sample per distinct element style, so 40 identical cards count once. */
function distinct(samples: readonly StyleSample[]): StyleSample[] {
  const seen = new Set<string>();
  return samples.filter((s) => {
    const key = JSON.stringify([s.tag, s.className ?? "", s.width, s.padding, s.margin]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The most common value; ties go to the larger value, or the smaller with `preferSmall`. */
function mostCommon(values: readonly number[], preferSmall = false): number | undefined {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort(([va, a], [vb, b]) => b - a || (preferSmall ? va - vb : vb - va))[0]?.[0];
}

/** The most common value seen at least `min` times, or undefined. */
function mostCommonAtLeast(values: readonly number[], min: number): number | undefined {
  const value = mostCommon(values);
  return value !== undefined && values.filter((v) => v === value).length >= min ? value : undefined;
}

/** Equal left/right padding of at least GUTTER_MIN, or undefined. */
function sidePadding(sample: StyleSample): number | undefined {
  const [, right, , left] = sample.padding;
  return left >= GUTTER_MIN && left === right ? Math.round(left) : undefined;
}

const defined = <T>(values: readonly (T | undefined)[]): T[] =>
  values.filter((v): v is T => v !== undefined);

/**
 * Container width, gutter and section spacing from element boxes (recorded at a 1440px viewport).
 * Each distinct element style counts once.
 * - containerMax: the most common horizontally centered box shown at its own max-width (capped
 *   at its maximum: Stripe 1266, Resend 1280; seen on CAPPED_MIN_COUNT styles, so one capped text
 *   block can't win: Linear's 722), else the most common centered box ≥ 600px wide that
 *   leaves CONTAINER_MIN_MARGIN each side, else the most common max-width.
 * - gutter: equal side padding (≥ GUTTER_MIN) on those containers, else on any centered box,
 *   else on full-width boxes; ties go to the smaller value.
 * - sectionY: the most common top padding ≥ SECTION_MIN_PADDING on boxes spanning at least
 *   SECTION_MIN_WIDTH_SHARE of the page.
 * Anything not found falls back to LAYOUT_DEFAULTS and is listed in `derived`.
 */
export function analyzeLayout(samples: readonly StyleSample[]): LayoutAnalysis {
  const derived: (keyof Layout)[] = [];
  const pick = (key: keyof Layout, value: number | undefined): number => {
    if (value !== undefined) return value;
    derived.push(key);
    return LAYOUT_DEFAULTS[key];
  };

  // Boxes are measured against the page (html's box); without it there's nothing to compare to.
  const page = samples.find((s) => s.tag === "html")?.width;
  const boxes = (page === undefined ? [] : distinct(samples)).filter(
    (s): s is StyleSample & { x: number; width: number } =>
      s.x !== undefined && s.width !== undefined,
  );
  const pageWidth = page ?? 0;
  const centered = boxes.filter(
    (s) =>
      s.width >= CONTAINER_MIN_WIDTH &&
      s.width <= pageWidth - 2 * CONTAINER_MIN_MARGIN &&
      Math.abs(s.x - (pageWidth - s.x - s.width)) <= CENTER_TOLERANCE_PX,
  );
  const capped = centered.filter(
    (s) => s.maxWidth !== undefined && Math.abs(s.width - s.maxWidth) <= 1,
  );
  const fullWidth = boxes.filter((s) => s.width >= pageWidth - 2);

  const maxWidths = samples
    .map((s) => s.maxWidth)
    .filter((w): w is number => w !== undefined && w >= CONTAINER_MIN_WIDTH);
  const containerMax = pick(
    "containerMax",
    mostCommonAtLeast(
      capped.map((s) => Math.round(s.width)),
      CAPPED_MIN_COUNT,
    ) ??
      mostCommon(centered.map((s) => Math.round(s.width))) ??
      mostCommon(maxWidths.map(Math.round)),
  );

  // Ties go to the smaller gutter: page gutters are small, inner card padding is larger.
  const gutter = pick(
    "gutter",
    mostCommon(defined(capped.map(sidePadding)), true) ??
      mostCommon(defined(centered.map(sidePadding)), true) ??
      mostCommon(defined(fullWidth.map(sidePadding)), true),
  );

  const sectionY = pick(
    "sectionY",
    mostCommon(
      boxes
        .filter((s) => s.width >= pageWidth * SECTION_MIN_WIDTH_SHARE)
        .map((s) => Math.round(s.padding[0]))
        .filter((top) => top >= SECTION_MIN_PADDING),
    ),
  );

  return { layout: { containerMax, gutter, sectionY }, derived };
}
