// pnpm --filter @thema/web launch-check: what still stands between Thema and launch, as a list.
// Exits 1 while anything is left. Today: the legal pages' drafts (a "DRAFT" title, an editor's
// note, or a [BRACKETED] item still to fill in).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LEGAL = join(import.meta.dirname, "../../../docs/legal");
/** `[LIKE THIS]` that isn't a Markdown link. */
const PLACEHOLDER = /\[(?![^\]]*\]\()[^\]\n]+\]/g;

const problems: string[] = [];
for (const file of readdirSync(LEGAL)
  .filter((f) => f.endsWith(".md"))
  .sort()) {
  const lines = readFileSync(join(LEGAL, file), "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `docs/legal/${file}:${i + 1}`;
    if (/\bDRAFT\b/.test(line)) problems.push(`${where}  still marked DRAFT`);
    if (line.startsWith(">")) problems.push(`${where}  editor's note (remove before launch)`);
    for (const match of line.matchAll(PLACEHOLDER)) problems.push(`${where}  fill in ${match[0]}`);
  });
}

if (problems.length) {
  console.log(
    `Not ready to launch: ${problems.length} item${problems.length === 1 ? "" : "s"} left.\n`,
  );
  for (const problem of problems) console.log(`  ${problem}`);
  process.exit(1);
}
console.log("Launch check passed: the legal pages are filled in.");
