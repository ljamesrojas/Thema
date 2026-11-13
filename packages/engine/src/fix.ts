import { wcagContrast } from "culori";
import { formatInSrgb, parseCssColor, type Oklch } from "./color-math.js";
import {
  DARK_CANVAS_LIGHTNESS,
  DARK_SURFACE_CHROMA_FACTOR,
  MIRROR_LIGHTNESS,
  NUDGE_STEP,
  SATURATED_CHROMA,
  CONTRAST_MARGIN,
  TEXT_CONTRAST,
  UI_CONTRAST,
} from "./constants.js";
import type { ColorRole, ContrastFix, ThemaSystem } from "./types.js";

type Theme = "light" | "dark";
type Colors = Record<ColorRole, string>;

export interface CheckedPair {
  /** The color that moves when the pair fails. */
  fg: ColorRole;
  bg: ColorRole;
  /** Minimum WCAG contrast ratio. */
  min: number;
}

/**
 * Every pair the fixer checks, in the order it fixes them: primary and accent first (as UI
 * components), so primary-ink is checked against the final primary. Hairlines aren't checked:
 * decorative borders are meant to be faint.
 */
export const CHECKED_PAIRS: readonly CheckedPair[] = [
  { fg: "primary", bg: "canvas", min: UI_CONTRAST },
  { fg: "accent", bg: "canvas", min: UI_CONTRAST },
  { fg: "primary-ink", bg: "primary", min: TEXT_CONTRAST },
  { fg: "ink", bg: "canvas", min: TEXT_CONTRAST },
  { fg: "ink", bg: "surface", min: TEXT_CONTRAST },
  { fg: "ink", bg: "surface-raised", min: TEXT_CONTRAST },
  { fg: "ink-muted", bg: "canvas", min: TEXT_CONTRAST },
  { fg: "ink-muted", bg: "surface", min: TEXT_CONTRAST },
  // Semantic colors are used as message text ("Payment failed").
  { fg: "success", bg: "canvas", min: TEXT_CONTRAST },
  { fg: "warning", bg: "canvas", min: TEXT_CONTRAST },
  { fg: "danger", bg: "canvas", min: TEXT_CONTRAST },
  { fg: "info", bg: "canvas", min: TEXT_CONTRAST },
];

/** A pair that still fails after fixing. */
export interface UnresolvedPair {
  theme: Theme;
  pair: [ColorRole, ColorRole];
  ratio: number;
  min: number;
  /** locked: the color that would move is locked; out-of-range: no lightness passes. */
  reason: "locked" | "out-of-range";
}

export interface FixResult {
  /** The system with colors fixed and a11y filled in (fixes + passes). */
  system: ThemaSystem;
  /** Which theme was generated because no source provided it, if any. */
  generated: Theme | null;
  unresolved: UnresolvedPair[];
}

const THEMES: readonly Theme[] = ["light", "dark"];
const NEUTRAL_ROLES: readonly ColorRole[] = [
  "canvas",
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "hairline",
];
const LARGE_SURFACES: readonly ColorRole[] = ["canvas", "surface", "surface-raised"];
/** Roles mirrored when neutral; primary-ink is re-chosen afterwards instead. */
const MIRRORED_ROLES: readonly ColorRole[] = [...NEUTRAL_ROLES, "primary", "accent"];

const parse = (css: string): Oklch => {
  const color = parseCssColor(css);
  if (!color) throw new Error(`fix: unparseable color ${css}`);
  return color;
};
const contrast = (a: string, b: string): number => wcagContrast(a, b);
const round2 = (v: number): number => Math.round(v * 100) / 100;
const sameColors = (a: Colors, b: Colors): boolean =>
  (Object.keys(a) as ColorRole[]).every((role) => a[role] === b[role]);

/**
 * The missing theme from the measured one: every neutral color's lightness is mirrored within
 * MIRROR_LIGHTNESS (chroma scaled down on large surfaces when going dark), including a neutral
 * primary or accent (a monochrome site's black buttons turn white). Saturated roles keep their
 * hue and lightness for the contrast pass to tune; primary-ink is re-chosen as canvas or ink.
 */
