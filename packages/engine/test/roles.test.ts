import { describe, expect, it } from "vitest";
import { analyzeColors } from "../src/colors.js";
import type { StyleSample } from "../src/types.js";
import { distance, sample } from "./helpers.js";

/** Assert a role was assigned and is within ΔE 1 of the expected CSS color. */
function expectRole(actual: string | undefined, expected: string): void {
  expect(actual, `expected a color close to ${expected}`).toBeDefined();
  expect(distance(actual ?? "", expected)).toBeLessThan(1);
}

const page = (bg = "#ffffff", area = 1_000_000): StyleSample =>
  sample({ tag: "body", role: "container", area, backgroundColor: bg, color: "#111111" });

const button = (bg: string, area = 8000): StyleSample =>
  sample({ tag: "button", area, backgroundColor: bg, color: "#ffffff" });

describe("analyzeColors: canvas", () => {
  it("returns empty roles for no samples", () => {
    expect(analyzeColors([])).toEqual({ roles: {}, confidence: {} });
  });

  it("picks the largest background by raw area, ignoring importance weights", () => {
    const { roles } = analyzeColors([
      page("#ffffff", 400_000),
      // Interactive weight ×3 would make this 450k, but canvas ranks by raw area only.
      button("#2563eb", 150_000),
    ]);
    expectRole(roles.canvas, "#ffffff");
  });

  it("ignores fully transparent backgrounds", () => {
    const { roles } = analyzeColors([
      sample({ area: 2_000_000, backgroundColor: "rgba(0, 0, 0, 0)" }),
      sample({ area: 2_000_000, backgroundColor: "transparent" }),
      page("#faf6ee", 500_000),
    ]);
    expectRole(roles.canvas, "#faf6ee");
  });
});

describe("analyzeColors: surface", () => {
  it("takes the next neutral background close to the canvas", () => {
    const { roles } = analyzeColors([
      page("#ffffff"),
      sample({ area: 200_000, backgroundColor: "#eef2f7" }),
    ]);
    expectRole(roles.surface, "#eef2f7");
  });

  it("rejects a large background that is far from the canvas", () => {
    const { roles } = analyzeColors([
      page("#ffffff"),
      sample({ tag: "footer", role: "container", area: 400_000, backgroundColor: "#0b1120" }),
      sample({ area: 100_000, backgroundColor: "#eef2f7" }),
    ]);
    expectRole(roles.surface, "#eef2f7");
  });

  it("rejects a saturated background", () => {
    const { roles } = analyzeColors([
      page("#ffffff"),
      sample({ area: 300_000, backgroundColor: "#dbeafe" }), // light blue, chroma ≈ 0.05
      sample({ area: 300_000, backgroundColor: "#fde047" }), // yellow, saturated
    ]);
    expectRole(roles.surface, "#dbeafe");
  });

  it("is omitted when nothing qualifies", () => {
    const { roles } = analyzeColors([
      page("#ffffff"),
      sample({ area: 300_000, backgroundColor: "#111827" }),
    ]);
    expect(roles.surface).toBeUndefined();
  });
});

