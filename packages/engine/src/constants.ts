import type { StyleSample } from "./types.js";

export type SampleRole = NonNullable<StyleSample["role"]>;

/** How much a sample's area counts, by element importance (SPEC → Extraction engine). */
export const ROLE_WEIGHT: Record<SampleRole, number> = {
  interactive: 3,
  heading: 2,
  body: 1,
  container: 1,
};

/** Fallback role when the worker sends none. Tags not listed here count as "body". */
export const TAG_ROLE: Record<string, SampleRole> = {
  button: "interactive",
  a: "interactive",
  input: "interactive",
  select: "interactive",
  textarea: "interactive",
  summary: "interactive",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
};

/** Colors closer than this (ΔE OK, OKLab Euclidean × 100) merge into one cluster. From SPEC. */
export const CLUSTER_DELTA_E = 4;

/** OKLCH chroma at or above this counts as "saturated"; below it, "neutral". */
export const SATURATED_CHROMA = 0.06;

/**
 * Ink candidates must carry at least this share of the heaviest text color's weight; among
 * them, the one with the most contrast against the canvas is ink.
 */
export const INK_MIN_SHARE = 0.15;

/** A surface must sit within this ΔE OK of the canvas. */
export const SURFACE_MAX_DELTA_E = 15;

/**
 * The accent's hue must differ from the primary's by at least this many degrees.
 * Hue, not ΔE: hover/active shades of the primary sit 6–10 ΔE away at the same hue,
 * while a real accent like blue → violet can be only ~12 ΔE away but ~30° apart.
 */
export const ACCENT_MIN_HUE_DELTA = 20;

/**
 * A saturated color needs this many distinct samples to get its full score for primary/accent.
 * Fewer samples scale the score down linearly, so a one-off cookie button or ad badge can't win.
 */
export const OCCURRENCE_TARGET = 3;

// --- typography ---------------------------------------------------------------------------

/** Font sizes with less than this share of total text weight are outliers and dropped. */
export const MIN_SIZE_SHARE = 0.01;

/** A family is "display" when at least this share of its weight comes from headings. */
export const DISPLAY_HEADING_SHARE = 0.8;

/** Scale slots on each side of base: xs, sm below; lg … 4xl above. */
export const MAX_STEPS_BELOW = 2;
export const MAX_STEPS_ABOVE = 5;

/** Generic CSS font keywords and the category they imply. */
export const GENERIC_FAMILY: Record<string, "sans" | "serif" | "mono" | "display"> = {
  "sans-serif": "sans",
  "system-ui": "sans",
  "ui-sans-serif": "sans",
  "-apple-system": "sans",
  blinkmacsystemfont: "sans",
  "ui-rounded": "sans",
  serif: "serif",
  "ui-serif": "serif",
  monospace: "mono",
  "ui-monospace": "mono",
  cursive: "display",
  fantasy: "display",
};

/** Used to classify a family when its stack has no generic fallback. */
export const MONO_NAME = /mono|code|consol|courier|menlo/i;
export const SERIF_NAME =
  /(?<!sans[\s-]?)serif|georgia|times|garamond|baskerville|playfair|lora|merriweather/i;

/** Icon fonts are never text families. */
export const ICON_FONT_NAME = /icon|awesome|symbols/i;

// --- spacing ------------------------------------------------------------------------------

/** Spacing values above this are layout sizes, not spacing tokens. */
export const SPACING_MAX_PX = 256;

/** A spacing value must appear on at least this many samples to count. */
export const SPACING_MIN_COUNT = 2;

/** Base is 8 when at least this share of common values are multiples of 8; otherwise 4. */
export const BASE8_SHARE = 0.75;

// --- shape --------------------------------------------------------------------------------

/** Radii at or above this are pills; they map to `full` and don't affect sm/md/lg. */
export const PILL_RADIUS_MIN = 500;

// --- dark mode ----------------------------------------------------------------------------

/** OKLCH lightness dividing light from dark canvases, for detecting a dark theme. */
export const DARK_CANVAS_LIGHTNESS = 0.5;

// --- accuracy (week-2 gate) ---------------------------------------------------------------

/** A recorded site's primary is correct when within this ΔE OK of the hand-verified value. */
export const PRIMARY_MAX_DELTA_E = 5;

/** Share of checks (primary, fonts, spacing base) that must pass across real sites. SPEC. */
export const ACCURACY_GATE = 0.9;
