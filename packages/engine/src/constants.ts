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
