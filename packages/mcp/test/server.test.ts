// The MCP server through a real MCP client, connected in memory. The worker is mocked with the
// recorded fixtures: "https://<fixture>.test/" extracts as that fixture.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lint } from "@google/design.md/linter";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { extractSystem, type StyleSample, type ThemaSystem } from "@thema/engine";
import { toDesignMd } from "@thema/exporters";
import { BlockedUrlError } from "@thema/url-guard";
import type { Extractor, ExtractionOutput } from "@thema/cli/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createThemaServer } from "../src/server.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");

function fixtureOutput(url: string): ExtractionOutput {
  const name = new URL(url).hostname.replace(/\.test$/, "");
  const read = (file: string) =>
    existsSync(join(FIXTURES, name, file))
      ? (JSON.parse(readFileSync(join(FIXTURES, name, file), "utf8")) as StyleSample[])
      : undefined;
  const samples = read("samples.json");
  if (!samples) throw new Error(`net::ERR_NAME_NOT_RESOLVED ${url}`);
  const darkSamples = read("samples.dark.json");
  const { system, warnings, derived } = extractSystem({
    samples,
    ...(darkSamples ? { darkSamples } : {}),
    source: { url, borrowed: [], screenshot: "" },
    name: new URL(url).hostname,
    createdAt: "2026-11-14T00:00:00.000Z",
  });
  return { url, system, warnings, derived, screenshot: new Uint8Array() };
}

const extracted: string[] = [];
const extractor: Extractor = {
  kind: "local",
  extract: (url) => {
    extracted.push(url);
    const host = new URL(url).hostname;
    if (host.endsWith(".internal")) {
      return Promise.reject(new BlockedUrlError(`${host} resolves to a non-public address`));
    }
    return Promise.resolve(fixtureOutput(url));
  },
};

let client: Client;
let dir: string;

beforeEach(async () => {
  extracted.length = 0;
  dir = mkdtempSync(join(tmpdir(), "thema-mcp-"));
  const server = createThemaServer({
    extractor,
    cwd: dir,
    now: () => new Date("2026-11-14T10:00:00.000Z"),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
});

/** Call a tool; returns its text and whether it reported an error. */
async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return { text: content.map((c) => c.text).join(""), isError: result.isError === true };
}

const json = <T>(text: string) => JSON.parse(text) as T;

describe("the Thema MCP server", () => {
  it("lists the three tools with input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["extract", "blend", "get_design_md"]);
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(40);
      expect(tool.inputSchema.type).toBe("object");
    }
    expect(Object.keys(tools[0]?.inputSchema.properties ?? {})).toEqual(["url", "out_path"]);
  });

  it("extract returns an id, a short summary and warnings in words", async () => {
    const { text, isError } = await call("extract", { url: "light-saas.test" });
    expect(isError).toBe(false);
    const result = json<{
      system_id: string;
      colors: { primary: string };
      warnings: string[];
      contrast: { light: string };
    }>(text);
    expect(result.system_id).toBe("sys_1");
    expect(result.colors.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.warnings).toEqual([expect.stringMatching(/No dark theme/)]);
    expect(result.contrast.light).toMatch(/^\d+\/13$/);
    expect(extracted).toEqual(["https://light-saas.test"]);
  });

  it("refuses a blocked URL as a tool error", async () => {
    const { text, isError } = await call("extract", { url: "https://db.internal/" });
    expect(isError).toBe(true);
    expect(text).toMatch(/^Blocked: db\.internal resolves to a non-public address/);
  });

  it("blend takes each part from its reference, fixes contrast and returns a new id", async () => {
    await call("extract", { url: "light-saas.test" });
    await call("extract", { url: "warm-editorial.test" });
    const { text, isError } = await call("blend", {
      references: [
        { system_id: "sys_1", borrowed: ["colors", "shape"] },
        { system_id: "sys_2", borrowed: ["typography"] },
      ],
      density: 0.3,
      out_path: "blend.json",
    });
    expect(isError).toBe(false);
    const result = json<{
      system_id: string;
      fonts: unknown;
      contrast: { light: string; dark: string };
      unresolved: unknown[];
      generated_theme: string;
    }>(text);
    expect(result.system_id).toBe("sys_3");
    expect(result.fonts).toEqual(
      fixtureOutput("https://warm-editorial.test/").system.typography.families,
    );
    expect(result.contrast).toEqual({ light: "13/13", dark: "13/13" });
    expect(result.unresolved).toEqual([]);
    expect(result.generated_theme).toBe("dark");
    const saved = JSON.parse(readFileSync(join(dir, "blend.json"), "utf8")) as ThemaSystem;
    expect(saved.a11y.passes).toBe(true);
  });

  it("blend keeps a locked token from the previous system and reports what it blocks", async () => {
    await call("extract", { url: "light-saas.test" });
    await call("blend", { references: [{ system_id: "sys_1" }], out_path: "first.json" });
    const previous = JSON.parse(readFileSync(join(dir, "first.json"), "utf8")) as ThemaSystem;
    previous.color.light.primary = "oklch(0.95 0.12 100)";
    writeFileSync(join(dir, "previous.json"), JSON.stringify(previous));
    const { text } = await call("blend", {
      references: [{ system_id: "sys_1" }],
      previous_path: "previous.json",
      locks: ["color.light.primary", "color.light.nope"],
    });
    const result = json<{
      unresolved: { pair: string; theme: string; reason: string }[];
      ignored_locks: string[];
    }>(text);
    expect(result.unresolved).toContainEqual(
      expect.objectContaining({
        pair: "primary on canvas",
        theme: "light",
        reason: "locked, can't fix",
      }),
    );
    expect(result.ignored_locks).toEqual(["color.light.nope"]);
  });

  it("get_design_md returns the exporters' DESIGN.md, passing Google's linter, and can write it", async () => {
    await call("extract", { url: "cal-com.test" });
    await call("blend", { references: [{ system_id: "sys_1" }], out_path: "system.json" });
    const system = JSON.parse(readFileSync(join(dir, "system.json"), "utf8")) as ThemaSystem;
    const { text } = await call("get_design_md", { system_id: "sys_2" });
    expect(text).toBe(toDesignMd(system));
    expect(lint(text).summary.errors).toBe(0);

    const written = await call("get_design_md", {
      system_path: "system.json",
      out_path: "DESIGN.md",
    });
    expect(written.text).toMatch(/^Wrote DESIGN\.md\./);
    expect(readFileSync(join(dir, "DESIGN.md"), "utf8")).toBe(toDesignMd(system));
  });

  it("explains unknown ids, missing systems and files that aren't systems", async () => {
    expect(await call("get_design_md", { system_id: "sys_9" })).toEqual({
      isError: true,
      text: 'No system "sys_9" in this session.',
    });
    expect((await call("get_design_md", {})).text).toBe("Give a system_id or a system_path.");
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ meta: {} }));
    const bad = await call("blend", { references: [{ system_path: "bad.json" }] });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/bad\.json isn't a Thema system/);
  });

  it("rejects arguments outside the schema", async () => {
    const outcome = await client
      .callTool({ name: "blend", arguments: { references: [{ system_id: "sys_1" }], density: 2 } })
      .then((result) => result.isError === true)
      .catch(() => true);
    expect(outcome).toBe(true);
  });
});
