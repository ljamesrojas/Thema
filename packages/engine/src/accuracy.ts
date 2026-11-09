import { analyzeColors } from "./colors.js";
import { deltaEOK, parseCssColor } from "./color-math.js";
import { MONOCHROME_MAX_CHROMA, PRIMARY_MAX_DELTA_E, VARIABLE_FONT_SUFFIX } from "./constants.js";
import { analyzeSpacing } from "./spacing.js";
import type { ColorRole, StyleSample, ThemaSystem } from "./types.js";
import { analyzeTypography } from "./typography.js";

/**
 * A fixture's expected.json. Synthetic fixtures specify everything; recorded real sites need
 * at least roles.primary, typography.families and spacing.base for the accuracy report.
 * Colors may be any CSS color (hex is fine). `"primary": null` means "this site has none".
 * `"monochrome": true` (black/white/gray CTAs) scores primary by saturation instead of by the
 * expected value, which is then informational only: see judgeMonochromePrimary.
 */
export interface FixtureExpected {
  source: "synthetic" | "recorded";
  monochrome?: boolean;
  description?: string;
  url?: string;
  recordedAt?: string;
  roles?: Partial<Record<ColorRole, string | null>>;
  typography?: Partial<ThemaSystem["typography"]>;
  spacing?: Partial<ThemaSystem["spacing"]>;
  radius?: ThemaSystem["radius"];
  shadow?: ThemaSystem["shadow"];
}

export const ACCURACY_CHECKS = ["primary", "fonts", "spacing"] as const;
export type AccuracyCheck = (typeof ACCURACY_CHECKS)[number];

/** "missing" = the expected value hasn't been filled in yet. */
export type CheckStatus = "pass" | "fail" | "missing";

export interface CheckResult {
  status: CheckStatus;
  expected: string;
  got: string;
  /** Why it failed, e.g. "ΔE 7.3". */
  detail?: string;
}

export type FixtureScore = Record<AccuracyCheck, CheckResult>;

type Families = ThemaSystem["typography"]["families"];

/**
 * Lowercase, unquoted, single-spaced family name without a variable-font suffix, so "Inter"
 * matches "'inter'" and "Mona Sans VF" matches "Mona Sans".
 */
const normalizeFamily = (name: string): string =>
  name
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(VARIABLE_FONT_SUFFIX, "")
    .toLowerCase();

const familyEntries = (families: Partial<Families>): [string, string][] =>
  Object.entries(families)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([category, name]): [string, string] => [category, normalizeFamily(name)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const describeFamilies = (families: Partial<Families>): string =>
  Object.entries(families)
    .filter(([, name]) => typeof name === "string")
    .map(([category, name]) => `${category} ${String(name)}`)
    .join(", ");

/**
 * Monochrome sites (black/white/gray CTAs): the engine is right when it finds no saturated
 * primary. It passes with no primary or a near-neutral one (chroma < MONOCHROME_MAX_CHROMA),
 * and fails on anything saturated, e.g. a demo widget's blue winning.
 */
export function judgeMonochromePrimary(got: string | undefined): CheckResult {
  const expected = "monochrome";
  if (got === undefined) return { status: "pass", expected, got: "none" };
  const color = parseCssColor(got);
  if (!color) return { status: "fail", expected, got, detail: "unparseable" };
  const neutral = color.c < MONOCHROME_MAX_CHROMA;
  return {
    status: neutral ? "pass" : "fail",
    expected,
    got,
    detail: `C ${color.c.toFixed(3)}${neutral ? "" : " (saturated)"}`,
  };
}

function checkPrimary(samples: readonly StyleSample[], expected: FixtureExpected): CheckResult {
  const got = analyzeColors(samples).roles.primary;
  if (expected.monochrome === true) return judgeMonochromePrimary(got);
  const want = expected.roles?.primary;
  const gotText = got ?? "none";
  if (want === undefined) return { status: "missing", expected: "?", got: gotText };
  if (want === null || got === undefined) {
    const pass = want === null && got === undefined;
    return { status: pass ? "pass" : "fail", expected: want ?? "none", got: gotText };
  }
  const a = parseCssColor(want);
  const b = parseCssColor(got);
  if (!a || !b) return { status: "fail", expected: want, got: gotText, detail: "unparseable" };
  const d = deltaEOK(a, b);
  return {
    status: d < PRIMARY_MAX_DELTA_E ? "pass" : "fail",
    expected: want,
    got: gotText,
    detail: `ΔE ${d.toFixed(1)}`,
  };
}

function checkFonts(samples: readonly StyleSample[], expected: FixtureExpected): CheckResult {
  const got = analyzeTypography(samples).families;
  const want = expected.typography?.families;
  if (!want) return { status: "missing", expected: "?", got: describeFamilies(got) };
  const same = JSON.stringify(familyEntries(want)) === JSON.stringify(familyEntries(got));
  return {
    status: same ? "pass" : "fail",
    expected: describeFamilies(want),
    got: describeFamilies(got),
  };
}

function checkSpacing(samples: readonly StyleSample[], expected: FixtureExpected): CheckResult {
  const got = analyzeSpacing(samples).base;
  const want = expected.spacing?.base;
  if (want === undefined) return { status: "missing", expected: "?", got: String(got) };
  return { status: want === got ? "pass" : "fail", expected: String(want), got: String(got) };
}

/** Score one fixture on the three gate checks: primary color, font families, spacing base. */
export function scoreFixture(
  samples: readonly StyleSample[],
  expected: FixtureExpected,
): FixtureScore {
  return {
    primary: checkPrimary(samples, expected),
    fonts: checkFonts(samples, expected),
    spacing: checkSpacing(samples, expected),
  };
}

export interface AccuracySummary {
  passed: number;
  /** All checks, including missing ones (which count as not passed). */
  total: number;
  missing: number;
  /** passed / total; 0 when there are no checks. */
  ratio: number;
}

/** Share of individual checks that pass (SPEC gate: ≥ 90% across real sites). */
export function summarizeAccuracy(scores: readonly FixtureScore[]): AccuracySummary {
  const results = scores.flatMap((score) => ACCURACY_CHECKS.map((check) => score[check]));
  const passed = results.filter((r) => r.status === "pass").length;
  const missing = results.filter((r) => r.status === "missing").length;
  return {
    passed,
    total: results.length,
    missing,
    ratio: results.length ? passed / results.length : 0,
  };
}
