// Prints what the engine makes of a recorded fixture: pnpm palette fixtures/<name>
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeColors,
  analyzeRadius,
  analyzeShadow,
  analyzeSpacing,
  analyzeTypography,
  type ColorRole,
  type StyleSample,
} from "@thema/engine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROLES: ColorRole[] = [
  "canvas",
  "surface",
  "ink",
  "ink-muted",
  "hairline",
  "primary",
  "accent",
];

function report(file: string): void {
  const samples = JSON.parse(readFileSync(file, "utf8")) as StyleSample[];
  const { roles, confidence } = analyzeColors(samples);
  const shown = relative(ROOT, file);
  console.log(`\n${shown.startsWith("..") ? file : shown}  (${samples.length} samples)`);
  console.log("  colors");
  for (const role of ROLES) {
    const value = roles[role] ?? "—";
    const conf = confidence[role] === undefined ? "" : `confidence ${confidence[role]?.toFixed(2)}`;
    console.log(`    ${role.padEnd(10)} ${value.padEnd(30)} ${conf}`);
  }

  const type = analyzeTypography(samples);
  const families = Object.entries(type.families)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  const base = type.scale.find((s) => s.name === "base");
  console.log(`  type       ${families}`);
  console.log(
    `             base ${base ? `${base.size}px` : "—"}, ratio ${type.ratio}, steps ${type.scale.map((s) => `${s.name}:${s.size}`).join(" ")}`,
  );

  const spacing = analyzeSpacing(samples);
  const radius = analyzeRadius(samples);
  const shadow = analyzeShadow(samples);
  console.log(`  spacing    base ${spacing.base}: ${spacing.scale.join(", ") || "—"}`);
  console.log(`  radius     sm ${radius.sm}, md ${radius.md}, lg ${radius.lg}`);
  console.log(`  shadow md  ${shadow.md}`);
}

const arg = process.argv[2];
if (!arg) {
  console.log("Usage: pnpm palette fixtures/<name>");
  process.exit(2);
}
const dir = isAbsolute(arg) ? arg : resolve(ROOT, arg);
const files = ["samples.json", "samples.dark.json"].map((f) => join(dir, f)).filter(existsSync);
if (files.length === 0) {
  console.error(`No samples.json in ${dir}`);
  process.exit(1);
}
files.forEach(report);
