import { clusterColors, type ColorCluster } from "./cluster.js";
import {
  alphaOf,
  compositeOver,
  deltaEOK,
  formatOklch,
  hueDelta,
  parseCssColor,
  withOpacity,
  type Oklch,
} from "./color-math.js";
import {
  ACCENT_MIN_HUE_DELTA,
  INK_MIN_SHARE,
  OCCURRENCE_TARGET,
  ROLE_WEIGHT,
  SATURATED_CHROMA,
  SURFACE_MAX_DELTA_E,
  type SampleRole,
} from "./constants.js";
import { sampleRole } from "./samples.js";
import type { ColorRole, StyleSample } from "./types.js";

export interface ColorAnalysis {
  /** OKLCH strings per role. A role is omitted when the samples give no candidate for it. */
  roles: Partial<Record<ColorRole, string>>;
  /** 0–1 per assigned role: 1 = no rival candidate, 0 = tied with the runner-up. */
  confidence: Partial<Record<ColorRole, number>>;
}

type Channel = "background" | "text" | "border";

interface ColorEntry {
  color: Oklch;
  channel: Channel;
  role: SampleRole;
  /** Visible area in px². */
  area: number;
  /** Area × role weight. */
  weight: number;
  /** Index of the source sample, for counting distinct occurrences. */
  sample: number;
}

type Cluster = ColorCluster<ColorEntry>;

/** White, used as the backdrop when no opaque background exists. */
const WHITE: Oklch = { mode: "oklch", l: 1, c: 0 };

function readEntries(samples: readonly StyleSample[]): ColorEntry[] {
  const entries: ColorEntry[] = [];
  samples.forEach((sample, index) => {
    if (!(sample.area > 0)) return;
    const role = sampleRole(sample);
    const weight = sample.area * ROLE_WEIGHT[role];
    const push = (css: string | undefined, channel: Channel): void => {
      if (css === undefined) return;
      const parsed = parseCssColor(css);
      if (!parsed) return;
      // Fold in CSS opacity: a faded element paints a translucent color (composited later).
      const color = withOpacity(parsed, sample.opacity);
      if (alphaOf(color) > 0) {
        entries.push({ color, channel, role, area: sample.area, weight, sample: index });
      }
    };
    push(sample.backgroundColor, "background");
    // A container's text color is inherited, not visible text.
    if (role !== "container") push(sample.color, "text");
    push(sample.borderColor, "border");
  });
  return entries;
}

// --- cluster measurements ---------------------------------------------------------------

const sum = (members: readonly ColorEntry[], pick: (e: ColorEntry) => number): number =>
  members.reduce((acc, e) => acc + pick(e), 0);

const ofChannel = (c: Cluster, channel: Channel): ColorEntry[] =>
  c.members.filter((e) => e.channel === channel);

const isNeutral = (c: Cluster): boolean => c.color.c < SATURATED_CHROMA;

// --- role picking ---------------------------------------------------------------------

interface Pick {
  cluster: Cluster;
  confidence: number;
}

/** What counts as evidence for a role, and how heavily. */
interface Evidence {
  members: (c: Cluster) => ColorEntry[];
  measure: (e: ColorEntry) => number;
}

const BACKGROUND: Evidence = { members: (c) => ofChannel(c, "background"), measure: (e) => e.area };
const TEXT: Evidence = { members: (c) => ofChannel(c, "text"), measure: (e) => e.weight };
const BORDER: Evidence = { members: (c) => ofChannel(c, "border"), measure: (e) => e.weight };
const INTERACTIVE: Evidence = {
  members: (c) => c.members.filter((e) => e.role === "interactive"),
  measure: (e) => e.weight,
};
const ANY: Evidence = { members: (c) => c.members, measure: (e) => e.weight };

/** Score: summed evidence. */
const total =
  (evidence: Evidence) =>
  (c: Cluster): number =>
    sum(evidence.members(c), evidence.measure);

/**
 * Score for primary/accent: summed evidence, scaled down when the color appears on fewer than
 * OCCURRENCE_TARGET distinct samples, so a one-off cookie button or ad badge can't win.
 */
const scaledTotal =
  (evidence: Evidence) =>
  (c: Cluster): number => {
    const members = evidence.members(c);
    const distinct = new Set(members.map((e) => e.sample)).size;
    return sum(members, evidence.measure) * Math.min(1, distinct / OCCURRENCE_TARGET);
  };

/**
 * The color a role reports: the heaviest exact color among the members that count for that
 * role. One cluster can hold a large footer background and the body text color; the text
 * role must report the text color, not whatever covers the most area.
 */
