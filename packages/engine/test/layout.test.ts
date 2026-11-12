import { describe, expect, it } from "vitest";
import { LAYOUT_DEFAULTS } from "../src/constants.js";
import { analyzeLayout } from "../src/layout.js";
import type { StyleSample } from "../src/types.js";
import { sample } from "./helpers.js";

type Quad = [number, number, number, number];
const PAGE = 1440;

const page = (): StyleSample =>
  sample({
    tag: "html",
    role: "container",
    area: PAGE * 4000,
    x: 0,
    y: 0,
    width: PAGE,
    height: 4000,
  });

let id = 0;
/** A box of the given width, centered unless `x` is given, with a unique class (a distinct style). */
const box = (width: number, extra: Partial<StyleSample> = {}): StyleSample =>
  sample({
    tag: "div",
    role: "container",
    className: `b${(id += 1)}`,
    x: Math.round((PAGE - width) / 2),
    y: 100,
    width,
    height: 400,
    area: width * 400,
    ...extra,
  });
const pad = (top: number, side: number): Quad => [top, side, top, side];

describe("analyzeLayout: containerMax", () => {
  it("prefers a centered box shown at its own max-width over more common card widths", () => {
    const containers = [0, 1].map(() => box(1280, { maxWidth: 1280, padding: pad(0, 24) }));
    const cards = Array.from({ length: 5 }, () => box(900));
    expect(analyzeLayout([page(), ...containers, ...cards]).layout.containerMax).toBe(1280);
  });

  it("needs a capped width on 2 styles: one capped text block can't win (Linear's 722)", () => {
    const text = box(722, { maxWidth: 722 });
    const main = Array.from({ length: 4 }, () => box(1344));
    expect(analyzeLayout([page(), text, ...main]).layout.containerMax).toBe(1344);
  });

  it("doesn't count full-width or off-center boxes as containers", () => {
    const fullWidth = Array.from({ length: 5 }, () => box(1436)); // 2px each side
    const offCenter = Array.from({ length: 5 }, () => box(1000, { x: 0 }));
    const real = [box(1200), box(1200)];
    expect(analyzeLayout([page(), ...fullWidth, ...offCenter, ...real]).layout.containerMax).toBe(
      1200,
    );
  });

  it("counts identical repeated elements once", () => {
    // 40 copies of one card style are one style; 3 distinct 1200px containers win.
    const card = sample({
      tag: "div",
      className: "card",
      x: 270,
      width: 900,
      height: 300,
      area: 270_000,
    });
    const cards = Array.from({ length: 40 }, () => ({ ...card }));
    const containers = [0, 1, 2].map(() => box(1200));
    expect(analyzeLayout([page(), ...cards, ...containers]).layout.containerMax).toBe(1200);
  });
});

describe("analyzeLayout: gutter", () => {
  it("takes the containers' equal side padding", () => {
    const containers = [0, 1].map(() => box(1280, { maxWidth: 1280, padding: pad(0, 32) }));
    expect(analyzeLayout([page(), ...containers]).layout.gutter).toBe(32);
  });

  it("ignores side padding under 8px (Vercel's 1px border trick) and unequal sides", () => {
    const samples = [
      page(),
      box(1200, { padding: pad(0, 1) }),
      box(1200, { padding: pad(0, 1) }),
      box(1200, { padding: [0, 40, 0, 16] }),
      box(1200, { padding: pad(0, 16) }),
    ];
    expect(analyzeLayout(samples).layout.gutter).toBe(16);
  });

  it("breaks ties toward the smaller gutter", () => {
    const samples = [
      page(),
      box(1200, { padding: pad(0, 24) }),
      box(1100, { padding: pad(0, 96) }),
    ];
    expect(analyzeLayout(samples).layout.gutter).toBe(24);
  });
});

describe("analyzeLayout: sectionY", () => {
  it("takes the most common top padding of 32+ on wide boxes", () => {
    const sections = [96, 96, 64].map((top) => box(PAGE, { x: 0, padding: pad(top, 0) }));
    const narrow = [0, 1, 2].map(() => box(400, { padding: pad(48, 0) })); // cards, not sections
    const small = [0, 1, 2].map(() => box(PAGE, { x: 0, padding: pad(16, 0) }));
    expect(analyzeLayout([page(), ...sections, ...narrow, ...small]).layout.sectionY).toBe(96);
  });
});

describe("analyzeLayout: no evidence", () => {
  it("falls back to max-width, then defaults, without box data (older recordings)", () => {
    const old = [
      sample({ tag: "html", role: "container", area: 1_000_000 }),
      sample({ tag: "main", maxWidth: 1100 }),
      sample({ tag: "main", maxWidth: 1100 }),
    ];
    const { layout, derived } = analyzeLayout(old);
    expect(layout).toEqual({ containerMax: 1100, gutter: 24, sectionY: 64 });
    expect(derived).toEqual(["gutter", "sectionY"]);
  });

  it("returns the defaults, all derived, when nothing is measurable", () => {
    expect(analyzeLayout([])).toEqual({
      layout: { ...LAYOUT_DEFAULTS },
      derived: ["containerMax", "gutter", "sectionY"],
    });
  });
});
