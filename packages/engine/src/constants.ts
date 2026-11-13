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
 * them, the one with the most contrast against the canvas is ink. 20%: Notion's stray black text
 * is 17% of its #0d0d0d ink, example.com's real black ink 21% of its faded gray (results are the
 * same anywhere from 18% to 30% on our sites).
 */
export const INK_MIN_SHARE = 0.2;

/**
 * Ink candidates used on at least this many text elements are preferred, so one giant heading
 * can't decide ink (Medium's 120px black hero). Falls back to all candidates when none qualifies.
 */
export const INK_MIN_ELEMENTS = 2;

/**
 * Interactive elements larger than a button (the recorder's fill limit) are cards: their own
 * `color` is inherited by the content inside, not visible text, so it doesn't count for ink or
 * ink-muted. Stripe's bento-card buttons keep the browser's default black.
 */
export const TEXT_CARD_MIN_WIDTH = 480;
export const TEXT_CARD_MIN_HEIGHT = 80;

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

/** A family is "display" (or "heading") when at least this share of its weight is heading-like. */
export const DISPLAY_HEADING_SHARE = 0.8;

/**
 * Heading-like text: a heading, text inside one, or text at least this large (and larger than
 * the base body size, so 21px editorial body copy stays body).
 */
export const HEADING_LIKE_MIN_SIZE = 20;

/**
 * Non-mono families under this share of text weight are dropped. Measured on the 19 recorded
 * sites: Notion's stray Lyon Text is 1.3% (must drop); the smallest real non-mono family is
 * Allbirds' Self Modern headings (4.1%).
 */
export const FAMILY_MIN_SHARE = 0.02;

/**
 * Mono families skip the share rule (real ones are tiny: Glossier's Apercu Mono labels are 0.05%,
 * Vercel's Geist Mono 0.18%), but need at least this many visible elements, or any use inside
 * code, so one stray monospace element (a chat widget, a cookie banner) can't add a mono font.
 */
export const MONO_MIN_ELEMENTS = 3;

/** "Mona Sans VF", "Inter Variable", "sohne-var": the same family as "Mona Sans", "Inter", "sohne". */
export const VARIABLE_FONT_SUFFIX = /[\s-]+(?:vf|variable|var)$/i;

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
  "-apple-system-ui-serif": "serif",
  monospace: "mono",
  "ui-monospace": "mono",
  cursive: "display",
  fantasy: "display",
};

/**
 * Generic keywords reported under another name. The system-font aliases all mean "the OS UI
 * font", which the browser resolves per machine, so they're reported as the keyword itself.
 */
