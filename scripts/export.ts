// pnpm export <fixture> --out <dir>
// Runs extractSystem → fix → every exporter on a recorded fixture and writes the five files.
// A relative --out resolves against the repo root. Don't write into the repo: outputs are
// generated from third-party sites' styles.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { extractSystem, fix, type StyleSample } from "@thema/engine";
import { exportAll } from "@thema/exporters";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string" }, fixtures: { type: "string" } },
  });
  const [name] = positionals;
  if (name === undefined || values.out === undefined) {
    console.error("usage: pnpm export <fixture> --out <dir> [--fixtures <dir>]");
    return 1;
  }
  const at = (path: string) => (isAbsolute(path) ? path : resolve(ROOT, path));
  const dir = join(values.fixtures ? at(values.fixtures) : join(ROOT, "fixtures"), name);
  const read = (file: string): StyleSample[] | undefined =>
    existsSync(join(dir, file))
      ? (JSON.parse(readFileSync(join(dir, file), "utf8")) as StyleSample[])
      : undefined;
  const samples = read("samples.json");
  if (!samples) {
    console.error(`No samples.json in ${dir}`);
    return 1;
  }
  const darkSamples = read("samples.dark.json");
  const expected = existsSync(join(dir, "expected.json"))
    ? (JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as { url?: string })
    : {};

  const extracted = extractSystem({
    samples,
    ...(darkSamples ? { darkSamples } : {}),
    source: {
      url: expected.url ?? "",
      borrowed: ["colors", "typography", "spacing", "shape", "layout"],
      screenshot: "screenshot.png",
    },
    name,
    createdAt: new Date().toISOString(),
  });
  const fixed = fix(extracted.system);

  const out = at(values.out);
  mkdirSync(out, { recursive: true });
  for (const [file, content] of Object.entries(exportAll(fixed.system))) {
    writeFileSync(join(out, file), content);
  }

  console.log(`Exported ${name} → ${out}`);
  if (extracted.warnings.length) console.log(`  warnings   ${extracted.warnings.join(", ")}`);
  if (fixed.generated) console.log(`  generated  ${fixed.generated} theme`);
  console.log(
    `  a11y       ${fixed.system.a11y.fixes.length} contrast fix(es), ${fixed.system.a11y.passes ? "passes AA" : "does NOT pass AA"}`,
  );
  for (const u of fixed.unresolved) {
    console.log(
      `  unresolved ${u.theme} ${u.pair.join(" on ")} ${u.ratio} < ${u.min} (${u.reason})`,
    );
  }
  return 0;
}

process.exitCode = main();
