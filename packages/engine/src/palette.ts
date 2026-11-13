import { converter, wcagContrast, type Oklab } from "culori";
import { analyzeColors, firstScreenCtas, paintedBackground } from "./colors.js";
import {
  compositeOver,
  deltaEOK,
  formatInSrgb,
  formatOklch,
  parseCssColor,
  withOpacity,
  type Oklch,
} from "./color-math.js";
import {
  CLUSTER_DELTA_E,
  CTA_NEUTRAL_CHROMA,
  DARK_CANVAS_LIGHTNESS,
  FALLBACK_INK_LIGHTNESS,
  HAIRLINE_MIX,
  INK_MUTED_MIX,
  RAISED_STEP_DARK,
  RAISED_STEP_LIGHT,
  SATURATED_CHROMA,
  SEMANTIC_CHROMA,
  SEMANTIC_HUE,
  SEMANTIC_LIGHTNESS,
  SURFACE_MAX_DELTA_E,
  SURFACE_STEP_DARK,
  SURFACE_STEP_LIGHT,
} from "./constants.js";
import { sampleRole } from "./samples.js";
import type { ColorRole, StyleSample } from "./types.js";

export interface Palette {
  /** Every color role, as an OKLCH string. */
  colors: Record<ColorRole, string>;
  /** Roles filled by a fallback rule instead of measured from the samples. */
  derived: ColorRole[];
  /** No saturated primary: primary is the neutral first-screen CTA fill (or ink). */
  monochrome: boolean;
}

const WHITE: Oklch = { mode: "oklch", l: 1, c: 0 };
const toOklab = converter("oklab");
const toOklch = converter("oklch");

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The same color at another lightness (0–1). */
const withLightness = (color: Oklch, l: number): Oklch => ({ ...color, l: clamp(l, 0, 1) });

/** Mix in OKLab: t = 0 gives `a`, t = 1 gives `b`. */
function mix(a: Oklch, b: Oklch, t: number): Oklch {
  const la: Oklab = toOklab(a);
  const lb: Oklab = toOklab(b);
  const mixed: Oklab = {
    mode: "oklab",
    l: la.l + (lb.l - la.l) * t,
    a: la.a + (lb.a - la.a) * t,
    b: la.b + (lb.b - la.b) * t,
  };
  return toOklch(mixed);
}

/** The key with the most weight; ties go to the smaller key, so the result is stable. */
function heaviest(weights: ReadonlyMap<string, number>): string | undefined {
  return [...weights].sort(([ka, a], [kb, b]) => b - a || (ka < kb ? -1 : ka > kb ? 1 : 0))[0]?.[0];
}

const add = (map: Map<string, number>, key: string, weight: number): void => {
  map.set(key, (map.get(key) ?? 0) + weight);
};

/** A sample's painted background, faded by its opacity and composited onto the canvas. */
function backgroundOf(sample: StyleSample, canvas: Oklch): Oklch | null {
  const css = paintedBackground(sample);
  const parsed = css === undefined ? null : parseCssColor(css);
  return parsed ? compositeOver(withOpacity(parsed, sample.opacity), canvas) : null;
}

/**
 * surface-raised, measured: the heaviest neutral background near the canvas (within
 * SURFACE_MAX_DELTA_E) that is neither the canvas nor the surface, seen on at least 2 samples.
 */
function measureRaised(
  samples: readonly StyleSample[],
  canvas: Oklch,
  surface: Oklch | null,
): string | undefined {
  const area = new Map<string, number>();
  const count = new Map<string, number>();
  for (const sample of samples) {
    if (!(sample.area > 0)) continue;
    const bg = backgroundOf(sample, canvas);
    if (!bg || bg.c >= SATURATED_CHROMA) continue;
    const fromCanvas = deltaEOK(bg, canvas);
    if (fromCanvas < CLUSTER_DELTA_E || fromCanvas > SURFACE_MAX_DELTA_E) continue;
    if (surface && deltaEOK(bg, surface) < CLUSTER_DELTA_E) continue;
    const key = formatOklch(bg);
    add(area, key, sample.area);
    add(count, key, 1);
  }
  return heaviest(new Map([...area].filter(([key]) => (count.get(key) ?? 0) >= 2)));
}

/**
 * primary-ink, measured: the heaviest text color on interactive samples painted in the primary
 * (within CLUSTER_DELTA_E), ignoring text that barely differs from its own background.
 */
