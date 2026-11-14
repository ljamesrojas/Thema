import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractSystem, fix, type StyleSample, type ThemaSystem } from "@thema/engine";
import { describe, expect, it } from "vitest";
import { themaSystemSchema, type ParsedSystem } from "../src/index.js";

/** True only when A and B are assignable both ways (the schema and the type can't drift). */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesType: Same<ParsedSystem, ThemaSystem> = true;

const FIXTURES = join(import.meta.dirname, "../../../fixtures");
const names = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function systemOf(name: string): ThemaSystem {
  const read = (file: string) =>
    existsSync(join(FIXTURES, name, file))
      ? (JSON.parse(readFileSync(join(FIXTURES, name, file), "utf8")) as StyleSample[])
      : undefined;
  const darkSamples = read("samples.dark.json");
  return extractSystem({
    samples: read("samples.json") ?? [],
    ...(darkSamples ? { darkSamples } : {}),
    source: { url: `https://${name}.test/`, borrowed: [], screenshot: "" },
    name,
    createdAt: "2026-11-14T00:00:00.000Z",
  }).system;
}

describe("@thema/schema: ThemaSystem", () => {
  it("has the same shape as types.ts (checked at compile time)", () => {
    expect(schemaMatchesType).toBe(true);
  });

  it.each(names)("accepts %s as extracted and as fixed, unchanged", (name) => {
    const extracted = systemOf(name);
    for (const system of [extracted, fix(extracted).system]) {
      const parsed = themaSystemSchema.safeParse(JSON.parse(JSON.stringify(system)));
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.data).toEqual(system);
    }
  });

  it("rejects colors that aren't OKLCH and text that could break an export", () => {
    const system = fix(systemOf("light-saas")).system;
    const notOklch = structuredClone(system);
    notOklch.color.light.primary = "red";
    expect(themaSystemSchema.safeParse(notOklch).success).toBe(false);
    const markup = structuredClone(system);
    markup.typography.families.sans = "Inter</style><script>";
    expect(themaSystemSchema.safeParse(markup).success).toBe(false);
  });
});
