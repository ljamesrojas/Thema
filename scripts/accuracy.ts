// The week-2 gate: pnpm accuracy [--save] [--fixtures <dir>]
// Scores every fixture on primary color, font families and spacing base, and fails when real
// (recorded) sites score below 90% of checks. See docs/fixtures-checklist.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  ACCURACY_CHECKS,
  ACCURACY_GATE,
  scoreFixture,
  summarizeAccuracy,
  type AccuracyCheck,
  type CheckResult,
  type FixtureExpected,
  type FixtureScore,
  type StyleSample,
} from "@thema/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Row {
  name: string;
  source: FixtureExpected["source"];
  score: FixtureScore;
}

interface Baseline {
  fixtures: Record<string, AccuracyCheck[]>;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

function loadRows(dir: string): Row[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "expected.json")))
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const expected = readJson<FixtureExpected>(join(dir, name, "expected.json"));
      const samplesPath = join(dir, name, "samples.json");
      const samples = existsSync(samplesPath) ? readJson<StyleSample[]>(samplesPath) : [];
      return { name, source: expected.source, score: scoreFixture(samples, expected) };
    });
}

function cell(check: AccuracyCheck, result: CheckResult): string {
  if (result.status === "pass") return "✓";
  if (result.status === "missing") return "· not filled";
  if (check === "primary") return `✗ ${result.detail ?? ""}`.trim();
  if (check === "spacing") return `✗ ${result.got}≠${result.expected}`;
  return "✗";
}

function printTable(rows: Row[]): void {
  // Each column is as wide as its widest cell, so long misses don't push the next column.
  const table = rows.map(({ name, source, score }) => [
    name,
    source === "recorded" ? "real" : source,
    ...ACCURACY_CHECKS.map((check) => cell(check, score[check])),
  ]);
  const header = ["fixture", "source", ...ACCURACY_CHECKS];
  const widths = header.map((h, i) => Math.max(h.length, ...table.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i] ?? 0))).join("  ");
  console.log(line(header));
  console.log("─".repeat(widths.reduce((n, w) => n + w + 2, 0)));
  for (const row of table) console.log(line(row));

  const failures = rows.flatMap(({ name, score }) =>
    ACCURACY_CHECKS.filter((check) => score[check].status === "fail").map((check) => {
      const r = score[check];
      return `  ${name} ${check}: expected ${r.expected}, got ${r.got}${r.detail ? ` (${r.detail})` : ""}`;
    }),
  );
  if (failures.length > 0) console.log(`\nMisses\n${failures.join("\n")}`);
}

/** Prettier-compatible JSON: objects expanded, short arrays inline. */
function formatBaseline(baseline: Baseline): string {
  const entries = Object.entries(baseline.fixtures).sort(([a], [b]) => (a < b ? -1 : 1));
  if (entries.length === 0) return `{\n  "fixtures": {}\n}\n`;
  const lines = entries.map(
    ([name, checks]) =>
      `    ${JSON.stringify(name)}: [${checks.map((c) => JSON.stringify(c)).join(", ")}]`,
  );
  return `{\n  "fixtures": {\n${lines.join(",\n")}\n  }\n}\n`;
}

/** Write the baseline of passing checks; refuse if any previously passing check would be lost. */
function save(dir: string, real: Row[]): number {
  const path = join(dir, "accuracy-baseline.json");
  const old = existsSync(path) ? readJson<Baseline>(path) : { fixtures: {} };
  const current: Baseline = {
    fixtures: Object.fromEntries(
      real.map(({ name, score }) => [
        name,
        ACCURACY_CHECKS.filter((c) => score[c].status === "pass"),
      ]),
    ),
  };

  const regressions = Object.entries(old.fixtures).flatMap(([name, checks]) => {
    const now = current.fixtures[name];
    if (!now) return [`  ${name}: no longer a recorded fixture`];
    return checks
      .filter((c) => !now.includes(c))
      .map((c) => `  ${name} ${c}: passed before, fails now`);
  });
  if (regressions.length > 0) {
    console.error(
      `\nNot saved: the baseline can only go up. Regressions:\n${regressions.join("\n")}`,
    );
    console.error(
      "Fix them, or edit fixtures/accuracy-baseline.json by hand if a site was retired on purpose.",
    );
    return 1;
  }

  writeFileSync(path, formatBaseline(current));
  const passing = Object.values(current.fixtures).reduce((n, checks) => n + checks.length, 0);
  console.log(`\nSaved baseline: ${passing} passing checks across ${real.length} real sites.`);
  return 0;
}

function main(): number {
  const { values } = parseArgs({
    options: { save: { type: "boolean" }, fixtures: { type: "string" } },
  });
  const dir = values.fixtures
    ? isAbsolute(values.fixtures)
      ? values.fixtures
      : resolve(ROOT, values.fixtures)
    : join(ROOT, "fixtures");

  const rows = loadRows(dir);
  printTable(rows);

  const real = rows.filter((r) => r.source === "recorded");
  if (real.length === 0) {
    console.log("\nNo recorded real sites yet. See docs/fixtures-checklist.md.");
    return 1;
  }

  const summary = summarizeAccuracy(real.map((r) => r.score));
  const percent = (summary.ratio * 100).toFixed(1);
  console.log(
    `\nReal sites: ${real.length} · checks passed ${summary.passed}/${summary.total} = ${percent}% (gate ${ACCURACY_GATE * 100}%)`,
  );

  if (values.save) return save(dir, real);

  if (summary.missing > 0) {
    console.log(`${summary.missing} check(s) not filled in yet; complete expected.json first.`);
    return 1;
  }
  if (summary.ratio < ACCURACY_GATE) {
    console.log("Below the gate.");
    return 1;
  }
  console.log("Gate passed.");
  return 0;
}

process.exitCode = main();
