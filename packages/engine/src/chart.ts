import { wcagContrast } from "culori";
import { deltaEOK, formatInSrgb, hueDelta, parseCssColor, type Oklch } from "./color-math.js";
import {
  ACCENT_MIN_HUE_DELTA,
  CHART_COUNT,
  CHART_HUE_STEP,
  CHART_LIGHTNESS_STEP,
  CHART_MIN_CHROMA,
  CHART_MIN_DELTA_E,
  CONTRAST_MARGIN,
  NUDGE_STEP,
  SATURATED_CHROMA,
  UI_CONTRAST,
} from "./constants.js";
import type { ColorRole } from "./types.js";

type Colors = Record<ColorRole, string>;
type Passes = (css: string) => boolean;

const parse = (css: string): Oklch => {
  const color = parseCssColor(css);
  if (!color) throw new Error(`chartColors: unparseable color ${css}`);
  return color;
};

/** Chart marks are graphics: WCAG 1.4.11 asks 3:1 against what they sit on (+ the hex margin). */
const MIN = UI_CONTRAST + CONTRAST_MARGIN;

/**
 * Five chart colors for one theme (shadcn's --chart-1..5), derived from the system so charts
 * follow the brand instead of borrowing status colors. Every color reaches 3:1 against both the
 * canvas and raised cards (where charts sit).
 *
 * - chart-1 is primary.
 * - chart-2 is the accent when it's a real second color: saturated, ≥ CHART_MIN_DELTA_E from
 *   primary and, next to a saturated primary, ≥ ACCENT_MIN_HUE_DELTA around the wheel.
 * - Saturated primary: the rest are hues CHART_HUE_STEP apart around the wheel from primary
 *   (with an accent, the wheel hue nearest it is skipped), at least CHART_MIN_CHROMA, at the
 *   lightness closest to primary's where that chroma fits in sRGB.
 * - Neutral primary (a black-and-white site): the rest are its grays, evenly spaced toward
 *   whichever end of the passing lightness range is farther away.
 *
 * Colors that fail move by the smallest lightness change. Pure and deterministic.
 */
export function chartColors(colors: Colors): string[] {
  const backgrounds = [colors.canvas, colors["surface-raised"]];
  const passes: Passes = (css) => backgrounds.every((bg) => wcagContrast(css, bg) >= MIN);
  const settle = (css: string) => (passes(css) ? css : (nudge(css, passes) ?? css));

  const first = settle(colors.primary);
  const primary = parse(first);
  const saturated = primary.c >= SATURATED_CHROMA;
  const out = [first];

  const accentCss = settle(colors.accent);
  const accent = parse(accentCss);
  const useAccent =
    accent.c >= SATURATED_CHROMA &&
    deltaEOK(accent, primary) >= CHART_MIN_DELTA_E &&
    (!saturated || hueDelta(accent, primary) >= ACCENT_MIN_HUE_DELTA);
  if (useAccent) out.push(accentCss);
  const remaining = CHART_COUNT - out.length;

  if (!saturated) {
    for (const l of grayLightnesses(primary, passes, remaining)) {
      out.push(formatInSrgb({ ...primary, l }));
    }
    return out;
  }

  let hues = [1, 2, 3, 4].map((k) => ((primary.h ?? 0) + k * CHART_HUE_STEP) % 360);
  if (useAccent) {
    const away = (h: number) => hueDelta({ ...accent, h }, accent);
    const nearest = hues.reduce((best, h) => (away(h) < away(best) ? h : best));
    hues = hues.filter((h) => h !== nearest);
  }
  const c = Math.max(primary.c, CHART_MIN_CHROMA);
  for (const h of hues.slice(0, remaining)) {
    out.push(
      vivid({ mode: "oklch", l: primary.l, c, h }, passes) ??
        settle(formatInSrgb({ mode: "oklch", l: primary.l, c, h })),
    );
  }
  return out;
}

/**
 * The lightness closest to the color's own (in CHART_LIGHTNESS_STEP steps) where it passes and
 * still has CHART_MIN_CHROMA inside sRGB: a light yellow primary's blue can't be colorful at
 * the yellow's lightness. null if no lightness does both.
 */
function vivid(color: Oklch, passes: Passes): string | null {
  const steps = Math.ceil(1 / CHART_LIGHTNESS_STEP);
  for (let i = 0; i <= steps; i++) {
    for (const direction of i === 0 ? [0] : [-1, 1]) {
      const l = Math.round((color.l + direction * i * CHART_LIGHTNESS_STEP) * 1000) / 1000;
      if (l < 0 || l > 1) continue;
      const candidate = formatInSrgb({ ...color, l });
      if (parse(candidate).c >= CHART_MIN_CHROMA && passes(candidate)) return candidate;
    }
  }
  return null;
}

/** The lightness closest to the color's own that `passes`, hue kept; null if none does. */
function nudge(css: string, passes: Passes): string | null {
  const color = parse(css);
  const steps = Math.ceil(1 / NUDGE_STEP);
  for (let i = 1; i <= steps; i++) {
    for (const direction of [-1, 1]) {
      const l = Math.round((color.l + direction * i * NUDGE_STEP) * 1000) / 1000;
      if (l < 0 || l > 1) continue;
      const candidate = formatInSrgb({ ...color, l });
      if (passes(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * `count` lightnesses for grays after the primary: from its lightness, the passing range runs
 * one way to the last lightness that still passes and the other way to 0 or 1; the steps go
 * evenly toward whichever end is farther, so the grays stay as far apart as possible.
 */
function grayLightnesses(primary: Oklch, passes: Passes, count: number): number[] {
  const reach = (direction: 1 | -1) => {
    let l = primary.l;
    for (;;) {
      const next = Math.round((l + direction * NUDGE_STEP) * 1000) / 1000;
      if (next < 0 || next > 1 || !passes(formatInSrgb({ ...primary, l: next }))) return l;
      l = next;
    }
  };
  const up = reach(1);
  const down = reach(-1);
  const end = up - primary.l >= primary.l - down ? up : down;
  return Array.from(
    { length: count },
    (_, i) => Math.round((primary.l + ((end - primary.l) * (i + 1)) / count) * 1000) / 1000,
  );
}
