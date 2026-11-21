// pnpm build:npm [cli|mcp]: bundle the CLI and the MCP server into the npm packages thema-cli and
// thema-mcp (packages/cli/npm, packages/mcp/npm). Each command becomes one ESM file with the
// engine, the exporters, the MCP SDK and zod inside; Playwright stays a real dependency (it
// installs the browser). The licenses of everything bundled go to dist/THIRD_PARTY_LICENSES.txt,
// as their MIT/ISC/BSD terms ask.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");

const PACKAGES = {
  cli: { dir: "packages/cli", entry: "src/bin.ts", out: "dist/thema.mjs" },
  mcp: { dir: "packages/mcp", entry: "src/bin.ts", out: "dist/thema-mcp.mjs" },
} as const;

/** The directory of the npm package a bundled file came from, or null for our own sources. */
function packageDirOf(file: string): string | null {
  const parts = file.split(/[\\/]/);
  const at = parts.lastIndexOf("node_modules");
  if (at < 0) return null;
  const name = parts[at + 1]?.startsWith("@")
    ? parts.slice(at + 1, at + 3)
    : parts.slice(at + 1, at + 2);
  // `file` is absolute; "/" joins work on Windows drive paths too (C:/Users/…).
  return [...parts.slice(0, at + 1), ...name].join("/");
}

function thirdPartyLicenses(inputs: string[]): string {
  const dirs = [...new Set(inputs.map(packageDirOf).filter((d): d is string => d !== null))].sort();
  return dirs
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        version: string;
        license?: string;
      };
      const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
      const text = file
        ? readFileSync(join(dir, file), "utf8").trim()
        : `License: ${manifest.license ?? "see package"}`;
      return `${manifest.name}@${manifest.version} (${manifest.license ?? "unknown"})\n\n${text}`;
    })
    .join(`\n\n${"-".repeat(72)}\n\n`);
}

const only = process.argv[2] as keyof typeof PACKAGES | undefined;
if (only && !(only in PACKAGES)) {
  console.error(`Usage: pnpm build:npm [${Object.keys(PACKAGES).join("|")}]`);
  process.exit(2);
}

for (const [key, { dir, entry, out }] of Object.entries(PACKAGES)) {
  if (only && key !== only) continue;
  const npm = join(ROOT, dir, "npm");
  rmSync(join(npm, "dist"), { recursive: true, force: true });
  mkdirSync(join(npm, "dist"), { recursive: true });
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: [join(ROOT, dir, entry)],
    outfile: join(npm, out),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["playwright", "playwright-core"],
    // Some bundled packages still call require(); give the ESM file one.
    banner: {
      js: 'import { createRequire as __themaRequire } from "node:module"; const require = __themaRequire(import.meta.url);',
    },
    legalComments: "none",
    metafile: true,
    logLevel: "warning",
  });
  const inputs = Object.keys(result.metafile.inputs).map((input) => join(ROOT, input));
  writeFileSync(join(npm, "dist", "THIRD_PARTY_LICENSES.txt"), `${thirdPartyLicenses(inputs)}\n`);
  copyFileSync(join(ROOT, dir, "LICENSE"), join(npm, "LICENSE"));
  if (!existsSync(join(npm, "README.md"))) throw new Error(`${dir}/npm/README.md is missing`);
  console.log(`Built ${relative(ROOT, join(npm, out))} (${dirname(out)}/THIRD_PARTY_LICENSES.txt)`);
}
