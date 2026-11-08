import { describe, expect, it } from "vitest";
import { clusterColors } from "../src/cluster.js";
import { formatOklch, parseCssColor, type Oklch } from "../src/color-math.js";
import { distance } from "./helpers.js";

function entry(css: string, weight: number): { color: Oklch; weight: number; css: string } {
  const color = parseCssColor(css);
  if (!color) throw new Error(`Unparseable: ${css}`);
  return { color, weight, css };
}

describe("clusterColors", () => {
  it("merges near-identical colors", () => {
    // #2563eb and #2564ea differ by one channel step each.
    const clusters = clusterColors([entry("#2563eb", 10), entry("#2564ea", 5)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.members).toHaveLength(2);
  });

  it("keeps colors more than ΔE 4 apart separate", () => {
    expect(distance("#2563eb", "#1d4ed8")).toBeGreaterThan(4);
    const clusters = clusterColors([entry("#2563eb", 10), entry("#1d4ed8", 5)]);
    expect(clusters).toHaveLength(2);
  });

  it("uses the heaviest member as the representative", () => {
    const clusters = clusterColors([entry("#2564ea", 1), entry("#2563eb", 10)]);
    expect(clusters[0]?.key).toBe(formatOklch(entry("#2563eb", 0).color));
  });

  it("sums weight across exact duplicates before choosing the representative", () => {
    const clusters = clusterColors([entry("#2564ea", 6), entry("#2563eb", 4), entry("#2563eb", 4)]);
    expect(clusters[0]?.key).toBe(formatOklch(entry("#2563eb", 0).color));
  });

  it("orders clusters heaviest first", () => {
    const clusters = clusterColors([entry("#ff0000", 1), entry("#00aa00", 9)]);
    expect(clusters.map((c) => c.key)).toEqual([
      formatOklch(entry("#00aa00", 0).color),
      formatOklch(entry("#ff0000", 0).color),
    ]);
  });

  it("gives the same result regardless of input order", () => {
    const input = [
      entry("#ffffff", 50),
      entry("#fefefe", 5),
      entry("#0f172a", 20),
      entry("#2563eb", 8),
      entry("#2766ee", 3),
      entry("#7c3aed", 8),
    ];
    const summary = (list: typeof input) =>
      clusterColors(list).map((c) => [c.key, c.members.map((m) => m.css).sort()]);
    expect(summary([...input].reverse())).toEqual(summary(input));
    expect(
      summary(
        [input[3], input[0], input[5], input[1], input[4], input[2]].filter((e) => e !== undefined),
      ),
    ).toEqual(summary(input));
  });

  it("returns no clusters for no input", () => {
    expect(clusterColors([])).toEqual([]);
  });
});