function measurePrimaryInk(
  samples: readonly StyleSample[],
  primary: Oklch,
  canvas: Oklch,
): string | undefined {
  const weights = new Map<string, number>();
  for (const sample of samples) {
    if (!(sample.area > 0) || sampleRole(sample) !== "interactive") continue;
    const bg = backgroundOf(sample, canvas);
    if (!bg || deltaEOK(bg, primary) >= CLUSTER_DELTA_E) continue;
    const text = parseCssColor(sample.color);
    if (!text) continue;
    const ink = compositeOver(withOpacity(text, sample.opacity), bg);
    if (deltaEOK(ink, bg) < 10) continue;
    add(weights, formatOklch(ink), sample.area);
  }
  return heaviest(weights);
}

/** On monochrome sites: the heaviest neutral first-screen CTA fill (Vercel's black button). */
function neutralCtaFill(samples: readonly StyleSample[], canvas: Oklch): string | undefined {
  const ctas = firstScreenCtas(samples, canvas);
  if (ctas.length === 0 || ctas.some((cta) => cta.fill.c >= CTA_NEUTRAL_CHROMA)) return undefined;
  const weights = new Map<string, number>();
  for (const cta of ctas) add(weights, formatOklch(cta.fill), cta.area);
  return heaviest(weights);
}

/** success / warning / danger / info: fixed hues at the primary's lightness and chroma. */
function semantic(primary: Oklch): Pick<Record<ColorRole, string>, keyof typeof SEMANTIC_HUE> {
  const saturated = primary.c >= SATURATED_CHROMA;
  const l = saturated
    ? clamp(primary.l, SEMANTIC_LIGHTNESS.min, SEMANTIC_LIGHTNESS.max)
    : SEMANTIC_LIGHTNESS.neutral;
  const c = saturated
    ? clamp(primary.c, SEMANTIC_CHROMA.min, SEMANTIC_CHROMA.max)
    : SEMANTIC_CHROMA.neutral;
  const make = (h: number): string => formatInSrgb({ mode: "oklch", l, c, h });
  return {
    success: make(SEMANTIC_HUE.success),
    warning: make(SEMANTIC_HUE.warning),
    danger: make(SEMANTIC_HUE.danger),
    info: make(SEMANTIC_HUE.info),
  };
}

/**
 * Every color role for one theme. Roles analyzeColors finds are kept as measured; surface-raised
 * and primary-ink are measured here; the rest falls back to documented rules and is listed in
 * `derived`. Pure and deterministic.
 */
export function completePalette(samples: readonly StyleSample[]): Palette {
  const { roles } = analyzeColors(samples);
  const derived: ColorRole[] = [];
  const parse = (css: string | undefined): Oklch | null =>
    css === undefined ? null : parseCssColor(css);
  const fallback = (role: ColorRole, color: Oklch): string => {
    derived.push(role);
    return formatOklch(color);
  };

  const canvas = parse(roles.canvas) ?? WHITE;
  const isDark = canvas.l < DARK_CANVAS_LIGHTNESS;
  const canvasCss = roles.canvas ?? fallback("canvas", canvas);

  const inkCss =
    roles.ink ??
    fallback("ink", withLightness(canvas, FALLBACK_INK_LIGHTNESS[isDark ? "dark" : "light"]));
  const ink = parse(inkCss) ?? canvas;

  const surfaceCss =
    roles.surface ??
    fallback(
      "surface",
      withLightness(canvas, isDark ? canvas.l + SURFACE_STEP_DARK : canvas.l - SURFACE_STEP_LIGHT),
    );
  const surface = parse(surfaceCss) ?? canvas;

  const top = Math.max(canvas.l, surface.l);
  const raisedCss =
    measureRaised(samples, canvas, parse(roles.surface)) ??
    fallback(
      "surface-raised",
      withLightness(canvas, top + (isDark ? RAISED_STEP_DARK : RAISED_STEP_LIGHT)),
    );

  const monochromeFill = roles.primary === undefined ? neutralCtaFill(samples, canvas) : undefined;
  const primaryCss = roles.primary ?? monochromeFill ?? fallback("primary", ink);
  const primary = parse(primaryCss) ?? ink;

  const contrastOn = (color: Oklch): number => wcagContrast(color, primary);
  const primaryInkCss =
    measurePrimaryInk(samples, primary, canvas) ??
    fallback("primary-ink", contrastOn(canvas) >= contrastOn(ink) ? canvas : ink);

  const colors: Record<ColorRole, string> = {
    canvas: canvasCss,
    surface: surfaceCss,
    "surface-raised": raisedCss,
    ink: inkCss,
    "ink-muted": roles["ink-muted"] ?? fallback("ink-muted", mix(ink, canvas, INK_MUTED_MIX)),
    hairline: roles.hairline ?? fallback("hairline", mix(ink, canvas, HAIRLINE_MIX)),
    primary: primaryCss,
    "primary-ink": primaryInkCss,
    accent: roles.accent ?? fallback("accent", primary),
    ...semantic(primary),
  };
  return { colors, derived, monochrome: roles.primary === undefined };
}
