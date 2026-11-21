// The thema-mcp npm package as an agent runs it: built by scripts/build-npm.ts, packed with
// `npm pack`, copied to an empty folder with Playwright next to it, then started with plain Node
// over stdio and driven by a real MCP client. No network: nothing here extracts a real site.
import { execFileSync } from "node:child_process";
import {
  cpSync,
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
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { extractSystem, fix, type StyleSample } from "@thema/engine";
import { toDesignMd } from "@thema/exporters";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const NPM = join(import.meta.dirname, "../npm");

let client: Client;
let work: string;

beforeAll(async () => {
  const tsx = fileURLToPath(import.meta.resolve("tsx/cli"));
  execFileSync(process.execPath, [tsx, join(ROOT, "scripts/build-npm.ts"), "mcp"], {
    cwd: ROOT,
    stdio: "pipe",
  });
  const installed = join(mkdtempSync(join(tmpdir(), "thema-mcp-npm-")), "thema-mcp");
  cpSync(NPM, installed, { recursive: true });
  mkdirSync(join(installed, "node_modules"));
  const playwright = realpathSync(join(ROOT, "apps/worker/node_modules/playwright"));
  symlinkSync(playwright, join(installed, "node_modules/playwright"), "junction");

  work = mkdtempSync(join(tmpdir(), "thema-mcp-run-"));
  client = new Client({ name: "npm-package-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(installed, "dist/thema-mcp.mjs")],
      cwd: work,
      env: { ...(process.env as Record<string, string>), INIT_CWD: work },
      stderr: "pipe",
    }),
  );
}, 120_000);

afterAll(async () => {
  await client.close();
});

const text = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as { type: string; text: string }[]).map((c) => c.text).join("");

describe("the thema-mcp npm package", () => {
  it("publishes only the bundle, its licenses, the README and the manifest", () => {
    const packed = JSON.parse(
      execFileSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: NPM,
        encoding: "utf8",
        shell: process.platform === "win32",
      }),
    ) as { name: string; files: { path: string }[] }[];
    expect(packed[0]?.name).toBe("thema-mcp");
    expect(packed[0]?.files.map((f) => f.path).sort()).toEqual([
      "LICENSE",
      "README.md",
      "dist/THIRD_PARTY_LICENSES.txt",
      "dist/thema-mcp.mjs",
      "package.json",
    ]);
  });

  it("starts over stdio with plain Node and lists the three tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["extract", "blend", "get_design_md"]);
  });

  it("writes DESIGN.md from a system file, relative to the folder it started in", async () => {
    const samples = JSON.parse(
      readFileSync(join(ROOT, "fixtures/light-saas/samples.json"), "utf8"),
    ) as StyleSample[];
    const system = fix(
      extractSystem({
        samples,
        source: { url: "https://light-saas.example/", borrowed: [], screenshot: "" },
        name: "light-saas",
        createdAt: "2026-11-21T00:00:00.000Z",
      }).system,
    ).system;
    writeFileSync(join(work, "thema.json"), JSON.stringify(system));
    const result = await client.callTool({
      name: "get_design_md",
      arguments: { system_path: "thema.json", out_path: "DESIGN.md" },
    });
    expect(result.isError).not.toBe(true);
    expect(readFileSync(join(work, "DESIGN.md"), "utf8")).toBe(toDesignMd(system));
  });

  it("refuses a local address as a tool error", async () => {
    const result = await client.callTool({
      name: "extract",
      arguments: { url: "http://localhost:3000/" },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^Blocked: /);
  });
});