function mirrorTheme(measured: Colors, toDark: boolean): Colors {
  const out = { ...measured };
  for (const role of MIRRORED_ROLES) {
    const color = parse(measured[role]);
    if (color.c >= SATURATED_CHROMA) continue;
    const l = Math.min(1, Math.max(0, MIRROR_LIGHTNESS.lo + MIRROR_LIGHTNESS.hi - color.l));
    const c =
      toDark && LARGE_SURFACES.includes(role) ? color.c * DARK_SURFACE_CHROMA_FACTOR : color.c;
    out[role] = formatInSrgb({ ...color, l, c });
  }
  out["primary-ink"] =
    contrast(out.canvas, out.primary) >= contrast(out.ink, out.primary) ? out.canvas : out.ink;
  return out;
}

/**
 * The lightness closest to the color's own that reaches `min` against `bg`, searched in
 * NUDGE_STEP steps in both directions; hue kept, chroma clamped into sRGB. null if none passes.
 */
function nudge(css: string, bg: string, min: number): string | null {
  const color = parse(css);
  const steps = Math.ceil(1 / NUDGE_STEP);
  for (let i = 1; i <= steps; i++) {
    for (const direction of [-1, 1]) {
      const l = Math.round((color.l + direction * i * NUDGE_STEP) * 1000) / 1000;
      if (l < 0 || l > 1) continue;
      const candidate = formatInSrgb({ ...color, l });
      if (contrast(candidate, bg) >= min) return candidate;
    }
  }
  return null;
}

/**
 * Check every text/background pair against WCAG 2.2 AA and fix failures with the smallest
 * lightness change to the foreground color (canvas and surfaces stay put). Locked tokens never
 * change: a pair a lock blocks is reported in `unresolved`. When no source provided a theme
 * (color.dark is a copy of color.light), the missing one is generated first: dark from light, or
 * light from a dark-only site's palette, which then becomes `dark`. Pure and deterministic.
 */
export function fix(input: ThemaSystem): FixResult {
  const system = JSON.parse(JSON.stringify(input)) as ThemaSystem;
  const locked = new Set(system.locks);
  const isLocked = (theme: Theme, role: ColorRole) => locked.has(`color.${theme}.${role}`);

  // 1. The missing theme. Locked colors keep their value.
  let generated: Theme | null = null;
  if (sameColors(system.color.light, system.color.dark)) {
    const measured = system.color.light;
    const darkOnly = parse(measured.canvas).l < DARK_CANVAS_LIGHTNESS;
    generated = darkOnly ? "light" : "dark";
    const mirrored = mirrorTheme(measured, !darkOnly);
    system.color = darkOnly
      ? { light: mirrored, dark: { ...measured } }
      : { light: { ...measured }, dark: mirrored };
    for (const theme of THEMES) {
      for (const role of Object.keys(input.color[theme]) as ColorRole[]) {
        if (isLocked(theme, role)) system.color[theme][role] = input.color[theme][role];
      }
    }
  }

  // 2. Contrast, pair by pair, in CHECKED_PAIRS order.
  const fixes: ContrastFix[] = [];
  for (const theme of THEMES) {
    const colors = system.color[theme];
    for (const { fg, bg, min } of CHECKED_PAIRS) {
      const before = contrast(colors[fg], colors[bg]);
      // Aim a little above the minimum so the pair survives export to 8-bit hex.
      const target = min + CONTRAST_MARGIN;
      if (before >= target || isLocked(theme, fg)) continue;
      const fixed = nudge(colors[fg], colors[bg], target);
      if (fixed === null) continue;
      colors[fg] = fixed;
      fixes.push({
        pair: [fg, bg],
        theme,
        before: round2(before),
        after: round2(contrast(fixed, colors[bg])),
      });
    }
  }

  // 3. Final check: anything still failing is unresolved.
  const unresolved: UnresolvedPair[] = [];
  for (const theme of THEMES) {
    const colors = system.color[theme];
    for (const { fg, bg, min } of CHECKED_PAIRS) {
      const ratio = contrast(colors[fg], colors[bg]);
      if (ratio >= min) continue;
      unresolved.push({
        theme,
        pair: [fg, bg],
        ratio: round2(ratio),
        min,
        reason: isLocked(theme, fg) ? "locked" : "out-of-range",
      });
    }
  }

  system.a11y = { fixes, passes: unresolved.length === 0 };
  return { system, generated, unresolved };
}
