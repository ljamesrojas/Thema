// thema: extract a site, blend systems, export files. Reads and writes ThemaSystem JSON.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { BorrowTag, ThemaSystem } from "@thema/engine";
import {
  BlockedUrlError,
  blendAndFix,
  BORROW_TAGS,
  exportFiles,
  extractorFromEnv,
  apiExtractor,
  FORMATS,
  readSystemFile,
  summarize,
  ThemaError,
  WARNING_TEXT,
  writeSystemFile,
  type Extractor,
  type Format,
} from "./core.js";

export const USAGE = `thema: blend reference sites into one accessible design system.

Usage:
  thema extract <url> [--out system.json] [--screenshot shot.png] [--api <url>]
  thema blend <file[=tags]>... --out blended.json [--density n] [--roundness n]
              [--contrast n] [--warmth n] [--lock <path>]... [--previous system.json] [--name <name>]
  thema export --in system.json --format <format> [--out <dir>]
  thema setup

extract   Load a site in a local browser (or a Thema API with --api / THEMA_API_URL) and write
          its system as JSON (stdout without --out).
blend     Blend up to 5 systems, then fix contrast to WCAG AA. Tags say what each file lends:
          ${BORROW_TAGS.join(", ")} (comma-separated); tags nobody claims come from the first.
          Sliders go from -1 to 1. --lock keeps a token (e.g. color.light.primary) from --previous.
export    Write ${Object.keys(FORMATS).join(", ")}, or all.
setup     Install the Chromium that extract uses (once; matches Thema's Playwright version).

Exit codes: 0 done, 1 failed, 2 bad usage or a blocked URL.`;

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  env: Record<string, string | undefined>;
  now: () => Date;
}

export interface Deps {
  /** Replaces the extractor (tests). */
  extractor?: Extractor;
  /** Replaces the browser installer (tests). Returns its exit code. */
  installBrowser?: (io: Io) => Promise<number>;
}

/**
 * `thema setup`: run the installer of the Playwright that came with Thema, so the browser matches
 * the version extract uses (a bare `npx playwright install` could fetch another one). Playwright
 * doesn't export its CLI, but its package.json is exported and names it.
 */
async function installBrowser(io: Io): Promise<number> {
  const require = createRequire(import.meta.url);
  let cli: string;
  try {
    const manifest = require.resolve("playwright/package.json");
    const { bin } = require(manifest) as { bin: Record<string, string> };
    cli = join(dirname(manifest), bin.playwright ?? "cli.js");
  } catch {
    io.stderr(
      "Playwright isn't installed next to Thema. From a clone of the repo, run: pnpm --filter @thema/worker exec playwright install chromium\n",
    );
    return 1;
  }
  io.stdout("Installing Chromium for Thema (about 150 MB, once)…\n");
  return new Promise((resolveExit) => {
    const child = spawn(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
    child.on("close", (code) => resolveExit(code ?? 1));
    child.on("error", () => resolveExit(1));
  });
}

class UsageError extends Error {}

const num = (name: string, value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new UsageError(`--${name} must be a number, got "${value}".`);
  return parsed;
};

/** "north.json=colors,shape" → the file and the tags it lends. */
export function parseRef(arg: string): { path: string; borrowed: BorrowTag[] } {
  const at = arg.lastIndexOf("=");
  if (at === -1) return { path: arg, borrowed: [] };
  const path = arg.slice(0, at);
  const borrowed = arg
    .slice(at + 1)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  for (const tag of borrowed) {
    if (!(BORROW_TAGS as readonly string[]).includes(tag)) {
      throw new UsageError(`Unknown tag "${tag}" in ${arg}. Tags: ${BORROW_TAGS.join(", ")}.`);
    }
  }
  return { path, borrowed: borrowed as BorrowTag[] };
}

function report(io: Io, system: ThemaSystem, warnings: Parameters<typeof summarize>[1] = []) {
  const s = summarize(system, warnings);
  io.stderr(
    [
      `  ${s.name}`,
      `  colors   canvas ${s.colors.canvas} · ink ${s.colors.ink} · primary ${s.colors.primary} · accent ${s.colors.accent}`,
      `  fonts    ${Object.entries(s.fonts)
        .map(([slot, name]) => `${slot} ${name}`)
        .join(" · ")}`,
      `  spacing  base ${s.spacingBase} · radius ${s.radius}px`,
      `  WCAG AA  light ${s.contrast.light} · dark ${s.contrast.dark} pairs`,
      ...s.warnings.map((w) => `  warning  ${WARNING_TEXT[w]}`),
      "",
    ].join("\n"),
  );
}

async function extractCommand(args: string[], io: Io, deps: Deps): Promise<number> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: "string" }, screenshot: { type: "string" }, api: { type: "string" } },
  });
  const [url, extra] = positionals;
  if (!url || extra) throw new UsageError("extract takes one URL.");
  const extractor =
    deps.extractor ?? (values.api ? apiExtractor(values.api) : extractorFromEnv(io.env));
  io.stderr(
    `Extracting ${url} (${extractor.kind === "api" ? "through the API" : "local browser"})…\n`,
  );
  const output = await extractor.extract(url);
  report(io, output.system, output.warnings);
  if (values.out) {
    await writeSystemFile(resolve(io.cwd, values.out), output.system);
    io.stderr(`Wrote ${values.out}\n`);
  } else {
    io.stdout(`${JSON.stringify(output.system, null, 2)}\n`);
  }
  if (values.screenshot && output.screenshot.length > 0) {
    await writeFile(resolve(io.cwd, values.screenshot), output.screenshot);
    io.stderr(`Wrote ${values.screenshot}\n`);
  }
  return 0;
}

