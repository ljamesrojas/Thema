import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACCURACY_CHECKS,
  scoreFixture,
  type AccuracyCheck,
  type FixtureExpected,
} from "../src/accuracy.js";
import type { StyleSample } from "../src/types.js";

// SPEC: "add each newly failing real site to fixtures/ so accuracy only goes up".
// fixtures/accuracy-baseline.json (written by `pnpm accuracy --save`) lists, per recorded site,
// the checks that passed. Any of them failing now is a regression and fails `pnpm test`.

const FIXTURES = fileURLToPath(new URL("../../../fixtures/", import.meta.url));
const BASELINE = join(FIXTURES, "accuracy-baseline.json");

interface Baseline {
  fixtures: Record<string, AccuracyCheck[]>;
}

const readJson = <T>(...parts: string[]): T =>
  JSON.parse(readFileSync(join(...parts), "utf8")) as T;

const baseline: Baseline = existsSync(BASELINE) ? readJson<Baseline>(BASELINE) : { fixtures: {} };
const entries = Object.entries(baseline.fixtures).sort(([a], [b]) => (a < b ? -1 : 1));

describe("accuracy ratchet", () => {
  it("baseline only names known checks", () => {
    for (const [, checks] of entries) {
      for (const check of checks) expect(ACCURACY_CHECKS).toContain(check);
    }
  });

  describe.each(entries)("%s", (name, checks) => {
    it("still exists as a recorded fixture", () => {
      // Removing a site from the test set must be a deliberate baseline edit.
      expect(existsSync(join(FIXTURES, name, "expected.json")), `${name} was removed`).toBe(true);
    });

    it.each(checks)("%s still passes", (check) => {
      const dir = join(FIXTURES, name);
      if (!existsSync(join(dir, "expected.json"))) return; // reported by the test above
      const samples = readJson<StyleSample[]>(dir, "samples.json");
      const expected = readJson<FixtureExpected>(dir, "expected.json");
      const result = scoreFixture(samples, expected)[check];
      expect(
        result.status,
        `${name} ${check}: expected ${result.expected}, got ${result.got} ${result.detail ?? ""}`,
      ).toBe("pass");
    });
  });
});
