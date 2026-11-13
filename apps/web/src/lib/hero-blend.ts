import {
  blend,
  CHECKED_PAIRS,
  extractSystem,
  fix,
  type BorrowTag,
  type ColorRole,
  type ContrastFix,
  type StyleSample,
  type ThemaSystem,
} from "@thema/engine";
import { toHex } from "@thema/exporters";
import { wcagContrast } from "culori";
import darkDevTool from "../../../../fixtures/dark-dev-tool/samples.json";
import lightSaas from "../../../../fixtures/light-saas/samples.json";
import warmEditorial from "../../../../fixtures/warm-editorial/samples.json";

/**
 * The Landing hero's blend, computed by the real pipeline (extractSystem → blend → fix) from our
 * three synthetic fixtures, so every chip and number on the page is true. The references are
 * labelled with reserved `.example` domains: no real site's design appears on the marketing page.
 */
const REFERENCES: { label: string; borrowed: BorrowTag[]; samples: unknown }[] = [
  { label: "north.example", borrowed: ["colors", "shape"], samples: lightSaas },
  { label: "fieldnotes.example", borrowed: ["typography"], samples: warmEditorial },
  { label: "quietbank.example", borrowed: ["spacing", "layout"], samples: darkDevTool },
];

/** Fixed, so the page is the same on every build (the engine takes the time as input). */
const CREATED_AT = "2026-11-13T00:00:00.000Z";

export interface HeroChip {
  name: string;
  color: string;
  hex: string;
}

export interface HeroBlend {
  references: { label: string; borrowed: BorrowTag[] }[];
  chips: HeroChip[];
  ink: string;
  /** Checked pairs passing in the light theme, out of all checked pairs. */
  passing: { light: number; dark: number; total: number };
  /** The fixer's changes, light theme first. */
  fixes: ContrastFix[];
  /** A few pairs that already passed, with their ratio, for the before/after table. */
  passed: { pair: [ColorRole, ColorRole]; ratio: number }[];
  darkGenerated: boolean;
  /** What was measured on the first reference: the rows of Feature 01's "reading styles" card. */
  measured: { source: string; rows: [string, string][] };
}

const CHIPS: [string, ColorRole][] = [
  ["Canvas", "canvas"],
  ["Ink", "ink"],
  ["Primary", "primary"],
  ["Accent", "accent"],
  ["Muted", "ink-muted"],
];

function passingPairs(colors: Record<ColorRole, string>): number {
  return CHECKED_PAIRS.filter(({ fg, bg, min }) => wcagContrast(colors[fg], colors[bg]) >= min)
    .length;
}

export function heroBlend(): HeroBlend {
  const extracted = REFERENCES.map(({ label, borrowed, samples }) => ({
    system: extractSystem({
      samples: samples as StyleSample[],
      source: { url: `https://${label}/`, borrowed, screenshot: "" },
      name: label,
      createdAt: CREATED_AT,
    }).system,
    borrowed,
  }));
  const blended = blend({
    references: extracted,
    settings: { density: 0, roundness: 0, contrast: 0, warmth: 0 },
    name: "Hero blend",
    createdAt: CREATED_AT,
  }).system;
  const fixed = fix(blended);
  const system: ThemaSystem = fixed.system;
  const light = system.color.light;
  return {
    references: REFERENCES.map(({ label, borrowed }) => ({ label, borrowed })),
    chips: CHIPS.map(([name, role]) => ({ name, color: light[role], hex: toHex(light[role]) })),
    ink: light.ink,
    passing: {
      light: passingPairs(light),
      dark: passingPairs(system.color.dark),
      total: CHECKED_PAIRS.length,
    },
    fixes: [...system.a11y.fixes].sort((a, b) =>
      a.theme === b.theme ? 0 : a.theme === "light" ? -1 : 1,
    ),
    passed: (
      [
        ["primary-ink", "primary"],
        ["ink", "canvas"],
      ] as [ColorRole, ColorRole][]
    ).map((pair) => ({
      pair,
      ratio: Math.round(wcagContrast(light[pair[0]], light[pair[1]]) * 10) / 10,
    })),
    darkGenerated: fixed.generated === "dark",
    measured: measuredRows(REFERENCES[0]?.label ?? "", extracted[0]?.system, system.a11y.fixes),
  };
}

/** Feature 01's rows: real values from the first reference, then what the fixer did. */
function measuredRows(
  source: string,
  system: ThemaSystem | undefined,
  fixes: readonly ContrastFix[],
): HeroBlend["measured"] {
  if (!system) return { source, rows: [] };
  const { light } = system.color;
  return {
    source,
    rows: [
      ["color.canvas", toHex(light.canvas)],
      ["color.ink", toHex(light.ink)],
      ["color.primary", toHex(light.primary)],
      ["font.sans", system.typography.families.sans],
      ["spacing.base", `${system.spacing.base}px`],
      ["radius.md", `${system.radius.md}px`],
      ["contrast", `${fixes.length} pairs fixed → AA`],
    ],
  };
}
