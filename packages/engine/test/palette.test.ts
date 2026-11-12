import { displayable } from "culori";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeColors } from "../src/colors.js";
import { parseCssColor } from "../src/color-math.js";
import { SEMANTIC_HUE } from "../src/constants.js";
import { completePalette } from "../src/palette.js";
import type { ColorRole, StyleSample } from "../src/types.js";
import { distance, sample } from "./helpers.js";

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

const page = (bg = "#ffffff"): StyleSample =>
  sample({ tag: "html", role: "container", area: 2_000_000, backgroundColor: bg, y: 0 });
const text = (color: string, area = 50_000): StyleSample =>
  sample({ tag: "p", role: "body", area, color });
const box = (bg: string, area = 100_000): StyleSample =>
  sample({ tag: "div", role: "container", area, backgroundColor: bg });
const button = (bg: string, color = "#ffffff", overrides: Partial<StyleSample> = {}) =>
  sample({ tag: "button", area: 8000, backgroundColor: bg, color, ...overrides });

const lightness = (css: string): number => parseCssColor(css)?.l ?? Number.NaN;

describe("completePalette", () => {
  it("returns every role as a valid OKLCH color", () => {
    const { colors } = completePalette([page(), text("#111111")]);
    expect(Object.keys(colors).sort()).toEqual([...ALL_ROLES].sort());
    for (const role of ALL_ROLES) expect(parseCssColor(colors[role]), role).not.toBeNull();
  });

  it("keeps every role analyzeColors measures, unchanged (light-saas fixture)", () => {
    const dir = join(import.meta.dirname, "../../../fixtures/light-saas");
    const samples = JSON.parse(readFileSync(join(dir, "samples.json"), "utf8")) as StyleSample[];
    const { roles } = analyzeColors(samples);
    const { colors, derived } = completePalette(samples);
    for (const [role, css] of Object.entries(roles)) {
      expect(colors[role as ColorRole], role).toBe(css);
      expect(derived, role).not.toContain(role);
    }
  });

  it("derives a surface one step from the canvas: darker on light pages, lighter on dark", () => {
    const light = completePalette([page(), text("#111111")]);
    expect(lightness(light.colors.surface)).toBeCloseTo(1 - 0.03, 3);
    expect(light.derived).toContain("surface");
    const dark = completePalette([page("#000000"), text("#eeeeee")]);
    expect(lightness(dark.colors.surface)).toBeCloseTo(0.05, 3);
  });

  it("measures surface-raised: the next neutral background near the canvas", () => {
    const { colors, derived } = completePalette([
      page(),
      text("#111111"),
      box("#ededed", 400_000), // surface
      box("#ededed", 400_000),
      box("#dcdcdc", 50_000), // raised cards, ΔE 5.5 from the surface
      box("#dcdcdc", 50_000),
    ]);
    expect(distance(colors["surface-raised"], "#dcdcdc")).toBeLessThan(1);
    expect(derived).not.toContain("surface-raised");
  });

  it("derives surface-raised above the lighter of canvas and surface when not measured", () => {
    const { colors, derived } = completePalette([page("#101010"), text("#eeeeee")]);
    expect(derived).toContain("surface-raised");
    // Dark: surface = canvas + 0.05, raised = surface + 0.05.
    expect(lightness(colors["surface-raised"])).toBeCloseTo(lightness(colors.surface) + 0.05, 3);
  });

  it("measures primary-ink from the text on primary buttons", () => {
    const blue = (color: string) => [
      button("#2563eb", color),
      button("#2563eb", color),
      button("#2563eb", color),
    ];
    expect(
      distance(
        completePalette([page(), text("#111111"), ...blue("#ffffff")]).colors["primary-ink"],
        "#ffffff",
      ),
    ).toBeLessThan(1);
    expect(
      distance(
        completePalette([page(), text("#111111"), ...blue("#0a0a0a")]).colors["primary-ink"],
        "#0a0a0a",
      ),
    ).toBeLessThan(1);
  });

  it("falls back to canvas or ink for primary-ink, whichever reads better on primary", () => {
    // Primary only on link text: no filled button to measure.
    const link = () => sample({ tag: "a", area: 3000, color: "#1d4ed8" });
    const { colors, derived } = completePalette([page(), text("#111111"), link(), link(), link()]);
    expect(derived).toContain("primary-ink");
    expect(distance(colors["primary-ink"], "#ffffff")).toBeLessThan(1); // white on dark blue
  });

  it("uses the neutral first-screen CTA as primary on monochrome sites (Vercel)", () => {
    const { colors, derived, monochrome } = completePalette([
      page(),
      text("#171717"),
      button("#000000", "#ffffff", { y: 300 }),
      button("#000000", "#ffffff", { y: 2000 }),
    ]);
    expect(monochrome).toBe(true);
    expect(distance(colors.primary, "#000000")).toBeLessThan(1);
    expect(derived).not.toContain("primary");
  });

  it("falls back to ink for primary when there is no CTA at all", () => {
    const { colors, derived, monochrome } = completePalette([page(), text("#171717")]);
    expect(monochrome).toBe(true);
    expect(colors.primary).toBe(colors.ink);
    expect(derived).toContain("primary");
  });

  it("falls back to primary for accent, and mixes ink into canvas for ink-muted and hairline", () => {
    const { colors, derived } = completePalette([page(), text("#000000")]);
    expect(colors.accent).toBe(colors.primary);
    expect(derived).toEqual(expect.arrayContaining(["accent", "ink-muted", "hairline"]));
    const [ink, muted, hairline, canvas] = ["ink", "ink-muted", "hairline", "canvas"].map((r) =>
      lightness(colors[r as ColorRole]),
    ) as [number, number, number, number];
    expect(ink).toBeLessThan(muted);
    expect(muted).toBeLessThan(hairline);
    expect(hairline).toBeLessThan(canvas);
  });

  it("builds semantic colors on fixed hues at the primary's lightness, inside sRGB", () => {
    const buttons = [0, 1, 2].map(() => button("#2563eb"));
    const { colors } = completePalette([page(), text("#111111"), ...buttons]);
    const primaryL = lightness(colors.primary);
    for (const role of ["success", "warning", "danger", "info"] as const) {
      const c = parseCssColor(colors[role]);
      expect(c, role).not.toBeNull();
      expect(c?.h ?? 0, role).toBeCloseTo(SEMANTIC_HUE[role], 0);
      expect(c?.l ?? 0, role).toBeCloseTo(Math.min(0.7, Math.max(0.5, primaryL)), 2);
      expect(displayable(c ?? "black"), `${role} in sRGB`).toBe(true);
    }
  });

  it("uses default semantic lightness and chroma when the primary is neutral", () => {
    const { colors } = completePalette([page(), text("#111111")]);
    expect(lightness(colors.success)).toBeCloseTo(0.6, 2);
  });

  it("is deterministic", () => {
    const samples = [
      page(),
      text("#111111"),
      button("#2563eb"),
      button("#2563eb"),
      button("#2563eb"),
    ];
    expect(completePalette(samples)).toEqual(completePalette([...samples]));
  });
});
