import { describe, expect, it } from "vitest";
import {
  compositeOver,
  deltaEOK,
  formatOklch,
  hueDelta,
  parseCssColor,
  withOpacity,
} from "../src/color-math.js";
import { distance } from "./helpers.js";

describe("withOpacity", () => {
  const parse = (css: string) => {
    const color = parseCssColor(css);
    if (!color) throw new Error(`fixture color must parse: ${css}`);
    return color;
  };

  it("multiplies the existing alpha by the opacity", () => {
    expect(withOpacity(parse("#000000"), 0.6).alpha).toBeCloseTo(0.6);
    expect(withOpacity(parse("rgba(0, 0, 0, 0.5)"), 0.5).alpha).toBeCloseTo(0.25);
  });

  it("leaves the color unchanged at opacity 1 or when missing", () => {
    const red = parse("#ff0000");
    expect(withOpacity(red, 1)).toBe(red);
    expect(withOpacity(red, undefined)).toBe(red);
  });

  it("clamps out-of-range opacity", () => {
    expect(withOpacity(parse("#000000"), -0.5).alpha).toBe(0);
    expect(withOpacity(parse("#000000"), 1.5).alpha ?? 1).toBe(1);
  });
});

describe("parseCssColor", () => {
  it.each(["#2563eb", "rgb(37, 99, 235)", "rgba(37, 99, 235, 0.5)", "oklch(0.546 0.215 262.9)"])(
    "parses %s to OKLCH",
    (css) => {
      const color = parseCssColor(css);
      expect(color?.mode).toBe("oklch");
      expect(color?.l).toBeCloseTo(0.546, 2);
    },
  );

  it.each(["transparent", "rgba(0, 0, 0, 0)", "rgb(255 255 255 / 0)"])("drops %s", (css) => {
    expect(parseCssColor(css)).toBeNull();
  });

  it("drops unparseable input", () => {
    expect(parseCssColor("not-a-color")).toBeNull();
    expect(parseCssColor("")).toBeNull();
  });

  it("keeps translucent colors with their alpha", () => {
    expect(parseCssColor("rgba(0, 0, 0, 0.08)")?.alpha).toBeCloseTo(0.08);
  });
});

describe("deltaEOK", () => {
  it("is scaled so white to black is about 100", () => {
    expect(distance("#ffffff", "#000000")).toBeCloseTo(100, 0);
  });

  it("is 0 for the same color and symmetric", () => {
    expect(distance("#2563eb", "rgb(37, 99, 235)")).toBeCloseTo(0, 5);
    expect(distance("#2563eb", "#7c3aed")).toBeCloseTo(distance("#7c3aed", "#2563eb"), 10);
  });
});

describe("hueDelta", () => {
  const hue = (h: number) => ({ mode: "oklch" as const, l: 0.6, c: 0.2, h });

  it("takes the short way round the hue circle", () => {
    expect(hueDelta(hue(350), hue(10))).toBe(20);
    expect(hueDelta(hue(10), hue(350))).toBe(20);
    expect(hueDelta(hue(0), hue(180))).toBe(180);
  });

  it("separates blue from violet but not from its own hover shade", () => {
    const [blue, violet, hover] = ["#2563eb", "#7c3aed", "#1d4ed8"].map(parseCssColor);
    if (!blue || !violet || !hover) throw new Error("fixture colors must parse");
    expect(hueDelta(blue, violet)).toBeGreaterThan(20);
    expect(hueDelta(blue, hover)).toBeLessThan(5);
  });
});

describe("compositeOver", () => {
  it("flattens a translucent color onto the backdrop", () => {
    const black8 = parseCssColor("rgba(0, 0, 0, 0.08)");
    const white = parseCssColor("#ffffff");
    if (!black8 || !white) throw new Error("fixture colors must parse");
    const flat = compositeOver(black8, white);
    // 255 × 0.92 ≈ 234.6 → #ebebeb
    expect(distance(formatOklch(flat), "#ebebeb")).toBeLessThan(0.5);
    expect(flat.alpha ?? 1).toBe(1);
  });

  it("returns opaque colors unchanged", () => {
    const blue = parseCssColor("#2563eb");
    const white = parseCssColor("#ffffff");
    if (!blue || !white) throw new Error("fixture colors must parse");
    expect(deltaEOK(compositeOver(blue, white), blue)).toBe(0);
  });
});

describe("formatOklch", () => {
  it("formats hueless grays with hue 0", () => {
    const white = parseCssColor("#ffffff");
    const gray = parseCssColor("#6b6b6b");
    if (!white || !gray) throw new Error("fixture colors must parse");
    expect(formatOklch(white)).toBe("oklch(1 0 0)");
    expect(formatOklch(gray)).toMatch(/^oklch\(0\.\d+ 0 0\)$/);
  });

  it("adds alpha only for translucent colors", () => {
    const translucent = parseCssColor("rgba(15, 23, 42, 0.06)");
    const opaque = parseCssColor("rgb(15, 23, 42)");
    if (!translucent || !opaque) throw new Error("fixture colors must parse");
    expect(formatOklch(translucent)).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+ \/ 0\.06\)$/);
    expect(formatOklch(opaque)).not.toContain("/");
  });

  it("rounds L and C to 3 dp and H to 1 dp", () => {
    const blue = parseCssColor("#2563eb");
    if (!blue) throw new Error("fixture color must parse");
    expect(formatOklch(blue)).toMatch(/^oklch\(0\.\d{1,3} 0\.\d{1,3} \d{1,3}(\.\d)?\)$/);
  });
});
