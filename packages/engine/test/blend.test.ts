import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blend, type BlendInput, type BlendReference } from "../src/blend.js";
import { deltaEOK, parseCssColor } from "../src/color-math.js";
import { HARMONY_MIN_DELTA_E, THEMA_VERSION } from "../src/constants.js";
import { extractSystem } from "../src/system.js";
import type {
  BlendSettings,
  BorrowTag,
  ColorRole,
  StyleSample,
  ThemaSystem,
} from "../src/types.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");
const NEUTRAL: BlendSettings = { density: 0, roundness: 0, contrast: 0, warmth: 0 };
const ALL_TAGS: BorrowTag[] = ["colors", "typography", "spacing", "shape", "layout"];

/** extractSystem on a recorded or synthetic fixture. */
function system(name: string): ThemaSystem {
  const samples = JSON.parse(
    readFileSync(join(FIXTURES, name, "samples.json"), "utf8"),
  ) as StyleSample[];
  return extractSystem({
    samples,
    source: { url: `https://${name}.example/`, borrowed: [], screenshot: `${name}.png` },
    name,
    createdAt: "2026-11-13T00:00:00.000Z",
  }).system;
}

const light = system("light-saas");
const dark = system("dark-dev-tool");
const editorial = system("warm-editorial");

const input = (references: BlendReference[], overrides: Partial<BlendInput> = {}): BlendInput => ({
  references,
  settings: NEUTRAL,
  name: "blend",
  createdAt: "2026-11-13T12:00:00.000Z",
  ...overrides,
});
const ref = (s: ThemaSystem, borrowed: BorrowTag[] = []): BlendReference => ({
  system: s,
  borrowed,
});
const L = (css: string): number => parseCssColor(css)?.l ?? Number.NaN;
const color = (css: string) => {
  const c = parseCssColor(css);
  if (!c) throw new Error(`unparseable ${css}`);
  return c;
};

describe("blend: ownership", () => {
  it("gives every tag to the first reference by default", () => {
    const { system: out } = blend(input([ref(light), ref(dark)]));
    expect(out.color).toEqual(light.color);
    expect(out.typography).toEqual(light.typography);
    expect(out.spacing).toEqual(light.spacing);
    expect(out.radius).toEqual(light.radius);
    expect(out.layout).toEqual(light.layout);
  });

  it("takes each claimed tag from the reference that claims it", () => {
    const { system: out } = blend(
      input([
        ref(light, ["typography"]),
        ref(dark, ["colors", "shape"]),
        ref(editorial, ["spacing"]),
      ]),
    );
    expect(out.color).toEqual(dark.color);
    expect(out.radius).toEqual(dark.radius);
    expect(out.shadow).toEqual(dark.shadow);
    expect(out.typography).toEqual(light.typography);
    expect(out.spacing).toEqual(editorial.spacing);
    expect(out.layout).toEqual(light.layout); // unclaimed → first reference
  });

  it("lets the earlier reference win when two claim the same tag", () => {
    const { system: out } = blend(
      input([ref(light), ref(dark, ["colors"]), ref(editorial, ["colors"])]),
    );
    expect(out.color).toEqual(dark.color);
  });

  it("fills meta with every source and the tags it actually lent", () => {
    const { system: out } = blend(
      input([ref(light, ["typography"]), ref(dark, ["colors", "typography"])]),
    );
    expect(out.meta).toEqual({
      name: "blend",
      version: THEMA_VERSION,
      createdAt: "2026-11-13T12:00:00.000Z",
      sources: [
        {
          url: "https://light-saas.example/",
          screenshot: "light-saas.png",
          borrowed: ["typography", "spacing", "shape", "layout"],
        },
        {
          url: "https://dark-dev-tool.example/",
          screenshot: "dark-dev-tool.png",
          borrowed: ["colors"],
        },
      ],
    });
  });

  it("resets a11y for the fixer and takes motion and voice from the first reference", () => {
    const { system: out } = blend(
      input([ref({ ...dark, a11y: { fixes: [], passes: true } }), ref(light)]),
    );
    expect(out.a11y).toEqual({ fixes: [], passes: false });
    expect(out.motion).toEqual(dark.motion);
    expect(out.voice).toEqual(dark.voice);
  });

  it("needs 1 to 5 references", () => {
    expect(() => blend(input([]))).toThrow(/1 to 5/);
    expect(() => blend(input(Array.from({ length: 6 }, () => ref(light))))).toThrow(/1 to 5/);
  });
});

