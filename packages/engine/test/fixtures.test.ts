import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeColors } from "../src/colors.js";
import type { ColorRole, StyleSample } from "../src/types.js";
import { distance } from "./helpers.js";

/** Snapshot tolerance: output may drift from the human-verified color by less than this ΔE OK. */
const TOLERANCE = 2;

const FIXTURES = fileURLToPath(new URL("../../../fixtures/", import.meta.url));

interface Expected {
  description?: string;
  roles: Partial<Record<ColorRole, string>>;
}

const readJson = <T>(...parts: string[]): T =>
  JSON.parse(readFileSync(join(FIXTURES, ...parts), "utf8")) as T;

const names = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe("fixtures", () => {
  it("has at least one fixture", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  describe.each(names)("%s", (name) => {
    const samples = readJson<StyleSample[]>(name, "samples.json");
    const expected = readJson<Expected>(name, "expected.json");
    const { roles, confidence } = analyzeColors(samples);

    it("finds exactly the expected roles", () => {
      expect(Object.keys(roles).sort()).toEqual(Object.keys(expected.roles).sort());
    });

    it.each(Object.entries(expected.roles))(`%s is within ΔE ${TOLERANCE}`, (role, want) => {
      const got = roles[role as ColorRole];
      expect(got, `${role} missing`).toBeDefined();
      const d = distance(got ?? "", want);
      expect(d, `${role}: got ${got}, want ${want} (ΔE ${d.toFixed(2)})`).toBeLessThan(TOLERANCE);
    });

    it("reports a confidence within 0–1 for every role", () => {
      for (const role of Object.keys(roles) as ColorRole[]) {
        expect(confidence[role]).toBeGreaterThanOrEqual(0);
        expect(confidence[role]).toBeLessThanOrEqual(1);
      }
    });
  });
});
