import { wcagContrast } from "culori";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatInSrgb, parseCssColor } from "../src/color-math.js";
import { TEXT_CONTRAST, UI_CONTRAST } from "../src/constants.js";
import { CHECKED_PAIRS, fix } from "../src/fix.js";
import { extractSystem } from "../src/system.js";
import type { ColorRole, StyleSample, ThemaSystem } from "../src/types.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");

type Colors = Record<ColorRole, string>;

/** A light palette where every checked pair passes. */
const GOOD: Colors = {
  canvas: "oklch(1 0 0)",
  surface: "oklch(0.97 0 0)",
  "surface-raised": "oklch(1 0 0)",
  ink: "oklch(0.2 0 0)",
  "ink-muted": "oklch(0.45 0 0)",
  hairline: "oklch(0.9 0 0)",
  primary: "oklch(0.5 0.2 260)",
  "primary-ink": "oklch(1 0 0)",
  accent: "oklch(0.5 0.2 300)",
  success: "oklch(0.45 0.13 145)",
  warning: "oklch(0.45 0.1 75)",
  danger: "oklch(0.45 0.15 25)",
  info: "oklch(0.45 0.13 250)",
};

/** A full system around a light and (optionally different) dark palette. */
function systemWith(
  light: Partial<Colors>,
  dark?: Partial<Colors>,
  locks: string[] = [],
): ThemaSystem {
  const l = { ...GOOD, ...light };
  return {
    meta: { name: "t", version: "0", sources: [], createdAt: "x" },
    color: { light: l, dark: dark ? { ...GOOD, ...dark } : { ...l } },
    typography: { families: { sans: "Inter" }, scale: [], ratio: 1 },
    spacing: { base: 4, scale: [4, 8] },
    radius: { sm: 4, md: 8, lg: 12, full: 9999 },
    shadow: { sm: "none", md: "none", lg: "none" },
    layout: { containerMax: 1280, gutter: 24, sectionY: 64 },
    motion: { durationFast: 150, durationBase: 250, easing: "ease" },
    voice: { mood: [], summary: "" },
    a11y: { fixes: [], passes: false },
    locks,
  };
}

/** A dark palette where every checked pair passes, so a test can isolate the light theme. */
const GOOD_DARK: Partial<Colors> = {
  canvas: "oklch(0.15 0 0)",
  surface: "oklch(0.2 0 0)",
  "surface-raised": "oklch(0.24 0 0)",
  ink: "oklch(0.95 0 0)",
  "ink-muted": "oklch(0.75 0 0)",
  primary: "oklch(0.75 0.15 260)",
  "primary-ink": "oklch(0.15 0 0)",
  accent: "oklch(0.75 0.15 300)",
  success: "oklch(0.75 0.15 145)",
  warning: "oklch(0.8 0.12 75)",
  danger: "oklch(0.75 0.15 25)",
  info: "oklch(0.75 0.13 250)",
};

const ratio = (a: string, b: string): number => wcagContrast(a, b);
const L = (css: string): number => parseCssColor(css)?.l ?? Number.NaN;

/** Brute force: the passing lightness closest to the color's own, scanning in 0.001 steps. */
function closestPassingL(css: string, bg: string, min: number): number {
  const c = parseCssColor(css);
  if (!c) throw new Error(css);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 1000; i++) {
    const candidate = formatInSrgb({ ...c, l: i / 1000 });
    if (ratio(candidate, bg) >= min && Math.abs(i / 1000 - c.l) < Math.abs(best - c.l))
      best = i / 1000;
  }
  return best;
}

