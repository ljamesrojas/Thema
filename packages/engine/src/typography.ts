import { round } from "./color-math.js";
import {
  DISPLAY_HEADING_SHARE,
  FAMILY_MIN_SHARE,
  GENERIC_ALIAS,
  GENERIC_FAMILY,
  HEADING_LIKE_MIN_SIZE,
  ICON_FONT_NAME,
  MAX_STEPS_ABOVE,
  MAX_STEPS_BELOW,
  MIN_SIZE_SHARE,
  MONO_MIN_ELEMENTS,
  MONO_NAME,
  SERIF_NAME,
  VARIABLE_FONT_SUFFIX,
} from "./constants.js";
import { byScoreThenKey, isTextSample, sampleRole, sampleWeight } from "./samples.js";
import type { StyleSample, ThemaSystem } from "./types.js";

type Typography = ThemaSystem["typography"];
type Families = Typography["families"];
type Step = Typography["scale"][number];
type StepName = Step["name"];
export type FamilyCategory = "sans" | "serif" | "mono" | "display";

/** Used when the samples contain no sans family. */
export const FALLBACK_SANS = "system-ui";

// --- families -----------------------------------------------------------------------------

export interface ParsedFamily {
  /** Family name without quotes, e.g. "Geist Mono". Generic keywords are lowercased. */
  name: string;
  category: FamilyCategory;
}

/**
 * Parse a computed `font-family` stack into its primary family and category.
 * The family is the stack's first entry, skipping icon fonts:
 * - A generic keyword is reported as the keyword, never as a font listed after it, so the result
 *   doesn't depend on the OS that recorded the page. The system-font aliases (-apple-system,
 *   BlinkMacSystemFont) become "system-ui"; -apple-system-ui-serif becomes "ui-serif".
 * - A named family loses any variable-font suffix ("Inter Variable" → "Inter"). Its category
 *   comes from the stack's first generic fallback, else from the name.
 * Returns null for an empty stack or one made only of icon fonts.
 */
export function parseFontFamily(css: string): ParsedFamily | null {
  const entries = css
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((part) => part.length > 0 && !ICON_FONT_NAME.test(part));

  const first = entries[0];
  if (first === undefined) return null;
  const keyword = first.toLowerCase();
  const generic = GENERIC_FAMILY[keyword];
  if (generic) return { name: GENERIC_ALIAS[keyword] ?? keyword, category: generic };

  const name = first.replace(VARIABLE_FONT_SUFFIX, "") || first;
  const fallback = entries
    .map((entry) => GENERIC_FAMILY[entry.toLowerCase()])
    .find((category) => category !== undefined);
  const byName: FamilyCategory = MONO_NAME.test(name)
    ? "mono"
    : SERIF_NAME.test(name)
      ? "serif"
      : "sans";
  return { name, category: fallback ?? byName };
}

interface FamilyStats {
  category: FamilyCategory;
  total: number;
  /** Weight of heading-like text: see isHeadingLike. */
  headingLike: number;
  /** Largest heading-like font size, px. */
  largestHeading: number;
  /** Weight used inside pre/code/kbd/samp. */
  inCode: number;
  /** Number of visible text elements (samples) set in this family. */
  elements: number;
}

/** A heading, text inside one, or large text above the base body size. */
function isHeadingLike(sample: StyleSample, baseSize: number): boolean {
  if (sampleRole(sample) === "heading" || sample.inHeading === true) return true;
  const size = roundSize(sample.fontSize);
  return size >= HEADING_LIKE_MIN_SIZE && size > baseSize;
}

/**
 * Families by category, plus display and heading:
 * 1. Non-mono families under FAMILY_MIN_SHARE of text weight are dropped. Mono families are kept
 *    at any share, as long as they're on MONO_MIN_ELEMENTS elements or used inside code.
 * 2. Candidates for display/heading: non-mono families whose weight is ≥ DISPLAY_HEADING_SHARE
 *    heading-like, as long as another family carries the body text.
 * 3. display = the candidate with the largest heading text; heading = the heaviest other one.
 *    Every candidate leaves its category, so it's never also reported as sans or serif.
 */
