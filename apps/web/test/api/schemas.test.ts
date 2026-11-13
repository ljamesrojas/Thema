// @vitest-environment node
import { readdirSync } from "node:fs";
import { fix, type ThemaSystem } from "@thema/engine";
import { describe, expect, it } from "vitest";
import { themaSystemSchema, type ParsedSystem } from "@/server/schemas";
import { fixtureSystem } from "./helpers";

/** True only when A and B are assignable both ways (the schema and the type can't drift). */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesType: Same<ParsedSystem, ThemaSystem> = true;

const FIXTURES = readdirSync(new URL("../../../../fixtures/", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("ThemaSystem schema", () => {
  it("has the same shape as types.ts (checked at compile time)", () => {
    expect(schemaMatchesType).toBe(true);
  });

  it.each(FIXTURES)("accepts %s as extracted and as fixed", (name) => {
    const extracted = fixtureSystem(name);
    for (const system of [extracted, fix(extracted).system]) {
      const parsed = themaSystemSchema.safeParse(JSON.parse(JSON.stringify(system)));
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.data).toEqual(system);
    }
  });

  it("covers all 22 fixtures", () => {
    expect(FIXTURES).toHaveLength(22);
  });
});
