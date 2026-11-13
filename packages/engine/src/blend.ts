import { deltaEOK, formatInSrgb, parseCssColor, type Oklch } from "./color-math.js";
import {
  CONTRAST_MAX_SHIFT,
  COOL_HUE,
  DENSITY_MAX_FACTOR,
  DENSITY_MIN_FACTOR,
  HARMONY_MIN_DELTA_E,
  HARMONY_STEP,
  MAX_REFERENCES,
  NEUTRAL_TINT_MIN_CHROMA,
  SATURATED_CHROMA,
  THEMA_VERSION,
  WARM_HUE,
  WARMTH_MAX_CHROMA,
  WARMTH_MAX_ROTATION,
} from "./constants.js";
import type { BlendSettings, BorrowTag, ColorRole, SourceRef, ThemaSystem } from "./types.js";

export interface BlendReference {
  /** The reference's extracted system (extractSystem). */
  system: ThemaSystem;
  /** Tags this reference claims; tags nobody claims go to the first reference. */
  borrowed: readonly BorrowTag[];
}

export interface BlendInput {
  /** 1 to MAX_REFERENCES references, in the order the user added them. */
  references: readonly BlendReference[];
  settings: BlendSettings;
  /** Token paths to keep, e.g. "color.light.primary"; their values come from `previous`. */
  locks?: readonly string[];
  /** The system the user locked tokens in (usually the last blend). */
  previous?: ThemaSystem;
  name: string;
  /** ISO timestamp, passed in: the engine has no clock. */
  createdAt: string;
}

/** A color harmonize moved away from the canvas. */
export interface ColorAdjustment {
  path: string;
  before: string;
  after: string;
}

export interface BlendResult {
  system: ThemaSystem;
  /** Unlocked colors moved away from a canvas they clashed with. */
  adjustments: ColorAdjustment[];
  /** Locked colors that clash with the canvas: left alone, reported for the user. */
  lockedClashes: string[];
  /** Lock paths that don't name a token value in `previous` (or there's no `previous`). */
  ignoredLocks: string[];
}

const TAGS: readonly BorrowTag[] = ["colors", "typography", "spacing", "shape", "layout"];
const THEMES = ["light", "dark"] as const;
const NEUTRAL_ROLES: readonly ColorRole[] = [
  "canvas",
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "hairline",
];
const FOREGROUND_ROLES: readonly ColorRole[] = [
  "ink",
  "ink-muted",
  "primary",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
];
const PILL = 9999;

type Colors = Record<ColorRole, string>;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** ThemaSystem is plain JSON, so a JSON round trip is a full copy. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const parse = (css: string): Oklch => {
  const color = parseCssColor(css);
  if (!color) throw new Error(`blend: unparseable color ${css}`);
  return color;
};

/** Which reference owns each tag: the first one to claim it, else the first reference. */
function owners(references: readonly BlendReference[]): Record<BorrowTag, number> {
  const owner = Object.fromEntries(TAGS.map((tag) => [tag, -1])) as Record<BorrowTag, number>;
  references.forEach((ref, i) => {
    for (const tag of ref.borrowed) if (owner[tag] === -1) owner[tag] = i;
  });
  for (const tag of TAGS) if (owner[tag] === -1) owner[tag] = 0;
  return owner;
}

// --- sliders ------------------------------------------------------------------------------

/** density: the spacing scale × 0.8 … 1.25, snapped to the base so the grid holds. */
function applyDensity(spacing: ThemaSystem["spacing"], density: number): ThemaSystem["spacing"] {
  if (density === 0) return spacing;
  const factor =
    density > 0 ? 1 + (DENSITY_MAX_FACTOR - 1) * density : 1 + (1 - DENSITY_MIN_FACTOR) * density;
  const { base } = spacing;
  const scaled = spacing.scale.map((v) => Math.max(base, Math.round((v * factor) / base) * base));
  return { base, scale: [...new Set(scaled)].sort((a, b) => a - b) };
}

/** roundness: linear down to 0 (square) at -1; a log curve up to pill (9999) at +1. */
function roundValue(value: number, roundness: number): number {
  if (roundness <= -1) return 0;
  if (roundness < 0) return Math.round(value * (1 + roundness));
  if (roundness >= 1) return PILL;
  if (roundness === 0) return value;
  const from = Math.log(Math.max(value, 1));
  return Math.round(Math.exp(from + roundness * (Math.log(PILL) - from)));
}

/** contrast: ink and canvas move apart (+) or together (-) by up to CONTRAST_MAX_SHIFT each. */
function applyContrast(colors: Colors, contrast: number): void {
  if (contrast === 0) return;
  const canvas = parse(colors.canvas);
  const ink = parse(colors.ink);
  const shift = CONTRAST_MAX_SHIFT * contrast;
  const inkIsDarker = ink.l < canvas.l;
  colors.ink = formatInSrgb({ ...ink, l: clamp(ink.l + (inkIsDarker ? -shift : shift), 0, 1) });
  colors.canvas = formatInSrgb({
    ...canvas,
    l: clamp(canvas.l + (inkIsDarker ? shift : -shift), 0, 1),
  });
}

/**
 * warmth: neutral roles turn warm (+, toward hue 70) or cool (-, toward 250). Tinted neutrals
 * rotate up to 10° toward that hue; pure grays get a tint of up to chroma 0.01 at it.
 */
