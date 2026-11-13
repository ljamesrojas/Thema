import { parseCssColor } from "@thema/engine";
import { converter } from "culori";
import { describe, expect, it } from "vitest";
import { exportAll } from "../src/index.js";
import { COLOR_ROLES, THEMES, toHex } from "../src/shared.js";
import { toStyleGuide } from "../src/style-guide.js";
import { fixedSystem, fixtureNames } from "./fixtures.js";

const toRgb = converter("rgb");

describe("toHex", () => {
  // Hex is 8 bits per channel, so the honest guarantee is per channel, within half a step. (ΔE
  // can't be: near black one step is a big lightness jump, oklch(0.05 0 0) → #000000.)
  it.each(fixtureNames)("%s: every color is the nearest 8-bit sRGB value", (name) => {
    const system = fixedSystem(name);
    for (const theme of THEMES) {
      for (const role of COLOR_ROLES) {
        const css = system.color[theme][role];
        const exact = toRgb(parseCssColor(css) ?? "black");
        const hex = toRgb(toHex(css));
        if (!exact || !hex) throw new Error(`unparseable ${css}`);
        for (const channel of ["r", "g", "b"] as const) {
          const v = Math.min(1, Math.max(0, exact[channel]));
          expect(Math.abs(hex[channel] - v), `${theme}.${role}.${channel}`).toBeLessThanOrEqual(
            0.5 / 255 + 1e-9,
          );
        }
      }
    }
  });

  it("writes translucent colors as 8-digit hex", () => {
    expect(toHex("oklch(0 0 0 / 0.5)")).toBe("#00000080");
    expect(toHex("oklch(1 0 0)")).toBe("#ffffff");
  });
});

describe("style-guide.html", () => {
  const html = toStyleGuide(fixedSystem("light-saas"));

  it("is self-contained: no external scripts, styles, images or fonts", () => {
    expect(html).not.toMatch(/\b(src|href)=["']?https?:/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
    expect(html).not.toMatch(/@import/);
  });

  it("shows every color role and has a dark theme", () => {
    for (const role of COLOR_ROLES) expect(html).toContain(`var(--${role})`);
    expect(html).toContain(":root.dark {");
  });
});

describe("exportAll", () => {
  it("writes the five files, deterministically", () => {
    const files = exportAll(fixedSystem("stripe"));
    expect(Object.keys(files)).toEqual([
      "DESIGN.md",
      "theme.css",
      "shadcn.css",
      "tokens.json",
      "style-guide.html",
    ]);
    expect(exportAll(fixedSystem("stripe"))).toEqual(files);
  });
});
