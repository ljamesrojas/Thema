import { describe, expect, it } from "vitest";
import { analyzeRadius, analyzeShadow, formatBoxShadow, parseBoxShadow } from "../src/shape.js";
import { sample } from "./helpers.js";

const radius = (...values: number[]) => values.map((borderRadius) => sample({ borderRadius }));
const shadow = (...values: string[]) => values.map((boxShadow) => sample({ boxShadow }));

describe("analyzeRadius", () => {
  it("uses the most common radius as md, with sm below and lg above", () => {
    expect(analyzeRadius(radius(8, 8, 8, 4, 4, 12, 16, 16))).toEqual({
      sm: 4,
      md: 8,
      lg: 16,
      full: 9999,
    });
  });

  it("breaks ties by closeness to md", () => {
    expect(analyzeRadius(radius(8, 8, 4, 6, 12, 24))).toEqual({ sm: 6, md: 8, lg: 12, full: 9999 });
  });

  it("skips zero and pill radii", () => {
    expect(analyzeRadius(radius(0, 0, 0, 0, 9999, 9999, 9999, 6))).toEqual({
      sm: 6,
      md: 6,
      lg: 6,
      full: 9999,
    });
  });

  it("falls back to md when nothing is smaller or larger", () => {
    expect(analyzeRadius(radius(2, 2, 2, 4))).toEqual({ sm: 2, md: 2, lg: 4, full: 9999 });
  });

  it("is all zeros for a square design", () => {
    expect(analyzeRadius(radius(0, 0))).toEqual({ sm: 0, md: 0, lg: 0, full: 9999 });
    expect(analyzeRadius([])).toEqual({ sm: 0, md: 0, lg: 0, full: 9999 });
  });
});

describe("parseBoxShadow", () => {
  it("parses Chrome's color-first computed form into OKLCH", () => {
    const [layer] = parseBoxShadow("rgba(15, 23, 42, 0.06) 0px 1px 2px 0px");
    expect(layer).toMatchObject({ inset: false, x: 0, y: 1, blur: 2, spread: 0 });
    expect(layer?.color).toMatch(/^oklch\(.+ \/ 0\.06\)$/);
  });

  it("accepts the color last and missing blur/spread", () => {
    const [layer] = parseBoxShadow("2px 4px #000");
    expect(layer).toMatchObject({ x: 2, y: 4, blur: 0, spread: 0, color: "oklch(0 0 0)" });
  });

  it("splits layers at commas outside rgba()", () => {
    const layers = parseBoxShadow(
      "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px",
    );
    expect(layers).toHaveLength(2);
    expect(layers[1]?.spread).toBe(-1);
  });

  it("reads inset and drops layers with no visible color", () => {
    expect(parseBoxShadow("inset 0px 1px 0px 0px #ffffff")[0]?.inset).toBe(true);
    expect(parseBoxShadow("rgba(0, 0, 0, 0) 0px 0px 0px 0px")).toEqual([]);
    expect(parseBoxShadow("none")).toEqual([]);
  });

  it("round-trips through the canonical format", () => {
    const layers = parseBoxShadow("rgba(0, 0, 0, 0.4) 0px 8px 24px 0px");
    expect(formatBoxShadow(layers)).toMatch(/^0px 8px 24px 0px oklch\(0 0 0 \/ 0\.4\)$/);
    expect(formatBoxShadow(parseBoxShadow(formatBoxShadow(layers)))).toBe(formatBoxShadow(layers));
  });
});

describe("analyzeShadow", () => {
  const small = "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px";
  const medium = "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px";
  const large = "rgba(0, 0, 0, 0.25) 0px 20px 25px -5px";

  it("uses the most common shadow as md, ranked by blur + |y|", () => {
    const result = analyzeShadow(shadow(medium, medium, medium, small, large));
    const canonical = (css: string) => formatBoxShadow(parseBoxShadow(css));
    expect(result).toEqual({ sm: canonical(small), md: canonical(medium), lg: canonical(large) });
  });

  it("falls back to md for missing steps", () => {
    const result = analyzeShadow(shadow(small, small));
    expect(result.sm).toBe(result.md);
    expect(result.lg).toBe(result.md);
    expect(result.md).not.toBe("none");
  });

  it("skips inset-only shadows and none", () => {
    expect(analyzeShadow(shadow("inset 0px 2px 4px 0px rgba(0, 0, 0, 0.1)", "none"))).toEqual({
      sm: "none",
      md: "none",
      lg: "none",
    });
  });

  it("is all none with no shadows", () => {
    expect(analyzeShadow([sample()])).toEqual({ sm: "none", md: "none", lg: "none" });
  });

  it("doesn't depend on sample order", () => {
    const input = shadow(small, large, medium);
    expect(analyzeShadow([...input].reverse())).toEqual(analyzeShadow(input));
  });
});
