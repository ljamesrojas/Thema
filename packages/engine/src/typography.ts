import { round } from "./color-math.js";
import {
  DISPLAY_HEADING_SHARE,
  GENERIC_FAMILY,
  ICON_FONT_NAME,
  MAX_STEPS_ABOVE,
  MAX_STEPS_BELOW,
  MIN_SIZE_SHARE,
  MONO_NAME,
  SERIF_NAME,
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
 * The family is the first entry that isn't a generic keyword or an icon font.
 * The category comes from the stack's first generic fallback, else from the family name.
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
    .filter((part) => part.length > 0);

  let name: string | undefined;
  let generic: FamilyCategory | undefined;
  let firstGeneric: string | undefined;
  for (const entry of entries) {
    const category = GENERIC_FAMILY[entry.toLowerCase()];
    if (category) {
      generic ??= category;
      firstGeneric ??= entry.toLowerCase();
      continue;
    }
    if (!ICON_FONT_NAME.test(entry)) name ??= entry;
  }

  if (name === undefined) {
    return firstGeneric !== undefined && generic !== undefined
      ? { name: firstGeneric, category: generic }
      : null;
  }
  const byName: FamilyCategory = MONO_NAME.test(name)
    ? "mono"
    : SERIF_NAME.test(name)
      ? "serif"
      : "sans";
  return { name, category: generic ?? byName };
}

interface FamilyStats {
  category: FamilyCategory;
  total: number;
  heading: number;
}

function detectFamilies(samples: readonly StyleSample[]): Families {
  const stats = new Map<string, FamilyStats>();
  for (const sample of samples) {
    const weight = sampleWeight(sample);
    if (weight <= 0 || !isTextSample(sample)) continue;
    const family = parseFontFamily(sample.fontFamily);
    if (!family) continue;
    const entry = stats.get(family.name) ?? { category: family.category, total: 0, heading: 0 };
    entry.total += weight;
    if (sampleRole(sample) === "heading") entry.heading += weight;
    stats.set(family.name, entry);
  }

  const heaviest = (pick: (s: FamilyStats) => number, filter: (s: FamilyStats) => boolean) =>
    [...stats]
      .filter(([, s]) => filter(s))
      .map(([name, s]) => [name, pick(s)] as const)
      .filter(([, score]) => score > 0)
      .sort(byScoreThenKey)[0]?.[0];

  // Display: a headings-only family, as long as some other family carries the body text.
  const bodyFamily = heaviest(
    (s) => s.total - s.heading,
    () => true,
  );
  for (const [name, s] of stats) {
    const headingOnly = s.heading / s.total >= DISPLAY_HEADING_SHARE;
    if (headingOnly && bodyFamily !== undefined && name !== bodyFamily) s.category = "display";
  }

  const inCategory = (category: FamilyCategory) =>
    heaviest(
      (s) => s.total,
      (s) => s.category === category,
    );
  const families: Families = { sans: inCategory("sans") ?? FALLBACK_SANS };
  const serif = inCategory("serif");
  const mono = inCategory("mono");
  const display = inCategory("display");
  if (serif !== undefined) families.serif = serif;
  if (mono !== undefined) families.mono = mono;
  if (display !== undefined) families.display = display;
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

function collectSizes(samples: readonly StyleSample[]): Map<number, SizeStats> {
  const sizes = new Map<number, SizeStats>();
  for (const sample of samples) {
    const weight = sampleWeight(sample);
    if (weight <= 0 || !isTextSample(sample) || !(sample.fontSize > 0)) continue;
    const size = Math.round(sample.fontSize * 2) / 2;
    const stats = sizes.get(size) ?? {
      weight: 0,
      bodyWeight: 0,
      lineHeight: new Map<number, number>(),
      fontWeight: new Map<number, number>(),
      letterSpacing: new Map<number, number>(),
    };
    stats.weight += weight;
    if (sampleRole(sample) === "body") stats.bodyWeight += weight;
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

function buildScale(samples: readonly StyleSample[]): Pick<Typography, "scale" | "ratio"> {
  const all = collectSizes(samples);
  const total = [...all.values()].reduce((acc, s) => acc + s.weight, 0);
  const kept = [...all].filter(([, s]) => s.weight >= total * MIN_SIZE_SHARE);

  const base =
    kept
      .map(([size, s]) => [size, s.bodyWeight] as const)
      .filter(([, w]) => w > 0)
      .sort(byScoreThenKey)[0]?.[0] ??
    kept.map(([size, s]) => [size, s.weight] as const).sort(byScoreThenKey)[0]?.[0];
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
  return { families: detectFamilies(samples), ...buildScale(samples) };
}