describe("analyzeColors: ink and ink-muted", () => {
  const text = (color: string, area: number, tag = "p"): StyleSample =>
    sample({ tag, area, color });

  it("picks the main dark text as ink and the lighter one as ink-muted", () => {
    const { roles } = analyzeColors([page(), text("#0f172a", 50_000), text("#64748b", 30_000)]);
    expectRole(roles.ink, "#0f172a");
    expectRole(roles["ink-muted"], "#64748b");
  });

  it("prefers contrast over volume: muted copy that outweighs the main text stays muted", () => {
    // example.com's real areas: one black paragraph (31,941 px²) vs faded gray ones (149,033 px²),
    // so black has 21% of the gray's weight.
    const { roles } = analyzeColors([page(), text("#000000", 31_941), text("#666666", 149_033)]);
    expectRole(roles.ink, "#000000");
    expectRole(roles["ink-muted"], "#666666");
  });

  it("ignores a darker text color used too little to count (< 20% of the top)", () => {
    // A 5k black footnote vs 50k of #333 body text: 10%, so not an ink candidate.
    const { roles } = analyzeColors([page(), text("#333333", 50_000), text("#000000", 5_000)]);
    expectRole(roles.ink, "#333333");
  });

  it("counts headings extra when deciding what is substantial", () => {
    // 6k heading × 2 = 12k is 24% of the 50k body text: substantial, and darker, so it's ink.
    // Without the heading weight it would be 12%, below the 20% cut.
    const heading = analyzeColors([page(), text("#111111", 6_000, "h1"), text("#555555", 50_000)]);
    expectRole(heading.roles.ink, "#111111");
    const plain = analyzeColors([page(), text("#111111", 6_000), text("#555555", 50_000)]);
    expectRole(plain.roles.ink, "#555555");
  });

  it("needs 20% of the top text weight: 17% black doesn't take ink (Notion), 21% does", () => {
    const body = () => text("#0d0d0d", 50_000);
    const notion = analyzeColors([
      page(),
      body(),
      body(),
      text("#000000", 8_500),
      text("#000000", 8_500),
    ]);
    expectRole(notion.roles.ink, "#0d0d0d"); // 17k of 100k
    const more = analyzeColors([
      page(),
      body(),
      body(),
      text("#000000", 10_500),
      text("#000000", 10_500),
    ]);
    expectRole(more.roles.ink, "#000000"); // 21k of 100k
  });

  it("prefers a color used on 2+ elements over one giant heading (Medium's hero)", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "h2", fontSize: 120, area: 144_000, color: "#000000" }), // one hero heading
      text("#242424", 30_000, "h3"),
      text("#242424", 20_000, "a"),
      text("#242424", 20_000, "a"),
      text("#6b6b6b", 120_000),
      text("#6b6b6b", 100_000),
    ]);
    expectRole(roles.ink, "#242424");
    expectRole(roles["ink-muted"], "#6b6b6b");
  });

  it("falls back to single-element colors when no color is on 2+ elements", () => {
    // A tiny page: one heading, one paragraph.
    const { roles } = analyzeColors([
      page(),
      text("#000000", 20_000, "h1"),
      text("#555555", 40_000),
    ]);
    expectRole(roles.ink, "#000000");
  });

  it("ignores the color of card-sized interactive elements: their text is in children (Stripe)", () => {
    // Bento-card buttons keep the browser's default black but show none of it; the visible text
    // is #061b31 headings and #50617a copy.
    const card = (width: number, height: number) =>
      sample({ tag: "button", color: "#000000", width, height, area: width * height });
    const { roles } = analyzeColors([
      page(),
      card(816, 676),
      card(400, 676),
      card(1232, 450),
      text("#061b31", 40_000, "h2"),
      text("#061b31", 30_000),
      text("#50617a", 120_000),
      text("#50617a", 90_000),
    ]);
    expectRole(roles.ink, "#061b31");
    expectRole(roles["ink-muted"], "#50617a");
  });

  it("still counts button-sized interactive text", () => {
    const link = () => sample({ tag: "a", color: "#000000", width: 120, height: 24, area: 30_000 });
    const { roles } = analyzeColors([page(), link(), link(), text("#444444", 50_000)]);
    expectRole(roles.ink, "#000000");
  });

  it("judges ink by its text color, even when it shares a cluster with a more saturated background", () => {
    // Stripe: #061b31 text (chroma 0.051) clusters with a navy section background (chroma
    // 0.066, ΔE ≈ 2.3 away), which made the whole cluster "saturated" and dropped the real ink.
    const { roles } = analyzeColors([
      page(),
      sample({
        tag: "section",
        role: "container",
        area: 600_000,
        backgroundColor: "oklch(0.217 0.066 267.9)",
      }),
      text("#061b31", 40_000, "h2"),
      text("#061b31", 40_000),
      text("#50617a", 120_000),
      text("#50617a", 90_000),
    ]);
    expectRole(roles.ink, "#061b31");
  });

  it("ignores container text color, which is only inherited", () => {
    const { roles } = analyzeColors([
      sample({
        tag: "main",
        role: "container",
        area: 900_000,
        backgroundColor: "#ffffff",
        color: "#ff0000",
      }),
      text("#222222", 10_000),
    ]);
    expectRole(roles.ink, "#222222");
  });

  it("never uses the canvas color as ink", () => {
    const { roles } = analyzeColors([
      page(),
      button("#2563eb", 5000),
      button("#2563eb", 5000),
      text("#1f2937", 3000),
    ]);
    expectRole(roles.ink, "#1f2937");
  });

  it("takes ink-muted from text lighter than ink but darker than a light canvas", () => {
    const { roles } = analyzeColors([
      page(),
      text("#0f172a", 50_000),
      text("#64748b", 30_000),
      text("#000000", 5_000), // darker than ink, so not "muted"; too little (10%) to be ink
    ]);
    expectRole(roles["ink-muted"], "#64748b");
  });

  it("works the other way round on a dark canvas", () => {
    const { roles } = analyzeColors([
      page("#0a0a0a"),
      text("#ededed", 50_000),
      text("#a1a1a1", 30_000),
      text("#ffffff", 5_000), // lighter than ink, so not "muted"; too little (10%) to be ink
    ]);
    expectRole(roles.ink, "#ededed");
    expectRole(roles["ink-muted"], "#a1a1a1");
  });
});

