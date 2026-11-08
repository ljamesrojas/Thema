import type { StyleSample } from "../src/types.js";
import { parseCssColor, deltaEOK } from "../src/color-math.js";

const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** A StyleSample with neutral defaults: no visible colors unless the test sets them. */
export function sample(overrides: Partial<StyleSample> = {}): StyleSample {
  return {
    tag: "div",
    area: 1000,
    color: TRANSPARENT,
    backgroundColor: TRANSPARENT,
    fontFamily: "Inter, sans-serif",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
    letterSpacing: 0,
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    borderRadius: 0,
    ...overrides,
  };
}

/** ΔE OK between two CSS color strings; throws if either doesn't parse. */
export function distance(a: string, b: string): number {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca || !cb) throw new Error(`Unparseable color: ${ca ? b : a}`);
  return deltaEOK(ca, cb);
}
