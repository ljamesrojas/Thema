import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCssColor } from "../src/color-math.js";
import { MOTION_DEFAULTS, THEMA_VERSION } from "../src/constants.js";
import { extractSystem, type ExtractInput } from "../src/system.js";
import type { ColorRole, SourceRef, StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");
const ALL_ROLES: ColorRole[] = [
  "canvas",
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "hairline",
  "primary",
  "primary-ink",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
];

const load = (name: string, file: string): StyleSample[] | undefined => {
  const path = join(FIXTURES, name, file);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StyleSample[]) : undefined;
};

const fixtures = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(FIXTURES, d.name, "samples.json")))
  .map((d) => d.name)
  .sort();

const source = (name: string): SourceRef => ({
  url: `https://${name}.example/`,
  borrowed: ["colors", "typography", "spacing", "shape", "layout"],
  screenshot: `${name}.png`,
});

const input = (name: string): ExtractInput => {
  const darkSamples = load(name, "samples.dark.json");
  return {
    samples: load(name, "samples.json") ?? [],
    ...(darkSamples ? { darkSamples } : {}),
    source: source(name),
    name,
    createdAt: "2026-11-13T00:00:00.000Z",
  };
};

const page = (bg: string): StyleSample =>
  sample({ tag: "html", role: "container", area: 2_000_000, backgroundColor: bg });
const heading = (color: string): StyleSample =>
  sample({ tag: "h1", fontSize: 48, area: 60_000, color });
const text = (color: string): StyleSample =>
  sample({ tag: "p", role: "body", area: 80_000, color });
const blue = (): StyleSample =>
  sample({ tag: "button", area: 8000, backgroundColor: "#2563eb", color: "#ffffff" });

describe("extractSystem on every fixture", () => {
  it.each(fixtures)("%s: a complete, valid system, the same every time", (name) => {
    const a = extractSystem(input(name));
    expect(a).toEqual(extractSystem(input(name)));
    for (const theme of ["light", "dark"] as const) {
      expect(Object.keys(a.system.color[theme]).sort()).toEqual([...ALL_ROLES].sort());
      for (const role of ALL_ROLES) {
        expect(parseCssColor(a.system.color[theme][role]), `${theme}.${role}`).not.toBeNull();
      }
    }
    const { layout, spacing } = a.system;
    expect(layout.containerMax).toBeGreaterThan(0);
    expect(layout.gutter).toBeGreaterThan(0);
    expect(layout.sectionY).toBeGreaterThan(0);
    expect([4, 8]).toContain(spacing.base);
  });
});

describe("extractSystem: the fixed parts", () => {
  it("fills meta from the input, motion from the defaults, and leaves voice, locks, a11y empty", () => {
    const { system, derived } = extractSystem(input("light-saas"));
    expect(system.meta).toEqual({
      name: "light-saas",
      version: THEMA_VERSION,
      sources: [source("light-saas")],
      createdAt: "2026-11-13T00:00:00.000Z",
    });
    expect(system.motion).toEqual(MOTION_DEFAULTS);
    expect(derived).toEqual(
      expect.arrayContaining(["motion.durationFast", "motion.durationBase", "motion.easing"]),
    );
    expect(system.voice).toEqual({ mood: [], summary: "" });
    expect(system.locks).toEqual([]);
    expect(system.a11y).toEqual({ fixes: [], passes: false });
  });

  it("matches the analyzers it is built from", () => {
    const { system } = extractSystem(input("light-saas"));
    expect(system.radius.full).toBe(9999);
    expect(system.typography.families.sans).toBe("Inter");
  });
});

describe("extractSystem: dark theme", () => {
  const light = [page("#ffffff"), heading("#111111"), text("#333333"), blue(), blue(), blue()];
  const dark = [page("#0b0b0c"), heading("#f5f5f5"), text("#cccccc"), blue(), blue(), blue()];

  it("uses the measured dark theme when the canvas flips", () => {
    const { system, warnings } = extractSystem({
      ...input("x"),
      samples: light,
      darkSamples: dark,
    });
    expect(parseCssColor(system.color.dark.canvas)?.l).toBeLessThan(0.2);
    expect(warnings).not.toContain("no-dark-theme");
  });

  it("copies the light colors and warns when there is no dark theme", () => {
    for (const darkSamples of [undefined, light]) {
      const { system, warnings } = extractSystem({
        ...input("x"),
        samples: light,
        ...(darkSamples ? { darkSamples } : {}),
      });
      expect(system.color.dark).toEqual(system.color.light);
      expect(warnings).toContain("no-dark-theme");
    }
  });
});

describe("extractSystem: warnings", () => {
  const base = [page("#ffffff"), text("#333333"), blue(), blue(), blue()];
  const many = (n: number) => Array.from({ length: n }, () => text("#333333"));

  it("warns when the page has no headings at all (a page variant, Substack)", () => {
    const { warnings } = extractSystem({ ...input("x"), samples: [...base, ...many(20)] });
    expect(warnings).toContain("no-headings");
  });

  it("counts text nested in a heading as a heading", () => {
    const nested = sample({ tag: "span", role: "body", inHeading: true, area: 50_000 });
    const { warnings } = extractSystem({ ...input("x"), samples: [...base, nested, ...many(20)] });
    expect(warnings).not.toContain("no-headings");
  });

  it("warns on very few samples (a blocked or empty page)", () => {
    expect(extractSystem({ ...input("x"), samples: base }).warnings).toContain("few-samples");
    expect(
      extractSystem({ ...input("x"), samples: [...base, ...many(20)] }).warnings,
    ).not.toContain("few-samples");
  });

  it("warns when there is no saturated primary", () => {
    const mono = [page("#ffffff"), heading("#111111"), ...many(20)];
    expect(extractSystem({ ...input("x"), samples: mono }).warnings).toContain("monochrome");
    expect(
      extractSystem({ ...input("x"), samples: [...base, heading("#111111"), ...many(20)] })
        .warnings,
    ).not.toContain("monochrome");
  });
});

describe("extractSystem: synthetic fixtures", () => {
  it.each(["dark-dev-tool", "light-saas", "warm-editorial"])("%s", (name) => {
    expect(extractSystem(input(name))).toMatchSnapshot();
  });
});
