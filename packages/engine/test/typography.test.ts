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

  it("reports a leading system keyword as system-ui, never a font listed after it", () => {
    // The browser resolves these to the machine's font (Segoe UI, San Francisco…), so the
    // result would depend on the OS that recorded the page.
    const stacks = [
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'BlinkMacSystemFont, "Segoe UI", Helvetica, Arial',
      'system-ui, "Segoe UI", Roboto',
    ];
    for (const stack of stacks) {
      expect(parseFontFamily(stack), stack).toEqual({ name: "system-ui", category: "sans" });
    }
  });

  it("keeps a leading ui-* keyword as is", () => {
    expect(
      parseFontFamily('ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'),
    ).toEqual({ name: "ui-monospace", category: "mono" });
    expect(parseFontFamily("ui-serif, Georgia, Cambria, serif")).toEqual({
      name: "ui-serif",
      category: "serif",
    });
    expect(parseFontFamily("ui-sans-serif, system-ui, Arial")).toEqual({
      name: "ui-sans-serif",
      category: "sans",
    });
  });

  it("reads Apple's -apple-system-ui-serif as ui-serif", () => {
    expect(parseFontFamily("-apple-system-ui-serif, ui-serif, Georgia, serif")).toEqual({
      name: "ui-serif",
      category: "serif",
    });
  });

  it("still takes the first named family when it comes before the generics", () => {
    expect(parseFontFamily('"Inter", -apple-system, system-ui, sans-serif')?.name).toBe("Inter");
  });

  it("strips variable-font suffixes", () => {
    expect(parseFontFamily('"Mona Sans VF", -apple-system, sans-serif')?.name).toBe("Mona Sans");
    expect(parseFontFamily('"Inter Variable", sans-serif')?.name).toBe("Inter");
    expect(parseFontFamily("sohne-var, Helvetica Neue, Arial")?.name).toBe("sohne");
    expect(parseFontFamily("Recursive var, monospace")?.name).toBe("Recursive");
    // "Variable" in the middle is part of the name.
    expect(parseFontFamily('"Segoe UI Variable Text", sans-serif')?.name).toBe(
      "Segoe UI Variable Text",
    );
  });
});

