import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { extract } from "./extract.js";
import { BlockedUrlError } from "./ssrf.js";

const USAGE = `Usage: pnpm extract <url> --out fixtures/<name>/

Loads <url> in headless Chromium (1440×900) and writes:
  samples.json        StyleSample[] from the light pass
  samples.dark.json   only when the page has a real dark theme
  screenshot.png      full-page screenshot (gitignored)

A relative --out is resolved against the repo root.`;

/** The repo root (the folder with pnpm-workspace.yaml), so --out works from any package. */
function workspaceRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) return from;
    dir = parent;
  }
  return dir;
}

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { out: { type: "string", short: "o" }, help: { type: "boolean", short: "h" } },
  });
  const [command, url] = positionals;
  if (values.help || command !== "extract" || !url || !values.out) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }

  const root = workspaceRoot(process.cwd());
  const out = isAbsolute(values.out) ? values.out : resolve(root, values.out);
  const shown = (path: string) => relative(root, path) || path;

  console.log(`Extracting ${url} …`);
  const result = await extract(url);

  await mkdir(out, { recursive: true });
  const write = (name: string, data: string | Buffer) => writeFile(join(out, name), data);
  await write("samples.json", `${JSON.stringify(result.light, null, 2)}\n`);
  if (result.dark) {
    await write("samples.dark.json", `${JSON.stringify(result.dark, null, 2)}\n`);
  } else {
    // Don't leave a stale dark set from an earlier run next to fresh light samples.
    await rm(join(out, "samples.dark.json"), { force: true });
  }
  await write("screenshot.png", result.screenshot);

  console.log(`  final URL     ${result.url}`);
  console.log(`  light         ${result.light.length} samples`);
  console.log(
    `  dark          ${result.dark ? `${result.dark.length} samples (canvas flips)` : "none (no dark theme)"}`,
  );
  console.log(`  cookie banner ${result.consent.light ?? "none found"}`);
  if (result.blocked.length > 0) {
    console.log(`  blocked       ${result.blocked.length} request(s) to non-public addresses`);
  }
  console.log(`  wrote         ${shown(out)}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof BlockedUrlError) {
      console.error(`Blocked: ${error.message}`);
    } else {
      console.error(`Extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exitCode = 1;
  },
);