function detectFamilies(samples: readonly StyleSample[], baseSize: number): Families {
  const stats = new Map<string, FamilyStats>();
  let totalWeight = 0;
  for (const sample of samples) {
    const weight = sampleWeight(sample);
    if (weight <= 0 || !isTextSample(sample)) continue;
    const family = parseFontFamily(sample.fontFamily);
    if (!family) continue;
    const entry = stats.get(family.name) ?? {
      category: family.category,
      total: 0,
      headingLike: 0,
      largestHeading: 0,
      inCode: 0,
      elements: 0,
    };
    entry.total += weight;
    entry.elements += 1;
    totalWeight += weight;
    if (isHeadingLike(sample, baseSize)) {
      entry.headingLike += weight;
      entry.largestHeading = Math.max(entry.largestHeading, sample.fontSize);
    }
    if (sample.inCode === true) entry.inCode += weight;
    stats.set(family.name, entry);
  }

  for (const [name, s] of stats) {
    const kept =
      s.category === "mono"
        ? s.elements >= MONO_MIN_ELEMENTS || s.inCode > 0
        : s.total >= totalWeight * FAMILY_MIN_SHARE;
    if (!kept) stats.delete(name);
  }

  const heaviest = (pick: (s: FamilyStats) => number, filter: (s: FamilyStats) => boolean) =>
    [...stats]
      .filter(([, s]) => filter(s))
      .map(([name, s]) => [name, pick(s)] as const)
      .filter(([, score]) => score > 0)
      .sort(byScoreThenKey)[0]?.[0];

  const bodyFamily = heaviest(
    (s) => s.total - s.headingLike,
    () => true,
  );
  const candidates = [...stats].filter(
    ([name, s]) =>
      bodyFamily !== undefined &&
      name !== bodyFamily &&
      s.category !== "mono" &&
      s.headingLike / s.total >= DISPLAY_HEADING_SHARE,
  );
  const largestFirst = [...candidates].sort(
    ([nameA, a], [nameB, b]) =>
      b.largestHeading - a.largestHeading ||
      byScoreThenKey([nameA, a.total] as const, [nameB, b.total] as const),
  );
  const display = largestFirst[0]?.[0];
  const heading = candidates
    .filter(([name]) => name !== display)
    .map(([name, s]) => [name, s.total] as const)
    .sort(byScoreThenKey)[0]?.[0];
  for (const [name] of candidates) stats.delete(name);

  const inCategory = (category: FamilyCategory) =>
    heaviest(
      (s) => s.total,
      (s) => s.category === category,
    );
  const families: Families = { sans: inCategory("sans") ?? FALLBACK_SANS };
  const serif = inCategory("serif");
  const mono = inCategory("mono");
  // A generic decorative family (cursive, fantasy) is display when no candidate is.
  const displayFamily = display ?? inCategory("display");
  if (serif !== undefined) families.serif = serif;
  if (mono !== undefined) families.mono = mono;
  if (displayFamily !== undefined) families.display = displayFamily;
  if (heading !== undefined) families.heading = heading;
  return families;
}

// --- scale --------------------------------------------------------------------------------

const NAMES_BELOW: readonly StepName[] = ["xs", "sm"];
const NAMES_ABOVE: readonly StepName[] = ["lg", "xl", "2xl", "3xl", "4xl"];

/**
 * Per font size: `weight`/`bodyWeight` (area × role weight) decide which sizes make the scale.
 * The attribute maps use raw area, so they describe what text at that size looks like:
 * semibold buttons (×3) or a bold ad don't override the body text's weight.
 */
interface SizeStats {
  weight: number;
  bodyWeight: number;
  lineHeight: Map<number, number>;
  fontWeight: Map<number, number>;
  letterSpacing: Map<number, number>;
}

const addTo = (map: Map<number, number>, key: number, weight: number): void => {
  map.set(key, (map.get(key) ?? 0) + weight);
};

/** The value with the most weight; ties go to the smaller value. */
function mode(map: Map<number, number>): number {
  return [...map].sort(byScoreThenKey)[0]?.[0] ?? 0;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2;
}

/** Font sizes are compared at 0.5px. */
const roundSize = (fontSize: number): number => Math.round(fontSize * 2) / 2;

