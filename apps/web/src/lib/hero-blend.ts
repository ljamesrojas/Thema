import {
  blend,
  CHECKED_PAIRS,
  extractSystem,
  fix,
  parseFontFamily,
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
  /** Feature 01's "reading styles" card: what the browser read on the first reference. */
  read: { source: string; rows: [string, string][]; result: string };
  /** The interactive demo's sites: each reference's own extracted system, untouched. */
  sites: { id: string; label: string; system: ThemaSystem }[];
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
    read: readRows(REFERENCES[0], extracted[0]?.system),
    sites: REFERENCES.map(({ label }, i) => ({
      id: label.split(".")[0] ?? label,
      label,
      system: extracted[i]?.system ?? system,
    })),
  };
}

const isPainted = (css: string) => !/^(transparent|rgba\([^)]*,\s*0\))$/.test(css.trim());

/**
 * Feature 01's rows: samples the browser recorded on the first reference (its first painted
 * button, its h1, its first padded section), then what the engine concluded.
 */
function readRows(
  reference: (typeof REFERENCES)[number] | undefined,
  system: ThemaSystem | undefined,
): HeroBlend["read"] {
  const samples = (reference?.samples ?? []) as StyleSample[];
  const rows: [string, string][] = [];
  const button = samples.find((s) => s.tag === "button" && isPainted(s.backgroundColor));
  if (button) rows.push(["button", `background ${toHex(button.backgroundColor)}`]);
  const h1 = samples.find((s) => s.tag === "h1");
  if (h1) {
    const family = parseFontFamily(h1.fontFamily)?.name ?? h1.fontFamily;
    rows.push(["h1", `${family} · ${h1.fontSize}px · ${h1.fontWeight}`]);
  }
  const section = samples.find((s) => s.tag === "section" && s.padding[0] > 0);
  if (section) rows.push(["section", `padding ${section.padding[0]}px ${section.padding[1]}px`]);
  const result = system
    ? `primary ${toHex(system.color.light.primary)} · base ${system.spacing.base}`
    : "";
  return { source: reference?.label ?? "", rows, result };
}