describe("analyzeColors: hairline", () => {
  it("is taken from border colors only", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "p", area: 90_000, color: "#9ca3af" }), // gray text, not a border
      sample({ area: 50_000, borderColor: "#e2e8f0" }),
    ]);
    expectRole(roles.hairline, "#e2e8f0");
  });

  it("composites translucent borders onto the canvas", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ area: 50_000, borderColor: "rgba(0, 0, 0, 0.08)" }),
    ]);
    expectRole(roles.hairline, "#ebebeb");
  });

  it("ignores saturated borders", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "input", area: 50_000, borderColor: "#2563eb" }),
    ]);
    expect(roles.hairline).toBeUndefined();
  });
});

describe("analyzeColors: primary and accent", () => {
  it("picks the most-weighted saturated color on interactive elements", () => {
    const { roles } = analyzeColors([
      page(),
      button("#2563eb"),
      button("#2563eb"),
      sample({ tag: "a", area: 3000, color: "#2563eb" }),
      // Big saturated decorative block, but not interactive.
      sample({ tag: "section", role: "container", area: 300_000, backgroundColor: "#7c3aed" }),
    ]);
    expectRole(roles.primary, "#2563eb");
  });

  it("lets a repeated button beat a larger one-off button (cookie banner, ad)", () => {
    const { roles } = analyzeColors([
      page(),
      button("#facc15", 20_000), // one big "Accept cookies" button: 60k × 1/3 = 20k
      button("#2563eb", 6000),
      button("#2563eb", 6000),
      sample({ tag: "a", area: 2000, color: "#2563eb" }), // 3 occurrences: 42k × 1 = 42k
    ]);
    expectRole(roles.primary, "#2563eb");
  });

  it("picks the accent as the next saturated color far enough from primary", () => {
    const { roles } = analyzeColors([
      page(),
      button("#2563eb"),
      button("#2563eb"),
      button("#2563eb"),
      button("#1d4ed8", 4000), // primary hover shade: too close to be the accent
      button("#1d4ed8", 4000),
      button("#1d4ed8", 4000),
      sample({ tag: "span", area: 3000, backgroundColor: "#7c3aed" }),
      sample({ tag: "span", area: 3000, backgroundColor: "#7c3aed" }),
      sample({ tag: "span", area: 3000, backgroundColor: "#7c3aed" }),
    ]);
    expectRole(roles.primary, "#2563eb");
    expectRole(roles.accent, "#7c3aed");
  });

  it("omits primary when there are no saturated colors", () => {
    const { roles } = analyzeColors([
      page(),
      button("#111111"),
      sample({ tag: "p", color: "#333333" }),
    ]);
    expect(roles.primary).toBeUndefined();
    expect(roles.accent).toBeUndefined();
  });
});

