import { formatOklch, parseCssColor } from "./color-math.js";
import { PILL_RADIUS_MIN } from "./constants.js";
import type { StyleSample, ThemaSystem } from "./types.js";

type Radius = ThemaSystem["radius"];
type Shadow = ThemaSystem["shadow"];

interface Candidate<T> {
  value: T;
  /** Number of samples using it. */
  count: number;
  /** Where it sits on the small → large axis. */
  size: number;
  /** Final tie-break, so the result never depends on sample order. */
  key: string;
}

/**
 * Choose sm / md / lg from candidates without inventing values:
 * md is the most common; sm is the most common smaller one and lg the most common larger
 * one (ties go to the one closer to md). A missing sm or lg falls back to md.
 */
function pickSteps<T>(candidates: readonly Candidate<T>[]): { sm: T; md: T; lg: T } | null {
  const byCount = (target: number) => (a: Candidate<T>, b: Candidate<T>) =>
    b.count - a.count ||
    Math.abs(a.size - target) - Math.abs(b.size - target) ||
    a.size - b.size ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

  const md = [...candidates].sort(byCount(0))[0];
  if (!md) return null;
  const sm = candidates.filter((c) => c.size < md.size).sort(byCount(md.size))[0] ?? md;
  const lg = candidates.filter((c) => c.size > md.size).sort(byCount(md.size))[0] ?? md;
  return { sm: sm.value, md: md.value, lg: lg.value };
}

// --- radius -------------------------------------------------------------------------------

/**
 * Derive radius sm / md / lg (px) from border radii. Zero (not a box) and pills (≥ 500px,
 * covered by `full`) are skipped. With no radii at all, every step is 0.
 */
export function analyzeRadius(samples: readonly StyleSample[]): Radius {
  const counts = new Map<number, number>();
  for (const sample of samples) {
    const r = Math.round(sample.borderRadius);
    if (r > 0 && r < PILL_RADIUS_MIN) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const steps = pickSteps(
    [...counts].map(([r, count]) => ({ value: r, count, size: r, key: String(r) })),
  );
  return { ...(steps ?? { sm: 0, md: 0, lg: 0 }), full: 9999 };
}

// --- shadow -------------------------------------------------------------------------------

/** Split at commas that aren't inside parentheses, e.g. between shadow layers. */
function splitTopLevel(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of css) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Split at whitespace that isn't inside parentheses. */
function tokens(layer: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of layer) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (current) out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

const LENGTH = /^-?(\d+(\.\d+)?|\.\d+)(px)?$/;

export interface ShadowLayer {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** OKLCH string, with alpha when translucent. */
  color: string;
}

/**
 * Parse a computed `box-shadow` into layers. The color may come first (Chrome's computed form)
 * or last. Layers without a visible color are dropped. Returns [] for "none".
 */
export function parseBoxShadow(css: string): ShadowLayer[] {
  if (css.trim().toLowerCase() === "none") return [];
  const layers: ShadowLayer[] = [];
  for (const layer of splitTopLevel(css)) {
    let inset = false;
    let color: string | undefined;
    const lengths: number[] = [];
    for (const token of tokens(layer)) {
      if (token.toLowerCase() === "inset") inset = true;
      else if (LENGTH.test(token)) lengths.push(Number.parseFloat(token));
      else {
        const parsed = parseCssColor(token);
        if (parsed) color = formatOklch(parsed);
      }
    }
    const [x, y, blur = 0, spread = 0] = lengths;
    if (color === undefined || x === undefined || y === undefined) continue;
    layers.push({ inset, x, y, blur, spread, color });
  }
  return layers;
}

/** Canonical form: "inset? x y blur spread color" per layer, joined with ", ". */
export function formatBoxShadow(layers: readonly ShadowLayer[]): string {
  return layers
    .map((l) => `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`)
    .join(", ");
}

/**
 * Derive shadow sm / md / lg from box shadows, normalized with OKLCH colors.
 * Inset-only shadows aren't elevation and are skipped. Ranked by the largest outer layer's
 * blur + |y|. With no shadows, every step is "none".
 */
export function analyzeShadow(samples: readonly StyleSample[]): Shadow {
  const found = new Map<string, Candidate<string>>();
  for (const sample of samples) {
    if (sample.boxShadow === undefined) continue;
    const layers = parseBoxShadow(sample.boxShadow);
    const outer = layers.filter((l) => !l.inset);
    if (outer.length === 0) continue;
    const value = formatBoxShadow(layers);
    const size = Math.max(...outer.map((l) => l.blur + Math.abs(l.y)));
    const entry = found.get(value) ?? { value, count: 0, size, key: value };
    entry.count++;
    found.set(value, entry);
  }
  return pickSteps([...found.values()]) ?? { sm: "none", md: "none", lg: "none" };
}
