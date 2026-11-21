import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lint } from "@google/design.md/linter";
import { extractSystem, fix, type StyleSample, type ThemaSystem } from "@thema/engine";
import { exportAll, toDesignMd } from "@thema/exporters";
import { BlockedUrlError } from "@thema/url-guard";
import { beforeEach, describe, expect, it } from "vitest";
import { main, parseRef, type Io } from "../src/cli.js";
import {
  apiExtractor,
  extractorFromEnv,
  type Extractor,
  type ExtractionOutput,
} from "../src/core.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const urlOf = (input: RequestInfo | URL) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** What the worker would return for "https://<fixture>.test/", through the real engine. */
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
  return { url, system, warnings, derived, screenshot: PNG };
}

const fakeExtractor: Extractor = {
  kind: "local",
  extract: (url) => {
    if (new URL(url).hostname.endsWith(".internal")) {
      return Promise.reject(
        new BlockedUrlError(`${new URL(url).hostname} resolves to a non-public address`),
      );
    }
    return Promise.resolve(fixtureOutput(url));
  },
};

let dir: string;
let out: string[];
let err: string[];
let io: Io;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "thema-cli-"));
  out = [];
  err = [];
  io = {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    cwd: dir,
    env: {},
    now: () => new Date("2026-11-14T10:00:00.000Z"),
  };
});

const run = (...argv: string[]) => main(argv, io, { extractor: fakeExtractor });
const readSystem = (file: string) =>
  JSON.parse(readFileSync(join(dir, file), "utf8")) as ThemaSystem;

describe("thema extract", () => {
  it("writes the system, a screenshot and a readable summary with warnings", async () => {
    expect(
      await run(
        "extract",
        "https://light-saas.test/",
        "--out",
        "north.json",
        "--screenshot",
        "north.png",
      ),
    ).toBe(0);
    expect(readSystem("north.json")).toEqual(fixtureOutput("https://light-saas.test/").system);
    expect(new Uint8Array(readFileSync(join(dir, "north.png")))).toEqual(PNG);
    const log = err.join("");
    expect(log).toMatch(/light-saas\.test/);
    expect(log).toMatch(/WCAG AA {2}light \d+\/13/);
    expect(log).toMatch(/No dark theme/);
  });

  it("prints the JSON to stdout without --out", async () => {
    expect(await run("extract", "https://warm-editorial.test/")).toBe(0);
    expect(JSON.parse(out.join(""))).toEqual(fixtureOutput("https://warm-editorial.test/").system);
  });

  it("refuses a blocked URL with exit code 2", async () => {
    expect(await run("extract", "https://db.internal/")).toBe(2);
    expect(err.join("")).toMatch(/^Blocked: db\.internal resolves to a non-public address/m);
  });

  it("uses the API when THEMA_API_URL is set", () => {
    expect(extractorFromEnv({}).kind).toBe("local");
    expect(extractorFromEnv({ THEMA_API_URL: "https://thema.example" }).kind).toBe("api");
  });
});

