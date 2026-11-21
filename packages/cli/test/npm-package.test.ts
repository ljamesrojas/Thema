// The thema-cli npm package as npm would install it: built by scripts/build-npm.ts, packed with
// `npm pack`, copied to an empty folder with its one dependency (Playwright) next to it, then run
// with plain Node. No network: Playwright is linked from this repo, and nothing here extracts.
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lint } from "@google/design.md/linter";
import { extractSystem, type StyleSample } from "@thema/engine";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const NPM = join(import.meta.dirname, "../npm");
const FIXTURES = join(ROOT, "fixtures");

let installed: string;

/** Run the installed command with plain Node, in `cwd`. */
const thema = (args: string[], cwd: string) =>
  spawnSync(process.execPath, [join(installed, "dist/thema.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, INIT_CWD: cwd },
  });

beforeAll(() => {
  const tsx = fileURLToPath(import.meta.resolve("tsx/cli"));
  execFileSync(process.execPath, [tsx, join(ROOT, "scripts/build-npm.ts"), "cli"], {
    cwd: ROOT,
    stdio: "pipe",
  });
  // An install: the package's files, and Playwright in its node_modules (linked from the repo).
  installed = join(mkdtempSync(join(tmpdir(), "thema-cli-npm-")), "thema-cli");
  cpSync(NPM, installed, { recursive: true });
  mkdirSync(join(installed, "node_modules"));
  const playwright = realpathSync(join(ROOT, "apps/worker/node_modules/playwright"));
  symlinkSync(playwright, join(installed, "node_modules/playwright"), "junction");
}, 120_000);

describe("the thema-cli npm package", () => {
  it("publishes only the bundle, its licenses, the README and the manifest", () => {
    const packed = JSON.parse(
      execFileSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: NPM,
        encoding: "utf8",
        shell: process.platform === "win32",
      }),
    ) as { name: string; version: string; files: { path: string }[] }[];
    expect(packed[0]?.name).toBe("thema-cli");
    expect(packed[0]?.files.map((f) => f.path).sort()).toEqual([
      "LICENSE",
      "README.md",
      "dist/THIRD_PARTY_LICENSES.txt",
      "dist/thema.mjs",
      "package.json",
    ]);
  });

  it("pins the Playwright version Thema's worker uses, and names its bin `thema`", () => {
    const manifest = JSON.parse(readFileSync(join(NPM, "package.json"), "utf8")) as {
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };
    const playwright = JSON.parse(
      readFileSync(join(ROOT, "apps/worker/node_modules/playwright/package.json"), "utf8"),
    ) as { version: string };
    expect(manifest.dependencies).toEqual({ playwright: playwright.version });
    expect(manifest.bin).toEqual({ thema: "dist/thema.mjs" });
    expect(
      readFileSync(join(NPM, "dist/thema.mjs"), "utf8").startsWith("#!/usr/bin/env node"),
    ).toBe(true);
  });

  it("runs: help, blend and export with plain Node, no repo or tsx needed", () => {
    const help = thema(["--help"], installed);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("thema setup");

    const work = mkdtempSync(join(tmpdir(), "thema-cli-run-"));
    for (const name of ["light-saas", "warm-editorial"]) {
      const samples = JSON.parse(
        readFileSync(join(FIXTURES, name, "samples.json"), "utf8"),
      ) as StyleSample[];
      const { system } = extractSystem({
        samples,
        source: { url: `https://${name}.example/`, borrowed: [], screenshot: "" },
        name,
        createdAt: "2026-11-21T00:00:00.000Z",
      });
      writeFileSync(join(work, `${name}.json`), JSON.stringify(system));
    }
    const blend = thema(
      [
        "blend",
        "light-saas.json=colors,shape",
        "warm-editorial.json=typography",
        "--out",
        "blend.json",
      ],
      work,
    );
    expect(blend.status, blend.stderr).toBe(0);
    const exported = thema(["export", "--in", "blend.json", "--out", "design"], work);
    expect(exported.status, exported.stderr).toBe(0);
    for (const file of [
      "DESIGN.md",
      "theme.css",
      "shadcn.css",
      "tokens.json",
      "style-guide.html",
    ]) {
      expect(existsSync(join(work, "design", file)), file).toBe(true);
    }
    expect(lint(readFileSync(join(work, "design/DESIGN.md"), "utf8")).summary.errors).toBe(0);
  });

  it("refuses a local address with exit code 2, before any browser starts", () => {
    const blocked = thema(["extract", "http://localhost:3000/"], installed);
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toMatch(/^Blocked: .*localhost/m);
  });
});
