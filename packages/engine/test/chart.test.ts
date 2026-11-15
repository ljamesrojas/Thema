import { wcagContrast } from "culori";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chartColors } from "../src/chart.js";
import { deltaEOK, parseCssColor } from "../src/color-math.js";
import {
  CHART_COUNT,
  CHART_MIN_CHROMA,
  CHART_MIN_DELTA_E,
  MONOCHROME_MAX_CHROMA,
  UI_CONTRAST,
} from "../src/constants.js";
import { fix } from "../src/fix.js";
import { extractSystem } from "../src/system.js";
import type { ColorRole, StyleSample, ThemaSystem } from "../src/types.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");

type Colors = Record<ColorRole, string>;

/** A light palette with a blue primary and a violet accent. */
const LIGHT: Colors = {
  canvas: "oklch(1 0 0)",
  surface: "oklch(0.97 0 0)",
  "surface-raised": "oklch(1 0 0)",
  ink: "oklch(0.2 0 0)",
  "ink-muted": "oklch(0.45 0 0)",
  hairline: "oklch(0.9 0 0)",
  primary: "oklch(0.5 0.2 260)",
  "primary-ink": "oklch(1 0 0)",
  accent: "oklch(0.5 0.2 320)",
  success: "oklch(0.45 0.13 145)",
  warning: "oklch(0.45 0.1 75)",
  danger: "oklch(0.45 0.15 25)",
  info: "oklch(0.45 0.13 250)",
};

/** A black-and-white palette: black primary and accent. */
const MONO: Colors = { ...LIGHT, primary: "oklch(0.15 0 0)", accent: "oklch(0.15 0 0)" };

const parse = (css: string) => {
  const color = parseCssColor(css);
  if (!color) throw new Error(css);
  return color;
};

/** Every chart color reaches 3:1 on the canvas and on raised cards, and no two look alike. */
function expectUsable(colors: Colors, chart: string[], label = "") {
  expect(chart).toHaveLength(CHART_COUNT);
  for (const [i, css] of chart.entries()) {
    for (const bg of ["canvas", "surface-raised"] as const) {
      expect(
        wcagContrast(css, colors[bg]),
        `${label} chart-${i + 1} on ${bg}`,
      ).toBeGreaterThanOrEqual(UI_CONTRAST);
    }
  }
  for (let i = 0; i < chart.length; i++) {
    for (let j = i + 1; j < chart.length; j++) {
      const a = chart[i] ?? "";
      const b = chart[j] ?? "";
      expect(
        deltaEOK(parse(a), parse(b)),
        `${label} chart-${i + 1} vs chart-${j + 1}`,
      ).toBeGreaterThanOrEqual(CHART_MIN_DELTA_E);
    }
  }
}

describe("chartColors", () => {
  it("starts with primary, then the accent, then wheel hues away from both", () => {
    const chart = chartColors(LIGHT);
    expect(chart[0]).toBe(LIGHT.primary);
    expect(chart[1]).toBe(LIGHT.accent);
    // Wheel hues from 260: 332, 44, 116, 188. 332 is nearest the accent (320), so it's skipped.
    expect(chart.slice(2).map((c) => Math.round(parse(c).h ?? 0))).toEqual([44, 116, 188]);
    expectUsable(LIGHT, chart);
  });

  it("uses wheel hues for chart-2 when the accent isn't a second color", () => {
    const chart = chartColors({ ...LIGHT, accent: LIGHT.primary });
    expect(chart[0]).toBe(LIGHT.primary);
    expect(chart.slice(1).map((c) => Math.round(parse(c).h ?? 0))).toEqual([332, 44, 116, 188]);
  });

  it("never borrows the status colors", () => {
    const chart = chartColors(LIGHT);
    for (const role of ["success", "warning", "danger", "info"] as const) {
      expect(chart).not.toContain(LIGHT[role]);
    }
  });

  it("gives a black-and-white site its grays, black first", () => {
    const chart = chartColors(MONO);
    expect(chart[0]).toBe(MONO.primary);
    for (const css of chart) expect(parse(css).c).toBeLessThan(MONOCHROME_MAX_CHROMA);
    const lightness = chart.map((c) => parse(c).l);
    expect(lightness).toEqual([...lightness].sort((a, b) => a - b));
    expectUsable(MONO, chart);
  });

  it("moves a primary that's too faint on raised cards until it reaches 3:1", () => {
    const colors = { ...LIGHT, primary: "oklch(0.8 0.15 90)" };
    const chart = chartColors(colors);
    expect(chart[0]).not.toBe(colors.primary);
    expect(wcagContrast(chart[0] ?? "", colors["surface-raised"])).toBeGreaterThanOrEqual(
      UI_CONTRAST,
    );
  });

  it("puts a black-and-white site's colored accent second, then grays", () => {
    const colors = { ...MONO, accent: "oklch(0.55 0.18 40)" };
    const chart = chartColors(colors);
    expect(chart.slice(0, 2)).toEqual([colors.primary, colors.accent]);
    for (const css of chart.slice(2)) expect(parse(css).c).toBeLessThan(MONOCHROME_MAX_CHROMA);
    expectUsable(colors, chart);
  });

  it("doesn't use an accent that looks too much like primary", () => {
    // 30° apart but only ~8 ΔE: react.dev's dark theme.
    const colors = {
      ...LIGHT,
      primary: "oklch(0.767 0.104 214.6)",
      accent: "oklch(0.828 0.084 181.4)",
    };
    expect(chartColors(colors)).not.toContain(colors.accent);
  });

  it("moves a derived hue to a lightness where it can stay colorful", () => {
    // A light yellow primary on a dark canvas (Mailchimp dark): blue can't be colorful at L 0.9.
    const colors = {
      ...LIGHT,
      canvas: "oklch(0.12 0 0)",
      "surface-raised": "oklch(0.12 0 0)",
      primary: "oklch(0.905 0.184 98.8)",
      accent: "oklch(0.905 0.184 98.8)",
    };
    const chart = chartColors(colors);
    for (const css of chart.slice(1)) expect(parse(css).c).toBeGreaterThanOrEqual(CHART_MIN_CHROMA);
    expectUsable(colors, chart);
  });

  it("is deterministic", () => {
    expect(chartColors(LIGHT)).toEqual(chartColors(LIGHT));
  });
});

describe("chartColors: every fixture", () => {
  const names = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(FIXTURES, d.name, "samples.json")))
    .map((d) => d.name)
    .sort();
  const fixed = (name: string): ThemaSystem => {
    const read = (file: string): StyleSample[] | undefined => {
      const path = join(FIXTURES, name, file);
      return existsSync(path)
        ? (JSON.parse(readFileSync(path, "utf8")) as StyleSample[])
        : undefined;
    };
    const dark = read("samples.dark.json");
    return fix(
      extractSystem({
        samples: read("samples.json") ?? [],
        ...(dark ? { darkSamples: dark } : {}),
        source: { url: name, borrowed: [], screenshot: "" },
        name,
        createdAt: "x",
      }).system,
    ).system;
  };

  it.each(names)("%s: five distinct colors at 3:1 on canvas and cards, both themes", (name) => {
    const system = fixed(name);
    for (const theme of ["light", "dark"] as const) {
      const colors = system.color[theme];
      expectUsable(colors, chartColors(colors), theme);
    }
  });
});