export const GENERIC_ALIAS: Record<string, string> = {
  "-apple-system": "system-ui",
  blinkmacsystemfont: "system-ui",
  "-apple-system-ui-serif": "ui-serif",
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

/**
 * On a monochrome fixture, the engine's primary passes only if it's none or below this OKLCH
 * chroma (any saturated color, e.g. a demo widget's blue, fails).
 */
export const MONOCHROME_MAX_CHROMA = 0.03;

/** Share of checks (primary, fonts, spacing base) that must pass across real sites. SPEC. */
export const ACCURACY_GATE = 0.9;

// --- primary ------------------------------------------------------------------------------

/**
 * Browser-default link colors: link, visited and active, for the light and the dark color
 * scheme (Chromium). Unstyled links aren't a design decision, so these never count as colors.
 */
export const UA_LINK_COLORS = [
  "rgb(0, 0, 238)",
  "rgb(85, 26, 139)",
  "rgb(238, 0, 0)",
  "rgb(158, 158, 255)",
  "rgb(208, 173, 240)",
  "rgb(255, 158, 158)",
] as const;

/** A text/border color this close (ΔE OK) to a browser-default link color is ignored. */
export const UA_LINK_MAX_DELTA_E = 1;

/** The first screen: elements whose top is above this (px from the top) are header/hero. */
export const FIRST_SCREEN_MAX_Y = 900;

/** A first-screen call-to-action needs a fill of at least this area (px²)… */
export const CTA_MIN_AREA = 1000;

/** …that stands out from the canvas by at least this ΔE OK (a light search bar doesn't). */
export const CTA_MIN_DELTA_E = 10;

/** When every first-screen CTA is below this chroma, the site is monochrome: no primary. */
export const CTA_NEUTRAL_CHROMA = 0.03;

/**
 * …and is opaque: paint alpha (after opacity) at least this. Every real saturated first-screen
 * CTA on our 19 sites is fully opaque; Resend's decorative gradient glow (0.44) is the only
 * translucent one.
 */
export const CTA_MIN_ALPHA = 0.9;

/** …and is button-sized: at most 480 × 80 px (the recorder's fill limit). */
export const CTA_MAX_AREA = 480 * 80;

/**
 * In primary scoring, a first-screen CTA's paint weighs this many times more. Duolingo's hero
 * green flips at ×6 and GitHub's at ×8.7 (one 7,948 px² button vs five ~17k px² violet card
 * links); no other site changes up to ×50. 12 leaves GitHub's green 30% ahead.
 */
export const CTA_WEIGHT = 12;

/**
 * Interactive elements at most this size (px) on both sides and near-square (sides within
 * SWATCH_SQUARE_TOLERANCE) are swatches, radio dots or icon buttons: they don't count for primary.
 * Glossier's red product color swatches (34×34) otherwise became its primary.
 */
export const SWATCH_MAX_SIZE = 48;
export const SWATCH_SQUARE_TOLERANCE = 4;

// --- complete system (extractSystem) ------------------------------------------------------

/** Thema's version, written to meta.version. */
export const THEMA_VERSION = "0.1.0";

/**
 * Fallback lightness steps (OKLCH L) used when a role isn't measured. Light themes step down
 * from the canvas, dark themes step up.
 */
export const SURFACE_STEP_LIGHT = 0.03;
export const SURFACE_STEP_DARK = 0.05;
export const RAISED_STEP_LIGHT = 0.02;
export const RAISED_STEP_DARK = 0.05;

/** Fallback ink when no text color is measured: near-black / near-white. */
export const FALLBACK_INK_LIGHTNESS = { light: 0.15, dark: 0.95 } as const;

/** Fallback mixes from ink toward the canvas (0 = ink, 1 = canvas). */
export const INK_MUTED_MIX = 0.45;
export const HAIRLINE_MIX = 0.85;

/**
 * Semantic colors: fixed OKLCH hues, at the primary's lightness and chroma clamped to these
 * ranges (a neutral primary uses the defaults), then clamped into sRGB.
 */
export const SEMANTIC_HUE = { success: 145, warning: 75, danger: 25, info: 250 } as const;
export const SEMANTIC_LIGHTNESS = { min: 0.5, max: 0.7, neutral: 0.6 } as const;
export const SEMANTIC_CHROMA = { min: 0.1, max: 0.18, neutral: 0.15 } as const;

/**
 * Motion isn't extracted: the recorder runs with prefers-reduced-motion: reduce (many sites switch
 * transitions off under it), and SPEC's extraction doesn't list motion. Documented defaults.
 */
export const MOTION_DEFAULTS = {
  durationFast: 150,
  durationBase: 250,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Below this many samples a recording is likely a blocked or empty page (warning). */
export const MIN_CONFIDENT_SAMPLES = 20;

// --- layout -------------------------------------------------------------------------------

/** A page container is at least this wide (narrower centered boxes are cards or columns). */
export const CONTAINER_MIN_WIDTH = 600;

/** A box is horizontally centered when its left and right margins differ by at most this. */
export const CENTER_TOLERANCE_PX = 2;

/** A container leaves at least this much on each side; wider boxes are full-width (Linear 1436). */
export const CONTAINER_MIN_MARGIN = 16;

/** A capped container width must appear on at least this many element styles to win. */
export const CAPPED_MIN_COUNT = 2;

/** Side padding below this is a border trick, not a gutter (Vercel's 1px). */
export const GUTTER_MIN = 8;

/** Section spacing: top padding of at least this, on boxes at least this share of the page wide. */
export const SECTION_MIN_PADDING = 32;
export const SECTION_MIN_WIDTH_SHARE = 0.6;

/** Used when the samples give no evidence (synthetic fixtures, recordings without boxes). */
export const LAYOUT_DEFAULTS = { containerMax: 1280, gutter: 24, sectionY: 64 } as const;

// --- blend --------------------------------------------------------------------------------

/** A project blends 1 to this many references (SPEC: up to 5 URLs). */
export const MAX_REFERENCES = 5;

/** density -1 … +1 scales the spacing scale by these factors (SPEC: 0.8–1.25×). */
export const DENSITY_MIN_FACTOR = 0.8;
export const DENSITY_MAX_FACTOR = 1.25;

/** contrast ±1 moves ink and canvas this much OKLCH lightness apart or together, each. */
export const CONTRAST_MAX_SHIFT = 0.1;

/**
 * warmth ±1 rotates tinted neutrals up to this many degrees toward the warm or cool hue, and tints
 * pure grays (chroma < NEUTRAL_TINT_MIN_CHROMA) up to WARMTH_MAX_CHROMA at that hue.
 */
export const WARMTH_MAX_ROTATION = 10;
export const WARMTH_MAX_CHROMA = 0.01;
export const NEUTRAL_TINT_MIN_CHROMA = 0.005;
export const WARM_HUE = 70;
export const COOL_HUE = 250;

/**
 * Harmonize: a foreground color closer than this to the canvas (ΔE OK) clashes, the same bar as
 * a call-to-action fill that stands out (CTA_MIN_DELTA_E). Lightness moves in this step.
 */
export const HARMONY_MIN_DELTA_E = 10;
export const HARMONY_STEP = 0.005;

// --- fix (accessibility) ------------------------------------------------------------------

/** WCAG 2.2 AA: body text 4.5:1; large text and UI components 3:1. */
export const TEXT_CONTRAST = 4.5;
export const UI_CONTRAST = 3;

/** Nudges move OKLCH lightness in this step (the 3-decimal precision colors are stored at). */
export const NUDGE_STEP = 0.001;

/**
 * A missing theme mirrors neutral lightness within this range (L' = lo + hi − L): white becomes
 * ~0.12, ink 0.2 becomes 0.92, and back. Light → dark also scales chroma on canvas and surfaces.
 */
export const MIRROR_LIGHTNESS = { lo: 0.14, hi: 0.98 } as const;
export const DARK_SURFACE_CHROMA_FACTOR = 0.5;