describe("the API extractor", () => {
  it("creates a project, adds the URL, polls until done and fetches the screenshot", async () => {
    const system = fixtureOutput("https://light-saas.test/").system;
    let polls = 0;
    const calls: string[] = [];
    const respond = (url: string, init?: RequestInit): Response => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("https://thema.example", "")}`);
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (url.endsWith("/api/projects")) return json({ project: { id: "p1" } }, 201);
      if (url.endsWith("/api/projects/p1/references")) {
        return json({ reference: { id: "r1", status: "queued" } }, 202);
      }
      if (url.endsWith("/api/references/r1")) {
        polls += 1;
        return json({
          reference:
            polls < 2
              ? { id: "r1", status: "running", stage: "reading" }
              : {
                  id: "r1",
                  status: "done",
                  system,
                  warnings: ["no-dark-theme"],
                  derived: [],
                  screenshot: "/api/references/r1/screenshot",
                },
        });
      }
      if (url.endsWith("/api/references/r1/screenshot")) return new Response(PNG);
      return json({ error: { message: "not found" } }, 404);
    };
    const fakeFetch: typeof fetch = (input, init) => Promise.resolve(respond(urlOf(input), init));
    const output = await apiExtractor("https://thema.example/", {
      fetch: fakeFetch,
      pollMs: 1,
    }).extract("https://light-saas.test/");
    expect(output.system).toEqual(system);
    expect(output.warnings).toEqual(["no-dark-theme"]);
    expect(output.screenshot).toEqual(PNG);
    expect(calls).toEqual([
      "POST /api/projects",
      "POST /api/projects/p1/references",
      "GET /api/references/r1",
      "GET /api/references/r1",
      "GET /api/references/r1/screenshot",
    ]);
  });

  it("turns the API's blocked-URL answer into a blocked error", async () => {
    const fakeFetch: typeof fetch = (input) =>
      Promise.resolve(
        urlOf(input).endsWith("/api/projects")
          ? new Response(JSON.stringify({ project: { id: "p1" } }), { status: 201 })
          : new Response(
              JSON.stringify({
                error: { code: "blocked-url", message: "Local host not allowed: localhost" },
              }),
              { status: 400 },
            ),
      );
    await expect(
      apiExtractor("https://thema.example", { fetch: fakeFetch }).extract("http://localhost"),
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });
});

describe("thema blend", () => {
  beforeEach(async () => {
    await run("extract", "https://light-saas.test/", "--out", "north.json");
    await run("extract", "https://warm-editorial.test/", "--out", "notes.json");
    err = [];
  });

  it("takes each tag from its file, then fixes contrast", async () => {
    expect(
      await run(
        "blend",
        "north.json=colors,shape",
        "notes.json=typography",
        "--density",
        "0.4",
        "--out",
        "blend.json",
      ),
    ).toBe(0);
    const blended = readSystem("blend.json");
    expect(blended.typography.families).toEqual(readSystem("notes.json").typography.families);
    // Tags nobody claimed (spacing, layout) come from the first file, and its source says so.
    expect(blended.meta.sources.map((s) => [...s.borrowed].sort())).toEqual([
      ["colors", "layout", "shape", "spacing"],
      ["typography"],
    ]);
    expect(blended.a11y.passes).toBe(true);
    expect(err.join("")).toMatch(/dark theme generated/);
  });

  it("keeps a locked token from --previous and reports the pair it blocks", async () => {
    await run("blend", "north.json", "--out", "first.json");
    const previous = readSystem("first.json");
    previous.color.light.primary = "oklch(0.95 0.12 100)";
    writeFileSync(join(dir, "previous.json"), JSON.stringify(previous));
    err = [];
    expect(
      await run(
        "blend",
        "north.json",
        "--previous",
        "previous.json",
        "--lock",
        "color.light.primary",
        "--lock",
        "color.light.nope",
        "--out",
        "locked.json",
      ),
    ).toBe(0);
    expect(readSystem("locked.json").color.light.primary).toBe("oklch(0.95 0.12 100)");
    const log = err.join("");
    expect(log).toMatch(/unresolved {2}primary on canvas \(light\) .* locked, can't fix/);
    expect(log).toMatch(/ignored lock {2}color\.light\.nope/);
  });

  it("explains bad input: unknown tags, sliders out of range, files that aren't systems", async () => {
    expect(await run("blend", "north.json=logos", "--out", "x.json")).toBe(2);
    expect(err.join("")).toMatch(/Unknown tag "logos"/);
    err = [];
    expect(await run("blend", "north.json", "--density", "2", "--out", "x.json")).toBe(1);
    expect(err.join("")).toMatch(/density must be between -1 and 1/);
    err = [];
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ meta: {} }));
    expect(await run("blend", "bad.json", "--out", "x.json")).toBe(1);
    expect(err.join("")).toMatch(/bad\.json isn't a Thema system/);
  });

  it("parses file=tags arguments", () => {
    expect(parseRef("a.json")).toEqual({ path: "a.json", borrowed: [] });
    expect(parseRef("C:/x/a.json=colors, layout")).toEqual({
      path: "C:/x/a.json",
      borrowed: ["colors", "layout"],
    });
  });
});

describe("thema export", () => {
  beforeEach(async () => {
    await run("extract", "https://cal-com.test/", "--out", "cal.json");
    await run("blend", "cal.json", "--out", "system.json");
  });

  it("writes DESIGN.md byte for byte as the exporters do, and it passes Google's linter", async () => {
    expect(
      await run("export", "--in", "system.json", "--format", "design-md", "--out", "out"),
    ).toBe(0);
    const designMd = readFileSync(join(dir, "out", "DESIGN.md"), "utf8");
    expect(designMd).toBe(toDesignMd(readSystem("system.json")));
    const report = lint(designMd);
    expect(report.summary.errors).toBe(0);
    expect(report.findings.filter((f) => f.severity !== "info")).toEqual([]);
  });

  it("writes all five files with format all", async () => {
    expect(await run("export", "--in", "system.json", "--out", "all")).toBe(0);
    expect(readdirSync(join(dir, "all")).sort()).toEqual(
      Object.keys(exportAll(readSystem("system.json"))).sort(),
    );
  });

  it("refuses unknown formats and missing input", async () => {
    expect(await run("export", "--in", "system.json", "--format", "pdf")).toBe(2);
    expect(err.join("")).toMatch(/Unknown format "pdf"/);
    expect(await run("export", "--format", "tailwind")).toBe(2);
    expect(await run("nonsense")).toBe(2);
    expect(await run("help")).toBe(0);
    expect(out.join("")).toMatch(/^thema: blend reference sites/m);
  });
});

describe("thema setup", () => {
  it("runs the browser installer and returns its exit code; help lists it", async () => {
    let calls = 0;
    const installBrowser = () => {
      calls += 1;
      return Promise.resolve(0);
    };
    expect(await main(["setup"], io, { installBrowser })).toBe(0);
    expect(calls).toBe(1);
    expect(await main(["setup"], io, { installBrowser: () => Promise.resolve(1) })).toBe(1);
    await main(["--help"], io);
    expect(out.join("")).toContain("thema setup");
  });
});

describe("the real binary", () => {
  it("runs `thema export` in a subprocess", () => {
    const system = fix(fixtureOutput("https://light-saas.test/").system).system;
    writeFileSync(join(dir, "system.json"), JSON.stringify(system));
    const tsx = fileURLToPath(import.meta.resolve("tsx/cli"));
    const bin = join(import.meta.dirname, "../src/bin.ts");
    execFileSync(
      process.execPath,
      [tsx, bin, "export", "--in", "system.json", "--format", "tailwind", "--out", "out"],
      {
        cwd: dir,
        env: { ...process.env, INIT_CWD: dir },
        stdio: "pipe",
      },
    );
    expect(readFileSync(join(dir, "out", "theme.css"), "utf8")).toBe(
      exportAll(system)["theme.css"],
    );
  });
});
