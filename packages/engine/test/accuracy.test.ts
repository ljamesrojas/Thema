import { describe, expect, it } from "vitest";
import {
  scoreFixture,
  summarizeAccuracy,
  type FixtureExpected,
  type FixtureScore,
} from "../src/accuracy.js";
import type { StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

const INTER = '"Inter", ui-sans-serif, system-ui, sans-serif';

/** A small site: white page, three blue buttons, Inter text, 8px-grid padding. */
function site(primary = "#2563eb"): StyleSample[] {
  const button = () =>
    sample({
      tag: "button",
      area: 8000,
      backgroundColor: primary,
      color: "#ffffff",
      fontFamily: INTER,
      padding: [8, 16, 8, 16],
    });
  return [
    sample({ tag: "html", role: "container", area: 1_000_000, backgroundColor: "#ffffff" }),
    sample({ tag: "p", area: 50_000, color: "#111111", fontFamily: INTER, margin: [0, 0, 16, 0] }),
    sample({ tag: "p", area: 50_000, color: "#111111", fontFamily: INTER, margin: [0, 0, 16, 0] }),
    button(),
    button(),
    button(),
  ];
}

const expected = (overrides: Partial<FixtureExpected> = {}): FixtureExpected => ({
  source: "recorded",
  roles: { primary: "#2563eb" },
  typography: { families: { sans: "Inter" } },
  spacing: { base: 8 },
  ...overrides,
});

describe("scoreFixture: primary", () => {
  it("passes within ΔE 5, accepting hex", () => {
    expect(scoreFixture(site(), expected()).primary).toMatchObject({
      status: "pass",
      detail: "ΔE 0.0",
    });
  });

  it("fails at ΔE 5 or more and reports the distance", () => {
    // #2563eb → #1d4ed8 is ΔE ≈ 5.8.
    const result = scoreFixture(site("#1d4ed8"), expected()).primary;
    expect(result.status).toBe("fail");
    expect(result.detail).toMatch(/^ΔE 5\.\d$/);
  });

  it("passes just under the line", () => {
    // #2563eb → #2a5ee0 is ΔE ≈ 2: same blue, slightly different shade.
    expect(scoreFixture(site("#2a5ee0"), expected()).primary.status).toBe("pass");
  });

  it("treats null as 'this site has no primary'", () => {
    const mono = site("#333333"); // neutral buttons: no saturated primary
    expect(scoreFixture(mono, expected({ roles: { primary: null } })).primary.status).toBe("pass");
    expect(scoreFixture(site(), expected({ roles: { primary: null } })).primary.status).toBe(
      "fail",
    );
    expect(scoreFixture(mono, expected()).primary.status).toBe("fail");
  });

  it("is missing when primary isn't filled in", () => {
    expect(scoreFixture(site(), expected({ roles: {} })).primary.status).toBe("missing");
    expect(scoreFixture(site(), { source: "recorded" }).primary.status).toBe("missing");
  });
});

describe("scoreFixture: fonts", () => {
  it("passes on the same families, ignoring case, quotes and spacing", () => {
    const result = scoreFixture(
      site(),
      expected({ typography: { families: { sans: " 'inter' " } } }),
    );
    expect(result.fonts).toMatchObject({ status: "pass", got: "sans Inter" });
  });

  it("fails on a different name or an extra/missing category", () => {
    expect(
      scoreFixture(site(), expected({ typography: { families: { sans: "Roboto" } } })).fonts.status,
    ).toBe("fail");
    const extra = expected({ typography: { families: { sans: "Inter", mono: "Geist Mono" } } });
    expect(scoreFixture(site(), extra).fonts).toMatchObject({
      status: "fail",
      expected: "sans Inter, mono Geist Mono",
      got: "sans Inter",
    });
  });

  it("is missing when families aren't filled in", () => {
    expect(scoreFixture(site(), expected({ typography: {} })).fonts.status).toBe("missing");
  });
});

describe("scoreFixture: spacing", () => {
  it("compares the base unit", () => {
    expect(scoreFixture(site(), expected()).spacing).toMatchObject({ status: "pass", got: "8" });
    expect(scoreFixture(site(), expected({ spacing: { base: 4 } })).spacing.status).toBe("fail");
    expect(scoreFixture(site(), expected({ spacing: {} })).spacing.status).toBe("missing");
  });
});

describe("summarizeAccuracy", () => {
  const score = (...statuses: ("pass" | "fail" | "missing")[]): FixtureScore => {
    const [primary = "pass", fonts = "pass", spacing = "pass"] = statuses;
    const r = (status: "pass" | "fail" | "missing") => ({ status, expected: "", got: "" });
    return { primary: r(primary), fonts: r(fonts), spacing: r(spacing) };
  };

  it("is the share of individual checks that pass; missing counts as not passed", () => {
    const summary = summarizeAccuracy([
      score("pass", "pass", "pass"),
      score("pass", "fail", "missing"),
    ]);
    expect(summary).toEqual({ passed: 4, total: 6, missing: 1, ratio: 4 / 6 });
  });

  it("puts 18 of 20 sites with one miss each at exactly 90%", () => {
    const scores = [
      ...Array.from({ length: 14 }, () => score()),
      ...Array.from({ length: 6 }, () => score("fail")),
    ];
    expect(summarizeAccuracy(scores).ratio).toBeCloseTo(54 / 60);
    expect(summarizeAccuracy(scores).ratio).toBeCloseTo(0.9);
  });

  it("is 0 with nothing to score", () => {
    expect(summarizeAccuracy([])).toEqual({ passed: 0, total: 0, missing: 0, ratio: 0 });
  });
});