function representative(cluster: Cluster, evidence: Evidence): string {
  const totals = new Map<string, number>();
  for (const e of evidence.members(cluster)) {
    const key = formatOklch(e.color);
    totals.set(key, (totals.get(key) ?? 0) + evidence.measure(e));
  }
  let best = cluster.key;
  let bestWeight = -1;
  for (const [key, weight] of [...totals].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (weight > bestWeight) [best, bestWeight] = [key, weight];
  }
  return best;
}

/** Highest-scoring candidate with a positive score; confidence = 1 − runnerUp / winner. */
function pickBest(candidates: readonly Cluster[], score: (c: Cluster) => number): Pick | null {
  const ranked = candidates
    .map((cluster) => ({ cluster, score: score(cluster) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const [winner, runnerUp] = ranked;
  if (!winner) return null;
  const confidence = runnerUp ? 1 - runnerUp.score / winner.score : 1;
  return { cluster: winner.cluster, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Turn raw style samples into named color roles (canvas, surface, ink, ink-muted, hairline,
 * primary, accent). Pure and deterministic: the same samples always give the same output.
 */
export function analyzeColors(samples: readonly StyleSample[]): ColorAnalysis {
  const roles: ColorAnalysis["roles"] = {};
  const confidence: ColorAnalysis["confidence"] = {};
  const assign = (role: ColorRole, evidence: Evidence, pick: Pick | null): Cluster | null => {
    if (!pick) return null;
    roles[role] = representative(pick.cluster, evidence);
    confidence[role] = pick.confidence;
    return pick.cluster;
  };

  const raw = readEntries(samples);

  // Pass 1: find the canvas among opaque backgrounds, as the backdrop for translucent colors.
  const opaqueBackgrounds = raw.filter((e) => e.channel === "background" && alphaOf(e.color) >= 1);
  const backdrop =
    pickBest(clusterColors(opaqueBackgrounds), total(BACKGROUND))?.cluster.color ?? WHITE;

  // Pass 2: flatten translucent colors onto the backdrop, then cluster everything together.
  const entries = raw.map((e) => ({ ...e, color: compositeOver(e.color, backdrop) }));
  const clusters = clusterColors(entries);

  const canvas = assign("canvas", BACKGROUND, pickBest(clusters, total(BACKGROUND)));
  if (!canvas) return { roles, confidence };

  const surface = assign(
    "surface",
    BACKGROUND,
    pickBest(
      clusters.filter(
        (c) =>
          c !== canvas && isNeutral(c) && deltaEOK(c.color, canvas.color) <= SURFACE_MAX_DELTA_E,
      ),
      total(BACKGROUND),
    ),
  );

  // Text the color of the canvas or surface would be invisible on it, so neither can be ink.
  const textCandidates = clusters.filter((c) => c !== canvas && c !== surface);
  const neutralText = textCandidates.filter(isNeutral);

  // Ink: among text colors used substantially (≥ INK_MIN_SHARE of the heaviest), the one with
  // the most contrast against the canvas. "Most used" alone fails when muted copy outweighs
  // the main text (four faded paragraphs vs one black one): the gray would become ink.
  const contrast = (c: Cluster): number => Math.abs(c.color.l - canvas.color.l);
  const pickInk = (candidates: readonly Cluster[]): Pick | null => {
    const heaviest = Math.max(0, ...candidates.map(total(TEXT)));
    const substantial = candidates.filter(
      (c) => heaviest > 0 && total(TEXT)(c) >= heaviest * INK_MIN_SHARE,
    );
    return pickBest(substantial, contrast);
  };
  const ink = assign("ink", TEXT, pickInk(neutralText) ?? pickInk(textCandidates));

  if (ink) {
    const [lo, hi] = [ink.color.l, canvas.color.l].sort((a, b) => a - b) as [number, number];
    assign(
      "ink-muted",
      TEXT,
      pickBest(
        neutralText.filter((c) => c !== ink && c.color.l > lo && c.color.l < hi),
        total(TEXT),
      ),
    );
  }

  assign(
    "hairline",
    BORDER,
    pickBest(
      clusters.filter((c) => c !== canvas && isNeutral(c)),
      total(BORDER),
    ),
  );

  const taken = new Set<Cluster>([canvas, ...(surface ? [surface] : [])]);
  const saturated = clusters.filter((c) => !isNeutral(c) && !taken.has(c));
  const primary = assign("primary", INTERACTIVE, pickBest(saturated, scaledTotal(INTERACTIVE)));

  assign(
    "accent",
    ANY,
    pickBest(
      saturated.filter(
        (c) =>
          !primary || (c !== primary && hueDelta(c.color, primary.color) >= ACCENT_MIN_HUE_DELTA),
      ),
      scaledTotal(ANY),
    ),
  );

  return { roles, confidence };
}