describe("analyzeTypography: families", () => {
  it("picks the heaviest family per category", () => {
    const { families } = analyzeTypography([
      text(16, 50_000),
      text(16, 10_000, { fontFamily: "Roboto, sans-serif" }),
      text(19, 80_000, { fontFamily: '"Source Serif 4", Georgia, serif' }),
      // In code: a single mono element only counts there (see "minimum family share").
      text(14, 5000, { tag: "code", fontFamily: '"Geist Mono", monospace', inCode: true }),
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

  it("merges variable-font names with the base family, summing their weight", () => {
    // Inter alone (30k) loses to Roboto (40k); with "Inter Variable" (20k) it wins.
    const { families } = analyzeTypography([
      text(16, 30_000),
      text(16, 20_000, { fontFamily: '"Inter Variable", sans-serif' }),
      text(16, 40_000, { fontFamily: "Roboto, sans-serif" }),
    ]);
    expect(families.sans).toBe("Inter");
  });
});

describe("analyzeTypography: minimum family share", () => {
  const SERIF = '"Lyon Text", Georgia, serif';
  const MONO = '"Geist Mono", ui-monospace, monospace';

  it("drops non-mono families under 2% of text weight", () => {
    // Notion: Lyon Text is 1.3% of text weight.
    const { families } = analyzeTypography([
      text(16, 98_700),
      text(16, 1300, { fontFamily: SERIF }),
    ]);
    expect(families).toEqual({ sans: "Inter" });
  });

  it("keeps a family at 2% or more", () => {
    const { families } = analyzeTypography([
      text(16, 97_000),
      text(16, 3000, { fontFamily: SERIF }),
    ]);
    expect(families).toEqual({ sans: "Inter", serif: "Lyon Text" });
  });

  it("drops a single stray mono element (a chat widget, a cookie banner)", () => {
    const { families } = analyzeTypography([
      text(16, 99_600),
      text(12, 400, { tag: "span", fontFamily: MONO }),
    ]);
    expect(families).toEqual({ sans: "Inter" });
  });

  it("keeps a tiny mono family on 3 label spans, ignoring the 2% share", () => {
    // Glossier: Apercu Mono tag labels are 0.05% of text weight.
    const label = () => text(12, 50, { tag: "span", fontFamily: MONO });
    const { families } = analyzeTypography([text(16, 99_850), label(), label(), label()]);
    expect(families).toEqual({ sans: "Inter", mono: "Geist Mono" });
  });

  it("keeps a mono family used in a single code block", () => {
    const { families } = analyzeTypography([
      text(16, 99_600),
      text(14, 400, { tag: "code", fontFamily: MONO, inCode: true }),
    ]);
    expect(families).toEqual({ sans: "Inter", mono: "Geist Mono" });
  });

  it("drops a non-mono family under 2% even on many elements", () => {
    const stray = () => text(14, 100, { fontFamily: SERIF });
    const { families } = analyzeTypography([
      text(16, 99_000),
      ...Array.from({ length: 10 }, stray),
    ]);
    expect(families).toEqual({ sans: "Inter" });
  });
});

describe("analyzeTypography: display and heading", () => {
  const h = (tag: string, fontFamily: string, fontSize: number, area: number) =>
    sample({ tag, fontFamily, fontSize, area });

  it("counts text inside a heading as heading-like, including nested spans", () => {
    // Mozilla: the headline face is set on spans inside the h1/h2, which record as body.
    const HEADLINE = '"Mozilla Headline", sans-serif';
    const { families } = analyzeTypography([
      text(16, 100_000),
      text(18, 20_000, { tag: "span", fontFamily: HEADLINE, inHeading: true }),
      h("h2", HEADLINE, 18, 5000),
    ]);
    expect(families).toEqual({ sans: "Inter", display: "Mozilla Headline" });
  });

  it("counts large text (20px and up) as heading-like", () => {
    // Supabase: Manrope on headings and on 22px quotes in plain paragraphs.
    const MANROPE = "Manrope, sans-serif";
    const { families } = analyzeTypography([
      text(16, 100_000),
      h("h2", MANROPE, 36, 6000),
      text(22, 4000, { fontFamily: MANROPE }),
    ]);
    expect(families).toEqual({ sans: "Inter", display: "Manrope" });
  });

  it("keeps a 21px body serif as the serif family, not display", () => {
    // Editorial sites with large body text: 21px paragraphs are the body, not headings.
    const SERIF = '"Source Serif 4", Georgia, serif';
    const { families } = analyzeTypography([
      text(21, 120_000, { fontFamily: SERIF }),
      h("h1", SERIF, 48, 20_000),
      text(14, 30_000), // sans UI text: captions, nav
      sample({ tag: "a", fontFamily: INTER, fontSize: 14, area: 10_000 }),
    ]);
    expect(families).toEqual({ sans: "Inter", serif: "Source Serif 4" });
  });

  it("makes the family of the largest heading text display, and the next one heading", () => {
    // Resend: Domaine on the 96px hero, ABC Favorit on the h2/h3s (more area, smaller).
    const { families } = analyzeTypography([
      text(16, 100_000, { fontFamily: '"Inter Website", sans-serif' }),
      h("h1", "domaine, serif", 96, 15_000),
      h("h2", "aBCFavorit, sans-serif", 56, 25_000),
      h("h3", "aBCFavorit, sans-serif", 24, 15_000),
    ]);
    expect(families).toEqual({ sans: "Inter Website", display: "domaine", heading: "aBCFavorit" });
  });

  it("reports no heading slot when only one family is heading-only", () => {
    const { families } = analyzeTypography([
      text(16, 100_000),
      h("h1", '"Playfair Display", serif', 56, 30_000),
    ]);
    expect(families).toEqual({ sans: "Inter", display: "Playfair Display" });
    expect(families).not.toHaveProperty("heading");
  });

  it("never makes a mono family display, even when it sets the largest heading", () => {
    // GitHub: Mona Sans Mono reaches 64px, above any Mona Sans text.
    const MONO = '"Mona Sans Mono", monospace';
    const { families } = analyzeTypography([
      text(16, 100_000, { fontFamily: '"Mona Sans VF", sans-serif' }),
      h("h2", MONO, 64, 6000),
      h("h2", MONO, 48, 3000),
      h("h3", MONO, 32, 2000),
    ]);
    expect(families).toEqual({ sans: "Mona Sans", mono: "Mona Sans Mono" });
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
