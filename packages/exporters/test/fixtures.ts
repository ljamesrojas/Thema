import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractSystem, fix, type StyleSample, type ThemaSystem } from "@thema/engine";

export const FIXTURES = join(import.meta.dirname, "../../../fixtures");

/** Every fixture folder with recorded samples. */
export const fixtureNames: string[] = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(FIXTURES, d.name, "samples.json")))
  .map((d) => d.name)
  .sort();

/** extractSystem → fix on a fixture, the way the export pipeline runs it. */
export function fixedSystem(name: string): ThemaSystem {
  const read = (file: string): StyleSample[] | undefined => {
    const path = join(FIXTURES, name, file);
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StyleSample[]) : undefined;
  };
  const darkSamples = read("samples.dark.json");
  const { system } = extractSystem({
    samples: read("samples.json") ?? [],
    ...(darkSamples ? { darkSamples } : {}),
    source: { url: `https://${name}.example/`, borrowed: [], screenshot: `${name}.png` },
    name,
    createdAt: "2026-11-13T00:00:00.000Z",
  });
  return fix(system).system;
}