function collectSizes(samples: readonly StyleSample[]): Map<number, SizeStats> {
  const sizes = new Map<number, SizeStats>();
  for (const sample of samples) {
    const weight = sampleWeight(sample);
    if (weight <= 0 || !isTextSample(sample) || !(sample.fontSize > 0)) continue;
    const size = roundSize(sample.fontSize);
    const stats = sizes.get(size) ?? {
      weight: 0,
      bodyWeight: 0,
      lineHeight: new Map<number, number>(),
      fontWeight: new Map<number, number>(),
      letterSpacing: new Map<number, number>(),
    };
    stats.weight += weight;
    // A span inside a heading records as body text, but it's heading text.
    if (sampleRole(sample) === "body" && sample.inHeading !== true) stats.bodyWeight += weight;
    addTo(stats.lineHeight, sample.lineHeight, sample.area);
    addTo(stats.fontWeight, sample.fontWeight, sample.area);
    addTo(stats.letterSpacing, sample.letterSpacing, sample.area);
    sizes.set(size, stats);
  }
  return sizes;
}

/** Keep the `count` heaviest sizes, returned in ascending size order. */
function heaviestSizes(
  candidates: readonly (readonly [number, SizeStats])[],
  count: number,
): number[] {
  return candidates
    .map(([size, s]) => [size, s.weight] as const)
    .sort(byScoreThenKey)
    .slice(0, count)
    .map(([size]) => size)
    .sort((a, b) => a - b);
}

/** Sizes with at least MIN_SIZE_SHARE of text weight. */
function keptSizes(all: ReadonlyMap<number, SizeStats>): [number, SizeStats][] {
  const total = [...all.values()].reduce((acc, s) => acc + s.weight, 0);
  return [...all].filter(([, s]) => s.weight >= total * MIN_SIZE_SHARE);
}

/** The heaviest body-text size, else the heaviest size; undefined when there's no text. */
function baseSize(kept: readonly (readonly [number, SizeStats])[]): number | undefined {
  return (
    kept
      .map(([size, s]) => [size, s.bodyWeight] as const)
      .filter(([, w]) => w > 0)
      .sort(byScoreThenKey)[0]?.[0] ??
    kept.map(([size, s]) => [size, s.weight] as const).sort(byScoreThenKey)[0]?.[0]
  );
}

function buildScale(
  all: ReadonlyMap<number, SizeStats>,
  kept: readonly (readonly [number, SizeStats])[],
  base: number | undefined,
): Pick<Typography, "scale" | "ratio"> {
  if (base === undefined) return { scale: [], ratio: 1 };

  const below = heaviestSizes(
    kept.filter(([size]) => size < base),
    MAX_STEPS_BELOW,
  );
  const above = heaviestSizes(
    kept.filter(([size]) => size > base),
    MAX_STEPS_ABOVE,
  );

  // Pair each size with its name and its step offset k from base (xs = −2 … 4xl = +5).
  const steps: { size: number; name: StepName; k: number }[] = [
    ...below.map((size, i) => ({
      size,
      name: NAMES_BELOW[NAMES_BELOW.length - below.length + i] ?? "xs",
      k: i - below.length,
    })),
    { size: base, name: "base", k: 0 },
    ...above.map((size, i) => ({ size, name: NAMES_ABOVE[i] ?? "4xl", k: i + 1 })),
  ];

  const scale: Step[] = steps.map(({ size, name }) => {
    const stats = all.get(size);
    if (!stats) throw new Error(`size ${size} missing from stats`); // unreachable: steps come from `all`
    return {
      name,
      size,
      lineHeight: round(mode(stats.lineHeight) / size, 2),
      weight: mode(stats.fontWeight),
      tracking: round(mode(stats.letterSpacing) / size, 3),
    };
  });

  const ratios = steps.filter((s) => s.k !== 0).map((s) => (s.size / base) ** (1 / s.k));
  return { scale, ratio: ratios.length > 0 ? round(median(ratios), 3) : 1 };
}

/**
 * Derive font families, a named size scale (xs … 4xl) and its ratio from style samples.
 * Pure and deterministic.
 */
export function analyzeTypography(samples: readonly StyleSample[]): Typography {
  const sizes = collectSizes(samples);
  const kept = keptSizes(sizes);
  const base = baseSize(kept);
  return { families: detectFamilies(samples, base ?? 0), ...buildScale(sizes, kept, base) };
}