describe("fix: the pairs", () => {
  it("checks text pairs at 4.5:1 and UI pairs at 3:1, never the hairline", () => {
    const pairs = CHECKED_PAIRS.map(({ fg, bg, min }) => `${fg}/${bg}/${min}`);
    for (const p of [
      "ink/canvas",
      "ink/surface",
      "ink/surface-raised",
      "ink-muted/canvas",
      "ink-muted/surface",
      "primary-ink/primary",
      "success/canvas",
      "warning/canvas",
      "danger/canvas",
      "info/canvas",
    ]) {
      expect(pairs).toContain(`${p}/${TEXT_CONTRAST}`);
    }
    expect(pairs).toContain(`primary/canvas/${UI_CONTRAST}`);
    expect(pairs).toContain(`accent/canvas/${UI_CONTRAST}`);
    expect(pairs.some((p) => p.startsWith("hairline"))).toBe(false);
  });

  it("leaves a palette that already passes untouched", () => {
    const { system, unresolved } = fix(systemWith({}, GOOD_DARK));
    expect(system.color.light).toEqual(GOOD);
    expect(system.a11y).toEqual({ fixes: [], passes: true });
    expect(unresolved).toEqual([]);
  });
});

describe("fix: minimal nudges", () => {
  it("darkens a light ink-muted just enough for 4.5:1, keeping its hue", () => {
    const before = "oklch(0.7 0.02 250)";
    const { system } = fix(systemWith({ "ink-muted": before }, GOOD_DARK));
    const after = system.color.light["ink-muted"];
    expect(ratio(after, GOOD.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(after, GOOD.surface)).toBeGreaterThanOrEqual(4.5);
    expect(L(after)).toBeCloseTo(closestPassingL(before, GOOD.surface, 4.5), 3);
    expect(parseCssColor(after)?.h).toBeCloseTo(250, 0);
  });

  it("darkens Mailchimp's yellow primary to 3:1 on white, no further", () => {
    const yellow = "oklch(0.905 0.184 98.8)";
    const { system } = fix(
      systemWith({ primary: yellow, "primary-ink": "oklch(0.2 0 0)" }, GOOD_DARK),
    );
    const after = system.color.light.primary;
    expect(ratio(after, GOOD.canvas)).toBeGreaterThanOrEqual(3);
    expect(L(after)).toBeCloseTo(closestPassingL(yellow, GOOD.canvas, 3), 3);
  });

  it("changes the label, not the brand: white text on Duolingo's green turns dark", () => {
    // The green itself is only 2.1:1 on white, so primary/canvas darkens it to 3:1 first; white
    // text on that green is still below 4.5:1, so the label is what changes.
    const green = "oklch(0.748 0.229 137.6)";
    const { system } = fix(
      systemWith({ primary: green, "primary-ink": "oklch(1 0 0)" }, GOOD_DARK),
    );
    const { primary, "primary-ink": label } = system.color.light;
    expect(ratio(label, primary)).toBeGreaterThanOrEqual(4.5);
    expect(L(label)).toBeLessThan(0.5); // flipped from white to dark
  });

  it("lightens colors on a dark canvas", () => {
    const { system } = fix(systemWith({}, { ...GOOD_DARK, danger: "oklch(0.4 0.15 25)" }));
    const danger = system.color.dark.danger;
    expect(L(danger)).toBeGreaterThan(0.4);
    expect(ratio(danger, GOOD_DARK.canvas ?? "")).toBeGreaterThanOrEqual(4.5);
  });

  it("records each fix with its theme and the ratios before and after", () => {
    const { system } = fix(systemWith({ success: "oklch(0.6 0.15 145)" }, GOOD_DARK));
    expect(system.a11y.fixes).toHaveLength(1);
    const [entry] = system.a11y.fixes;
    expect(entry).toMatchObject({ pair: ["success", "canvas"], theme: "light" });
    expect(entry?.before).toBeLessThan(4.5);
    expect(entry?.after).toBeGreaterThanOrEqual(4.5);
    expect(system.a11y.passes).toBe(true);
  });
});

describe("fix: locks", () => {
  it("never changes a locked color, and reports the pair it can't fix", () => {
    const yellow = "oklch(0.905 0.184 98.8)";
    const { system, unresolved } = fix(
      systemWith({ primary: yellow, "primary-ink": "oklch(0.2 0 0)" }, GOOD_DARK, [
        "color.light.primary",
      ]),
    );
    expect(system.color.light.primary).toBe(yellow);
    expect(unresolved).toContainEqual(
      expect.objectContaining({ theme: "light", pair: ["primary", "canvas"], reason: "locked" }),
    );
    expect(system.a11y.passes).toBe(false);
  });
});

describe("fix: missing theme", () => {
  it("generates a dark theme when dark is a copy of light", () => {
    const { system, generated } = fix(systemWith({ surface: "oklch(0.96 0.02 250)" }));
    expect(generated).toBe("dark");
    const dark = system.color.dark;
    expect(L(dark.canvas)).toBeCloseTo(0.12, 2); // white mirrored within 0.14–0.98
    expect(L(dark.ink)).toBeGreaterThan(0.85);
    expect(parseCssColor(dark.surface)?.c).toBeCloseTo(0.01, 3); // chroma halved on surfaces
    expect(system.color.light).toEqual({ ...GOOD, surface: "oklch(0.96 0.02 250)" });
    for (const { fg, bg, min } of CHECKED_PAIRS) {
      expect(ratio(dark[fg], dark[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });

  it("generates a light theme for dark-only sites, keeping the measured palette as dark", () => {
    const measured: Colors = { ...GOOD, ...GOOD_DARK };
    const { system, generated } = fix(systemWith(measured));
    expect(generated).toBe("light");
    expect(system.color.dark).toEqual(measured);
    expect(L(system.color.light.canvas)).toBeGreaterThan(0.9);
    expect(L(system.color.light.ink)).toBeLessThan(0.3);
  });

  it("mirrors a neutral primary too: a monochrome site's black buttons turn white in dark", () => {
    const mono = { primary: "oklch(0 0 0)", "primary-ink": "oklch(1 0 0)", accent: "oklch(0 0 0)" };
    const { system } = fix(systemWith(mono));
    expect(L(system.color.dark.primary)).toBeGreaterThan(0.95);
    expect(L(system.color.dark["primary-ink"])).toBeLessThan(0.2);
    expect(system.a11y.fixes.filter((f) => f.theme === "dark" && f.pair[0] === "primary")).toEqual(
      [],
    );
  });

  it("keeps a measured dark theme", () => {
    const { generated, system } = fix(systemWith({}, GOOD_DARK));
    expect(generated).toBeNull();
    expect(system.color.dark).toEqual({ ...GOOD, ...GOOD_DARK });
  });
});

describe("fix: every fixture", () => {
  const names = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(FIXTURES, d.name, "samples.json")))
    .map((d) => d.name)
    .sort();
  const extracted = (name: string): ThemaSystem => {
    const read = (file: string): StyleSample[] | undefined => {
      const path = join(FIXTURES, name, file);
      return existsSync(path)
        ? (JSON.parse(readFileSync(path, "utf8")) as StyleSample[])
        : undefined;
    };
    const dark = read("samples.dark.json");
    return extractSystem({
      samples: read("samples.json") ?? [],
      ...(dark ? { darkSamples: dark } : {}),
      source: { url: name, borrowed: [], screenshot: "" },
      name,
      createdAt: "x",
    }).system;
  };

  it.each(names)("%s: passes AA in both themes, deterministically and idempotently", (name) => {
    const first = fix(extracted(name));
    expect(first.unresolved).toEqual([]);
    expect(first.system.a11y.passes).toBe(true);
    for (const theme of ["light", "dark"] as const) {
      const colors = first.system.color[theme];
      for (const { fg, bg, min } of CHECKED_PAIRS) {
        expect(ratio(colors[fg], colors[bg]), `${theme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(
          min,
        );
      }
    }
    expect(fix(extracted(name))).toEqual(first);
    expect(fix(first.system).system.a11y.fixes).toEqual([]);
  });
});