describe("blend: density", () => {
  const spaced = { ...light, spacing: { base: 4 as const, scale: [4, 8, 12, 16, 24, 32, 48] } };
  const run = (density: number) =>
    blend(input([ref(spaced)], { settings: { ...NEUTRAL, density } })).system.spacing;

  it("scales spacing 0.8× at -1 and 1.25× at +1, snapped to the base", () => {
    expect(run(0)).toEqual(spaced.spacing);
    expect(run(1)).toEqual({ base: 4, scale: [4, 12, 16, 20, 32, 40, 60] });
    expect(run(-1)).toEqual({ base: 4, scale: [4, 8, 12, 20, 24, 40] });
  });

  it("keeps every value on the grid and leaves layout alone", () => {
    const out = blend(input([ref(spaced)], { settings: { ...NEUTRAL, density: 0.37 } })).system;
    expect(out.spacing.scale.every((v) => v % 4 === 0)).toBe(true);
    expect(out.layout).toEqual(spaced.layout);
  });
});

describe("blend: roundness", () => {
  const shaped = { ...light, radius: { sm: 4, md: 8, lg: 16, full: 9999 as const } };
  const run = (roundness: number) =>
    blend(input([ref(shaped)], { settings: { ...NEUTRAL, roundness } })).system.radius;

  it("goes from square at -1 to pill at +1, unchanged at 0", () => {
    expect(run(-1)).toEqual({ sm: 0, md: 0, lg: 0, full: 9999 });
    expect(run(0)).toEqual(shaped.radius);
    expect(run(1)).toEqual({ sm: 9999, md: 9999, lg: 9999, full: 9999 });
  });

  it("scales down linearly and up along a log curve (md 8 → ~48 at +0.25)", () => {
    expect(run(-0.5)).toEqual({ sm: 2, md: 4, lg: 8, full: 9999 });
    const up = run(0.25);
    expect(up.md).toBeGreaterThan(40);
    expect(up.md).toBeLessThan(56);
    expect(up.sm).toBeLessThan(up.md);
    expect(up.md).toBeLessThan(up.lg);
  });
});

describe("blend: contrast", () => {
  const run = (s: ThemaSystem, contrast: number) =>
    blend(input([ref(s)], { settings: { ...NEUTRAL, contrast } })).system.color;

  it("moves ink and canvas apart (+) or together (-) by up to 0.1 lightness, light and dark", () => {
    for (const theme of ["light", "dark"] as const) {
      const base = light.color[theme];
      const more = run(light, 1)[theme];
      const less = run(light, -1)[theme];
      const gap = (c: Record<ColorRole, string>) => Math.abs(L(c.canvas) - L(c.ink));
      expect(gap(more)).toBeGreaterThan(gap(base));
      expect(gap(less)).toBeCloseTo(gap(base) - 0.2, 2);
    }
    // Dark canvas: ink gets lighter, canvas darker.
    const d = run(dark, 1).light;
    expect(L(d.ink)).toBeGreaterThan(L(dark.color.light.ink));
    expect(L(d.canvas)).toBeLessThanOrEqual(L(dark.color.light.canvas));
  });

  it("leaves other roles alone and changes nothing at 0", () => {
    const out = run(light, 1).light;
    expect(out.primary).toBe(light.color.light.primary);
    expect(run(light, 0)).toEqual(light.color);
  });
});

describe("blend: warmth", () => {
  const gray = {
    ...light,
    color: {
      light: {
        ...light.color.light,
        canvas: "oklch(1 0 0)",
        ink: "oklch(0.2 0 0)",
        surface: "oklch(0.96 0.01 250)",
      },
      dark: light.color.dark,
    },
  };
  const run = (warmth: number) =>
    blend(input([ref(gray)], { settings: { ...NEUTRAL, warmth } })).system.color.light;

  it("tints pure grays warm (+) or cool (-), up to chroma 0.01", () => {
    expect(color(run(1).ink)).toMatchObject({ c: 0.01, h: 70 });
    expect(color(run(-1).ink)).toMatchObject({ c: 0.01, h: 250 });
    expect(color(run(-0.5).ink).c).toBeCloseTo(0.005, 3);
  });

  it("rotates tinted neutrals toward warm or cool by up to 10°", () => {
    expect(color(run(1).surface).h).toBeCloseTo(240, 0); // 250 → 10° toward 70 (via 160)
    expect(color(run(-1).surface).h).toBeCloseTo(250, 0); // already cool: stays
  });

  it("never touches saturated roles, and changes nothing at 0", () => {
    expect(run(1).primary).toBe(gray.color.light.primary);
    expect(run(0)).toEqual(gray.color.light);
  });
});