describe("analyzeColors: each role reports its own channel's color", () => {
  it("keeps ink as the text color when a large background of a similar shade merges with it", () => {
    // #0b1120 footer and #0f172a text are ΔE ≈ 2.9 apart, so they share a cluster.
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "footer", role: "container", area: 500_000, backgroundColor: "#0b1120" }),
      sample({ tag: "p", area: 40_000, color: "#0f172a" }),
    ]);
    expectRole(roles.ink, "#0f172a");
  });

  it("keeps the hairline as the border color when it merges with the surface", () => {
    // #e2e8f0 border and #eef2f7 surface are ΔE ≈ 3.1 apart.
    const { roles } = analyzeColors([
      page(),
      sample({ area: 300_000, backgroundColor: "#eef2f7" }),
      sample({ area: 60_000, borderColor: "#e2e8f0" }),
    ]);
    expectRole(roles.surface, "#eef2f7");
    expectRole(roles.hairline, "#e2e8f0");
  });
});

describe("analyzeColors: opacity", () => {
  it("composites faded text, so black at 0.6 on white becomes a gray ink-muted", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "p", area: 60_000, color: "#111111" }),
      sample({ tag: "p", area: 30_000, color: "#000000", opacity: 0.6 }),
    ]);
    expectRole(roles.ink, "#111111");
    // 0 × 0.6 + 255 × 0.4 = 102 → #666666
    expectRole(roles["ink-muted"], "#666666");
  });

  it("composites a faded background onto the page, so an 8% black section is a light surface", () => {
    const { roles } = analyzeColors([
      page(),
      sample({
        tag: "section",
        role: "container",
        area: 300_000,
        backgroundColor: "#000000",
        opacity: 0.08,
      }),
    ]);
    expectRole(roles.canvas, "#ffffff");
    // 255 × 0.92 ≈ 235 → #ebebeb. (At 5%, #f2f2f2 is ΔE 3.9 from white and merges into the canvas.)
    expectRole(roles.surface, "#ebebeb");
  });

  it("never uses a faded layer as the compositing backdrop", () => {
    const { roles } = analyzeColors([
      page("#ffffff", 400_000),
      // A faded black overlay larger than the page. If its unfaded black were the backdrop it
      // would composite to black; over the real white page it paints #666666.
      sample({
        tag: "div",
        role: "container",
        area: 900_000,
        backgroundColor: "#000000",
        opacity: 0.6,
      }),
    ]);
    expectRole(roles.canvas, "#666666");
  });

  it("drops a color faded to nothing", () => {
    const { roles } = analyzeColors([
      page(),
      sample({ tag: "p", area: 90_000, color: "#ff0000", opacity: 0 }),
      sample({ tag: "p", area: 10_000, color: "#222222" }),
    ]);
    expectRole(roles.ink, "#222222");
  });

  it("gives the same result as before for samples without opacity", () => {
    const samples = [page(), sample({ tag: "p", area: 30_000, color: "#333333" })];
    const withOne = samples.map((s) => ({ ...s, opacity: 1 }));
    expect(analyzeColors(withOne)).toEqual(analyzeColors(samples));
  });
});

describe("analyzeColors: confidence", () => {
  it("is 1 with no rival", () => {
    const { confidence } = analyzeColors([page()]);
    expect(confidence.canvas).toBe(1);
  });

  it("drops near 0 for a close rival and stays within 0–1", () => {
    const { confidence } = analyzeColors([
      page(),
      button("#2563eb"),
      button("#2563eb"),
      button("#2563eb"),
      button("#16a34a"),
      button("#16a34a"),
      button("#16a34a", 7000),
    ]);
    // Button backgrounds are tiny next to the page, so canvas is near-certain.
    expect(confidence.canvas).toBeGreaterThan(0.95);
    // Blue 72k vs green 69k: almost a tie.
    expect(confidence.primary).toBeGreaterThanOrEqual(0);
    expect(confidence.primary).toBeLessThan(0.2);
    for (const value of Object.values(confidence)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("assigns a confidence for every role it returns", () => {
    const { roles, confidence } = analyzeColors([
      page(),
      button("#2563eb"),
      sample({ tag: "p", color: "#222222" }),
    ]);
    expect(Object.keys(confidence).sort()).toEqual(Object.keys(roles).sort());
  });

  it("is deterministic", () => {
    const input = [page(), button("#2563eb"), sample({ tag: "p", color: "#222222" })];
    expect(analyzeColors(input)).toEqual(analyzeColors([...input]));
  });
});