async function blendCommand(args: string[], io: Io): Promise<number> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      density: { type: "string" },
      roundness: { type: "string" },
      contrast: { type: "string" },
      warmth: { type: "string" },
      lock: { type: "string", multiple: true },
      previous: { type: "string" },
      name: { type: "string" },
    },
  });
  if (positionals.length === 0) throw new UsageError("blend needs at least one system file.");
  if (!values.out) throw new UsageError("blend needs --out <file>.");
  const refs = positionals.map(parseRef);
  const references = await Promise.all(
    refs.map(async ({ path, borrowed }) => ({
      system: await readSystemFile(resolve(io.cwd, path)),
      borrowed,
    })),
  );
  const previous = values.previous
    ? await readSystemFile(resolve(io.cwd, values.previous))
    : undefined;
  const settings = {
    density: num("density", values.density),
    roundness: num("roundness", values.roundness),
    contrast: num("contrast", values.contrast),
    warmth: num("warmth", values.warmth),
  };
  const outcome = blendAndFix({
    references,
    settings: Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)),
    locks: values.lock ?? [],
    ...(previous ? { previous } : {}),
    ...(values.name ? { name: values.name } : {}),
    now: io.now,
  });
  await writeSystemFile(resolve(io.cwd, values.out), outcome.system);
  report(io, outcome.system);
  const fixes = outcome.system.a11y.fixes;
  if (fixes.length > 0) {
    io.stderr(`  fixed    ${fixes.length} pair${fixes.length === 1 ? "" : "s"} for contrast\n`);
  }
  if (outcome.generated) io.stderr(`  ${outcome.generated} theme generated\n`);
  for (const pair of outcome.unresolved) {
    io.stderr(
      `  unresolved  ${pair.pair[0]} on ${pair.pair[1]} (${pair.theme}) ${pair.ratio.toFixed(2)} < ${pair.min}: ${pair.reason === "locked" ? "locked, can't fix" : "no lightness passes"}\n`,
    );
  }
  for (const path of outcome.ignoredLocks) {
    io.stderr(`  ignored lock  ${path} (no such token${previous ? "" : ", or no --previous"})\n`);
  }
  io.stderr(`Wrote ${values.out}\n`);
  return 0;
}

async function exportCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { in: { type: "string" }, format: { type: "string" }, out: { type: "string" } },
  });
  if (positionals.length > 0) throw new UsageError("export takes --in, --format and --out.");
  if (!values.in) throw new UsageError("export needs --in <system.json>.");
  const format = values.format ?? "all";
  if (format !== "all" && !Object.hasOwn(FORMATS, format)) {
    throw new UsageError(
      `Unknown format "${format}". Formats: ${[...Object.keys(FORMATS), "all"].join(", ")}.`,
    );
  }
  const system = await readSystemFile(resolve(io.cwd, values.in));
  const dir = resolve(io.cwd, values.out ?? ".");
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(exportFiles(system, format as Format | "all"))) {
    await writeFile(join(dir, name), content);
    io.stderr(`Wrote ${join(values.out ?? ".", name)}\n`);
  }
  return 0;
}

/** Run the CLI. Returns the exit code; never calls process.exit, so tests can drive it. */
export async function main(argv: string[], io: Io, deps: Deps = {}): Promise<number> {
  const [command, ...args] = argv;
  try {
    switch (command) {
      case "extract":
        return await extractCommand(args, io, deps);
      case "blend":
        return await blendCommand(args, io);
      case "export":
        return await exportCommand(args, io);
      case "setup":
        return await (deps.installBrowser ?? installBrowser)(io);
      case undefined:
      case "help":
      case "--help":
      case "-h":
        io.stdout(`${USAGE}\n`);
        return command === undefined ? 2 : 0;
      default:
        throw new UsageError(`Unknown command "${command}".`);
    }
  } catch (error) {
    if (error instanceof UsageError || (error instanceof TypeError && "code" in error)) {
      io.stderr(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    if (
      error instanceof BlockedUrlError ||
      (error instanceof Error && error.name === "BlockedUrlError")
    ) {
      io.stderr(`Blocked: ${error.message}\n`);
      return 2;
    }
    if (error instanceof ThemaError) {
      io.stderr(`${error.message}\n`);
      return 1;
    }
    io.stderr(`Failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}\n`);
    return 1;
  }
}
