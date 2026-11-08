import { converter, differenceEuclidean, parse, type Oklch } from "culori";

export type { Oklch };

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const oklabDistance = differenceEuclidean("oklab");

/**
 * Parse a computed CSS color into OKLCH.
 * Returns null for unparseable input and for fully transparent colors.
 */
export function parseCssColor(css: string): Oklch | null {
  const parsed = parse(css.trim());
  if (!parsed) return null;
  if (parsed.alpha === 0) return null;
  return toOklch(parsed);
}

/** Opacity of a color, 1 when unspecified. */
export function alphaOf(color: Oklch): number {
  return color.alpha ?? 1;
}

/** Perceptual distance ΔE OK: Euclidean distance in OKLab, scaled ×100 (white↔black ≈ 100). */
export function deltaEOK(a: Oklch, b: Oklch): number {
  return oklabDistance(a, b) * 100;
}

/** Shortest angle between two hues in degrees (0–180). A hueless color counts as hue 0. */
export function hueDelta(a: Oklch, b: Oklch): number {
  const diff = Math.abs((a.h ?? 0) - (b.h ?? 0)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Flatten a translucent color onto an opaque backdrop, blending in sRGB as browsers do. */
export function compositeOver(color: Oklch, backdrop: Oklch): Oklch {
  const a = alphaOf(color);
  if (a >= 1) return color;
  const fg = toRgb(color);
  const bg = toRgb(backdrop);
  return toOklch({
    mode: "rgb",
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  });
}

/** Round to `digits` decimals, never returning -0. */
export function round(value: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Format as "oklch(L C H)": L and C to 3 dp, H to 1 dp, H = 0 for hueless colors.
 * Translucent colors get an alpha to 2 dp: "oklch(L C H / 0.06)".
 */
export function formatOklch(color: Oklch): string {
  const l = round(Math.min(1, Math.max(0, color.l)), 3);
  const c = round(Math.max(0, color.c), 3);
  const h = c === 0 || color.h === undefined || Number.isNaN(color.h) ? 0 : round(color.h, 1);
  const a = round(alphaOf(color), 2);
  const alpha = a < 1 ? ` / ${a}` : "";
  return `oklch(${l} ${c} ${h === 360 ? 0 : h}${alpha})`;
}