describe("blend: locks", () => {
  const previous = blend(input([ref(dark)])).system;
  const all = { density: 1, roundness: 1, contrast: 1, warmth: 1 };

  it("keeps locked tokens from the previous system through ownership and every slider", () => {
    const locks = [
      "color.light.primary",
      "color.light.canvas",
      "radius.md",
      "spacing.scale",
      "typography.families.sans",
    ];
    const { system: out, ignoredLocks } = blend(
      input([ref(light), ref(editorial, ["typography"])], { settings: all, locks, previous }),
    );
    expect(out.color.light.primary).toBe(previous.color.light.primary);
    expect(out.color.light.canvas).toBe(previous.color.light.canvas);
    expect(out.radius.md).toBe(previous.radius.md);
    expect(out.spacing.scale).toEqual(previous.spacing.scale);
    expect(out.typography.families.sans).toBe(previous.typography.families.sans);
    expect(out.locks).toEqual(locks);
    expect(ignoredLocks).toEqual([]);
    // Unlocked tokens still follow the sliders.
    expect(out.radius.sm).toBe(9999);
  });

  it("ignores unknown paths and locks without a previous system", () => {
    const { system: out, ignoredLocks } = blend(
      input([ref(light)], { locks: ["color.light.nope", "radius.md", "radius"], previous }),
    );
    expect(ignoredLocks).toEqual(["color.light.nope", "radius"]);
    expect(out.locks).toEqual(["radius.md"]);
    expect(blend(input([ref(light)], { locks: ["radius.md"] })).ignoredLocks).toEqual([
      "radius.md",
    ]);
  });
});

describe("blend: harmonize", () => {
  // A very dark blue primary (ΔE ≈ 3 from dark-dev-tool's oklch(0.145 0 0) canvas) locked from another
  // palette, then colors switched to dark-dev-tool.
  const lockedFrom = {
    ...light,
    color: { ...light.color, light: { ...light.color.light, primary: "oklch(0.17 0.02 265)" } },
  };
  const previous = blend(input([ref(lockedFrom)])).system;

  it("reports a locked color that clashes with the new canvas, and leaves it", () => {
    const {
      system: out,
      adjustments,
      lockedClashes,
    } = blend(input([ref(dark)], { locks: ["color.light.primary"], previous }));
    expect(out.color.light.primary).toBe("oklch(0.17 0.02 265)");
    expect(lockedClashes).toContain("color.light.primary");
    expect(adjustments.map((a) => a.path)).not.toContain("color.light.primary");
  });

  it("moves an unlocked clashing color away from the canvas, keeping its hue, just past ΔE 10", () => {
    const clashing = {
      ...dark,
      color: { ...dark.color, light: { ...dark.color.light, accent: "oklch(0.18 0.03 145)" } },
    };
    const { system: out, adjustments } = blend(input([ref(clashing)]));
    const canvas = color(out.color.light.canvas);
    const accent = color(out.color.light.accent);
    const d = deltaEOK(accent, canvas);
    expect(d).toBeGreaterThanOrEqual(HARMONY_MIN_DELTA_E);
    expect(d).toBeLessThan(HARMONY_MIN_DELTA_E + 2);
    expect(accent.h).toBeCloseTo(145, 0);
    expect(accent.l).toBeGreaterThan(0.18);
    expect(adjustments).toContainEqual({
      path: "color.light.accent",
      before: "oklch(0.18 0.03 145)",
      after: out.color.light.accent,
    });
  });

  it("changes nothing when no color clashes", () => {
    expect(blend(input([ref(light)])).adjustments).toEqual([]);
  });
});

describe("blend: real fixtures", () => {
  const stripe = system("stripe");
  const linear = system("linear");

  it("blends Stripe's colors with Linear's typography into a complete, valid system", () => {
    const { system: out } = blend(
      input([ref(stripe, ["colors", "spacing", "shape", "layout"]), ref(linear, ["typography"])]),
    );
    expect(out.color.light).toEqual(stripe.color.light);
    expect(out.typography).toEqual(linear.typography);
    for (const theme of ["light", "dark"] as const) {
      for (const css of Object.values(out.color[theme])) expect(parseCssColor(css)).not.toBeNull();
    }
  });

  it("is deterministic", () => {
    const args = input([ref(stripe), ref(linear, ALL_TAGS)], {
      settings: { density: 0.3, roundness: -0.4, contrast: 0.5, warmth: -0.2 },
    });
    expect(blend(args)).toEqual(blend(args));
  });
});
