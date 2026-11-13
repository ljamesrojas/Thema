import { describe, expect, it } from "vitest";
import { cubicBezier, toDtcg } from "../src/dtcg.js";
import { fixedSystem, fixtureNames } from "./fixtures.js";

type Node = { [key: string]: unknown };

/** Every token (an object with $value) with its dot path. */
function tokens(node: Node, path: string[] = []): [string, Node][] {
  if ("$value" in node) return [[path.join("."), node]];
  return Object.entries(node)
    .filter(([key, value]) => !key.startsWith("$") && typeof value === "object" && value !== null)
    .flatMap(([key, value]) => tokens(value as Node, [...path, key]));
}

describe("tokens.json (DTCG)", () => {
  it.each(fixtureNames)(
    "%s: every token has $type and $value, and every alias resolves",
    (name) => {
      const doc = JSON.parse(toDtcg(fixedSystem(name))) as Node;
      const all = tokens(doc);
      expect(all.length).toBeGreaterThan(40);
      const paths = new Set(all.map(([path]) => path));
      for (const [path, token] of all) {
        expect(typeof token.$type, path).toBe("string");
        const aliases = JSON.stringify(token.$value).match(/\{[\w.-]+\}/g) ?? [];
        for (const alias of aliases) {
          expect(paths, `${path} → ${alias}`).toContain(alias.slice(1, -1));
        }
      }
    },
  );

  it("writes colors as OKLCH components with a hex fallback, hue none when gray", () => {
    const doc = JSON.parse(toDtcg(fixedSystem("light-saas"))) as {
      color: { light: Record<string, { $value: { hex: string } }> };
    };
    expect(doc.color.light.canvas?.$value).toMatchObject({
      colorSpace: "oklch",
      components: [1, 0, "none"],
      alpha: 1,
      hex: "#ffffff",
    });
    expect(doc.color.light.primary?.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps provenance in $extensions (JSON has no comments)", () => {
    const doc = JSON.parse(toDtcg(fixedSystem("light-saas"))) as Node;
    expect(doc.$extensions).toMatchObject({
      "dev.thema": { name: "light-saas", sources: ["https://light-saas.example/"] },
    });
  });

  it("parses easings into cubic Béziers", () => {
    expect(cubicBezier("cubic-bezier(0.2, 0, 0, 1)")).toEqual([0.2, 0, 0, 1]);
    expect(cubicBezier("ease-in-out")).toEqual([0.42, 0, 0.58, 1]);
    expect(cubicBezier("steps(4)")).toEqual([0.25, 0.1, 0.25, 1]);
  });

  it("matches the snapshot", () => {
    expect(toDtcg(fixedSystem("light-saas"))).toMatchSnapshot();
  });
});
