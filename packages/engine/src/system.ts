import { MIN_CONFIDENT_SAMPLES, MOTION_DEFAULTS, THEMA_VERSION } from "./constants.js";
import { canvasFlipsInDark } from "./dark.js";
import { analyzeLayout } from "./layout.js";
import { completePalette } from "./palette.js";
import { sampleRole } from "./samples.js";
import { analyzeRadius, analyzeShadow } from "./shape.js";
import { analyzeSpacing } from "./spacing.js";
import type { SourceRef, StyleSample, ThemaSystem } from "./types.js";
import { analyzeTypography } from "./typography.js";

/**
 * Reasons to trust an extraction less. Not part of ThemaSystem: the app shows them next to the
 * reference so the user can re-record or pick another page.
 * - no-headings: no h1–h6 at all; the page may be a variant or a placeholder (Substack).
 * - few-samples: likely a blocked, bot-check or empty page.
 * - no-dark-theme: color.dark is a copy of color.light until the fixer generates one.
 * - monochrome: no saturated primary; primary is the neutral first-screen CTA (or ink).
 */
export type ExtractWarning = "no-headings" | "few-samples" | "no-dark-theme" | "monochrome";

export interface ExtractInput {
  /** Samples from the light-scheme pass. */
  samples: readonly StyleSample[];
  /** Samples from the dark-scheme pass, if the worker kept them. */
  darkSamples?: readonly StyleSample[];
  source: SourceRef;
  /** Display name, e.g. the site's host. */
  name: string;
  /** ISO timestamp, passed in: the engine has no clock. */
  createdAt: string;
}

export interface ExtractResult {
  system: ThemaSystem;
  warnings: ExtractWarning[];
  /** Token paths filled by a fallback rule or default instead of measured, e.g. "layout.gutter". */
  derived: string[];
}

/**
 * One complete ThemaSystem for one reference, from its recorded samples. Pure and
 * deterministic. Colors, typography, spacing and shape come from the analyzers; layout from
 * element boxes; motion is a documented default (not extracted). voice is left empty (no LLM in
 * the engine), there are no locks, and a11y is filled in by the fixer.
 */
export function extractSystem(input: ExtractInput): ExtractResult {
  const { samples, darkSamples, source, name, createdAt } = input;
  const warnings: ExtractWarning[] = [];
  const derived: string[] = [];

  const light = completePalette(samples);
  derived.push(...light.derived.map((role) => `color.light.${role}`));

  const hasDark = darkSamples !== undefined && canvasFlipsInDark(samples, darkSamples);
  const dark = hasDark ? completePalette(darkSamples) : null;
  if (dark) derived.push(...dark.derived.map((role) => `color.dark.${role}`));
  else warnings.push("no-dark-theme");

  const layout = analyzeLayout(samples);
  derived.push(...layout.derived.map((key) => `layout.${key}`));
  derived.push(...Object.keys(MOTION_DEFAULTS).map((key) => `motion.${key}`));

  if (!samples.some((s) => sampleRole(s) === "heading" || s.inHeading === true)) {
    warnings.push("no-headings");
  }
  if (samples.length < MIN_CONFIDENT_SAMPLES) warnings.push("few-samples");
  if (light.monochrome) warnings.push("monochrome");

  const system: ThemaSystem = {
    meta: { name, version: THEMA_VERSION, sources: [source], createdAt },
    color: { light: light.colors, dark: dark ? dark.colors : { ...light.colors } },
    typography: analyzeTypography(samples),
    spacing: analyzeSpacing(samples),
    radius: analyzeRadius(samples),
    shadow: analyzeShadow(samples),
    layout: layout.layout,
    motion: { ...MOTION_DEFAULTS },
    voice: { mood: [], summary: "" },
    a11y: { fixes: [], passes: false },
    locks: [],
  };
  return { system, warnings, derived };
}
