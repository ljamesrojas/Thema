import { describe, expect, it } from "vitest";
import { analyzeTypography, FALLBACK_SANS, parseFontFamily } from "../src/typography.js";
import type { StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

const INTER = '"Inter", ui-sans-serif, system-ui, sans-serif';

/** A text sample at a given size; `area` doubles as its weight for body text. */
const text = (fontSize: number, area: number, extra: Partial<StyleSample> = {}): StyleSample =>
  sample({ tag: "p", role: "body", fontFamily: INTER, fontSize, area, ...extra });

const names = (samples: StyleSample[]) =>
  analyzeTypography(samples).scale.map((s) => `${s.name}:${s.size}`);

describe("parseFontFamily", () => {
  it("strips quotes and extra whitespace", () => {
    expect(parseFontFamily('"Inter",  ui-sans-serif, sans-serif')).toEqual({
      name: "Inter",
      category: "sans",
    });
    expect(parseFontFamily("'Geist   Mono' , monospace")?.name).toBe("Geist Mono");
  });

  it("classifies from the first generic fallback, case-insensitively", () => {
    expect(parseFontFamily('"Source Serif 4", Georgia, Serif')?.category).toBe("serif");
    expect(parseFontFamily('"Geist Mono", ui-monospace, monospace')?.category).toBe("mono");
    expect(parseFontFamily('"Lobster", cursive')?.category).toBe("display");
    expect(parseFontFamily("Brand, SANS-SERIF")?.category).toBe("sans");
  });

  it("classifies from the name when there is no generic", () => {
    expect(parseFontFamily("JetBrains Mono")?.category).toBe("mono");
    expect(parseFontFamily("Fira Code")?.category).toBe("mono");
    expect(parseFontFamily("PT Serif")?.category).toBe("serif");
    expect(parseFontFamily("Georgia")?.category).toBe("serif");
    expect(parseFontFamily("Open Sans")?.category).toBe("sans");
    expect(parseFontFamily("Microsoft Sans Serif")?.category).toBe("sans");
  });

  it("skips icon fonts", () => {
    expect(parseFontFamily('"Font Awesome 6 Free", "Inter", sans-serif')?.name).toBe("Inter");
    expect(parseFontFamily('"Material Symbols Outlined"')).toBeNull();
  });

  it("uses the generic itself when the stack has no named family", () => {
    expect(parseFontFamily("system-ui, sans-serif")).toEqual({
      name: "system-ui",
      category: "sans",
    });
    expect(parseFontFamily("")).toBeNull();
  });
});

describe("analyzeTypography: families", () => {
  it("picks the heaviest family per category", () => {
    const { families } = analyzeTypography([
      text(16, 50_000),
      text(16, 10_000, { fontFamily: "Roboto, sans-serif" }),
      text(19, 80_000, { fontFamily: '"Source Serif 4", Georgia, serif' }),
      text(14, 5000, { fontFamily: '"Geist Mono", monospace' }),
    ]);
    expect(families).toEqual({ sans: "Inter", serif: "Source Serif 4", mono: "Geist Mono" });
  });

  it("detects a headings-only family as display", () => {
    const { families } = analyzeTypography([
      text(16, 100_000),
      sample({ tag: "h1", fontFamily: '"Playfair Display", serif', fontSize: 56, area: 60_000 }),
      sample({ tag: "h2", fontFamily: '"Playfair Display", serif', fontSize: 32, area: 20_000 }),
    ]);
    expect(families).toEqual({ sans: "Inter", display: "Playfair Display" });
  });

  it("doesn't call a family display when it also carries body text", () => {
    const serif = '"Source Serif 4", serif';
    const { families } = analyzeTypography([
      text(19, 100_000, { fontFamily: serif }),
      sample({ tag: "h1", fontFamily: serif, fontSize: 56, area: 60_000 }),
      text(14, 10_000),
    ]);
    expect(families).toEqual({ sans: "Inter", serif: "Source Serif 4" });
  });

  it("doesn't call the only family display, even on a headings-only page", () => {
    const { families } = analyzeTypography([
      sample({ tag: "h1", fontFamily: INTER, fontSize: 48, area: 50_000 }),
    ]);
    expect(families).toEqual({ sans: "Inter" });
  });

  it("falls back to system-ui when there is no sans family", () => {
    const { families } = analyzeTypography([text(18, 10_000, { fontFamily: "Georgia, serif" })]);
    expect(families).toEqual({ sans: FALLBACK_SANS, serif: "Georgia" });
  });

  it("ignores containers, whose font is only inherited", () => {
    const { families } = analyzeTypography([
      sample({ tag: "main", role: "container", fontFamily: "Arial, sans-serif", area: 900_000 }),
      text(16, 1000),
    ]);
    expect(families.sans).toBe("Inter");
  });
});

describe("analyzeTypography: scale", () => {
  it("uses the heaviest body-text size as base, not the biggest heading area", () => {
    const steps = analyzeTypography([
      text(16, 50_000),
      sample({ tag: "h1", fontFamily: INTER, fontSize: 48, area: 200_000 }),
    ]).scale;
    expect(steps.find((s) => s.name === "base")?.size).toBe(16);
  });

  it("ignores container font sizes", () => {
    expect(
      names([
        sample({ tag: "body", role: "container", fontSize: 10, area: 2_000_000 }),
        text(16, 1000),
      ]),
    ).toEqual(["base:16"]);
  });

  it("drops sizes under 1% of text weight", () => {
    expect(names([text(16, 100_000), text(11, 900), text(14, 2000)])).toEqual(["sm:14", "base:16"]);
  });

  it("names a single smaller size sm", () => {
    expect(names([text(16, 10_000), text(14, 5000), text(20, 5000)])).toEqual([
      "sm:14",
      "base:16",
      "lg:20",
    ]);
  });

  it("keeps the heaviest sizes when there are more than the slots", () => {
    const samples = [
      text(16, 100_000),
      text(15, 20_000),
      text(14, 30_000),
      text(13, 25_000),
      text(12, 2000),
      ...[18, 20, 24, 30, 36, 48, 60].map((size, i) =>
        sample({ tag: "h2", fontFamily: INTER, fontSize: size, area: 10_000 + i * 1000 }),
      ),
    ];
    // Below: 14 and 13 outweigh 15 and 12. Above: the five heaviest are 24 … 60.
    expect(names(samples)).toEqual([
      "xs:13",
      "sm:14",
      "base:16",
      "lg:24",
      "xl:30",
      "2xl:36",
      "3xl:48",
      "4xl:60",
    ]);
  });

  it("rounds sizes to 0.5px", () => {
    expect(names([text(15.98, 1000), text(16.1, 1000)])).toEqual(["base:16"]);
  });

  it("takes per-step attributes by raw area, so semibold buttons don't set the body weight", () => {
    const [step] = analyzeTypography([
      text(16, 60_000, { fontWeight: 400, lineHeight: 24 }),
      // 30k area × 3 (interactive) = 90k weight, but only 30k area.
      sample({
        tag: "button",
        fontFamily: INTER,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 20,
        area: 30_000,
      }),
    ]).scale;
    expect(step).toMatchObject({ name: "base", weight: 400, lineHeight: 1.5 });
  });

  it("keeps line height unitless, tracking in em and the dominant weight per step", () => {
    const [step] = analyzeTypography([
      sample({
        tag: "h1",
        fontFamily: INTER,
        fontSize: 60,
        lineHeight: 72,
        letterSpacing: -1.5,
        fontWeight: 700,
        area: 50_000,
      }),
      sample({
        tag: "h1",
        fontFamily: INTER,
        fontSize: 60,
        lineHeight: 66,
        letterSpacing: 0,
        fontWeight: 800,
        area: 10_000,
      }),
    ]).scale;
    expect(step).toEqual({
      name: "base",
      size: 60,
      lineHeight: 1.2,
      weight: 700,
      tracking: -0.025,
    });
  });

  it("estimates the ratio as the median per-step ratio", () => {
    // A perfect 1.25 scale around 16.
    const sizes = [10.24, 12.8, 20, 25, 31.25].map((size) => text(size, 5000));
    const { ratio, scale } = analyzeTypography([text(16, 100_000), ...sizes]);
    expect(scale).toHaveLength(6);
    expect(ratio).toBeCloseTo(1.25, 2);
  });

  it("returns ratio 1 when only base exists, and an empty scale for no text", () => {
    expect(analyzeTypography([text(16, 1000)]).ratio).toBe(1);
    expect(analyzeTypography([])).toEqual({
      families: { sans: FALLBACK_SANS },
      scale: [],
      ratio: 1,
    });
  });
});