function applyWarmth(colors: Colors, warmth: number): void {
  if (warmth === 0) return;
  const target = warmth > 0 ? WARM_HUE : COOL_HUE;
  const amount = Math.abs(warmth);
  for (const role of NEUTRAL_ROLES) {
    const color = parse(colors[role]);
    if (color.c >= SATURATED_CHROMA) continue;
    if (color.c < NEUTRAL_TINT_MIN_CHROMA) {
      colors[role] = formatInSrgb({ ...color, c: WARMTH_MAX_CHROMA * amount, h: target });
      continue;
    }
    const hue = color.h ?? target;
    const toward = ((((target - hue + 540) % 360) + 360) % 360) - 180; // signed, -180 … 180
    const step = Math.sign(toward) * Math.min(WARMTH_MAX_ROTATION * amount, Math.abs(toward));
    colors[role] = formatInSrgb({ ...color, h: (hue + step + 360) % 360 });
  }
}

// --- locks --------------------------------------------------------------------------------

function getAt(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function setAt(root: object, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop();
  if (last === undefined) return;
  let node = root as Record<string, unknown>;
  for (const key of keys) node = node[key] as Record<string, unknown>;
  node[last] = value;
}

/** A lockable token: a value (string, number or array), not a group like "radius". */
const isTokenValue = (value: unknown): boolean =>
  value !== undefined && (Array.isArray(value) || typeof value !== "object" || value === null);

// --- harmonize ----------------------------------------------------------------------------

/**
 * Move an unlocked foreground color's lightness away from the canvas, keeping its hue, until it
 * is at least HARMONY_MIN_DELTA_E from it (or lightness runs out).
 */
function moveAway(color: Oklch, canvas: Oklch): string {
  const direction = canvas.l > 0.5 ? -1 : 1;
  let css = formatInSrgb(color);
  for (let l = color.l; l >= 0 && l <= 1; l += direction * HARMONY_STEP) {
    css = formatInSrgb({ ...color, l: clamp(l, 0, 1) });
    if (deltaEOK(parse(css), canvas) >= HARMONY_MIN_DELTA_E) break;
  }
  return css;
}

/**
 * Blend 1–5 extracted systems into one. Pure and deterministic.
 * 1. Ownership: each tag's tokens come from the reference that claims it (earlier wins), else
 *    the first reference. Motion and voice come from the first reference; a11y is reset.
 * 2. Sliders: density (spacing), roundness (radius), contrast (ink/canvas), warmth (neutrals).
 * 3. Locks: locked token paths take their value from `previous`.
 * 4. Harmonize: an unlocked foreground color closer than ΔE 10 to its canvas moves away in
 *    lightness; a locked one is reported instead. WCAG contrast is the fixer's job.
 */
export function blend(input: BlendInput): BlendResult {
  const { references, previous, name, createdAt } = input;
  if (references.length < 1 || references.length > MAX_REFERENCES) {
    throw new Error(`blend: needs 1 to ${MAX_REFERENCES} references, got ${references.length}`);
  }
  const settings: BlendSettings = {
    density: clamp(input.settings.density, -1, 1),
    roundness: clamp(input.settings.roundness, -1, 1),
    contrast: clamp(input.settings.contrast, -1, 1),
    warmth: clamp(input.settings.warmth, -1, 1),
  };
  const owner = owners(references);
  const from = (tag: BorrowTag): ThemaSystem => {
    const ref = references[owner[tag]] ?? references[0];
    if (!ref) throw new Error("blend: no references"); // unreachable: checked above
    return ref.system;
  };
  const first = references[0]?.system;
  if (!first) throw new Error("blend: no references"); // unreachable: checked above

  const sources: SourceRef[] = references.map((ref, i) => {
    const source = ref.system.meta.sources[0];
    return {
      url: source?.url ?? "",
      screenshot: source?.screenshot ?? "",
      borrowed: TAGS.filter((tag) => owner[tag] === i),
    };
  });

  // 1. Ownership.
  const radius = from("shape").radius;
  const system: ThemaSystem = copy({
    meta: { name, version: THEMA_VERSION, sources, createdAt },
    color: from("colors").color,
    typography: from("typography").typography,
    spacing: applyDensity(from("spacing").spacing, settings.density),
    radius: {
      sm: roundValue(radius.sm, settings.roundness),
      md: roundValue(radius.md, settings.roundness),
      lg: roundValue(radius.lg, settings.roundness),
      full: radius.full,
    },
    shadow: from("shape").shadow,
    layout: from("layout").layout,
    motion: first.motion,
    voice: first.voice,
    a11y: { fixes: [], passes: false },
    locks: [],
  });

  // 2. Color sliders.
  for (const theme of THEMES) {
    applyContrast(system.color[theme], settings.contrast);
    applyWarmth(system.color[theme], settings.warmth);
  }

  // 3. Locks.
  const locks: string[] = [];
  const ignoredLocks: string[] = [];
  for (const path of input.locks ?? []) {
    const value = previous === undefined ? undefined : getAt(previous, path);
    if (
      !isTokenValue(value) ||
      getAt(system, path.split(".").slice(0, -1).join(".")) === undefined
    ) {
      ignoredLocks.push(path);
      continue;
    }
    setAt(system, path, copy(value));
    locks.push(path);
  }
  system.locks = locks;

  // 4. Harmonize.
  const adjustments: ColorAdjustment[] = [];
  const lockedClashes: string[] = [];
  for (const theme of THEMES) {
    const colors = system.color[theme];
    const canvas = parse(colors.canvas);
    for (const role of FOREGROUND_ROLES) {
      const path = `color.${theme}.${role}`;
      const before = colors[role];
      if (deltaEOK(parse(before), canvas) >= HARMONY_MIN_DELTA_E) continue;
      if (locks.includes(path)) {
        lockedClashes.push(path);
        continue;
      }
      const after = moveAway(parse(before), canvas);
      colors[role] = after;
      adjustments.push({ path, before, after });
    }
  }

  return { system, adjustments, lockedClashes, ignoredLocks };
}
