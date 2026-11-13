import { describe, expect, it } from "vitest";
import type { Hop, Upstream, UpstreamResponse } from "../src/extract.js";
import { runExtraction } from "../src/job.js";
import type { Lookup } from "../src/ssrf.js";

const lookup: Lookup = () => Promise.resolve(["93.184.215.14"]);

const NOT_FOUND: UpstreamResponse = { status: 404, headers: {}, body: "" };

/** An in-memory site with one page that has a real dark theme. */
const upstream: Upstream = (hop: Hop) =>
  Promise.resolve<UpstreamResponse>(
    hop.url === "https://studio.test/"
      ? {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: `<!doctype html><html><head><style>
  body { margin: 0; background: #ffffff; color: #111111; font: 16px/24px Arial, sans-serif }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #ededed } }
  button { background: #2563eb; color: #fff; padding: 8px 16px; border: 0; border-radius: 8px }
</style></head><body><h1>Studio</h1><p>Text</p><p>More text</p><button>Start</button><button>Go</button></body></html>`,
        }
      : NOT_FOUND,
  );

describe("runExtraction (in-memory site, no network)", () => {
  it("returns the engine's system, warnings and a PNG, reporting each stage in order", async () => {
    const stages: string[] = [];
    const output = await runExtraction("https://studio.test/", {
      lookup,
      upstream,
      now: () => new Date("2026-11-13T10:00:00.000Z"),
      onStage: (stage) => stages.push(stage),
    });
    expect(stages).toEqual(["fetching", "reading", "naming"]);
    expect(output.url).toBe("https://studio.test/");
    expect(output.system.meta).toMatchObject({
      name: "studio.test",
      createdAt: "2026-11-13T10:00:00.000Z",
      sources: [{ url: "https://studio.test/", borrowed: [], screenshot: "" }],
    });
    expect(output.system.color.light.canvas).toMatch(/^oklch\(/);
    // The page has a dark theme, so there's no no-dark-theme warning.
    expect(output.warnings).not.toContain("no-dark-theme");
    expect([...output.screenshot.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("refuses a private URL before loading anything", async () => {
    await expect(runExtraction("http://10.0.0.1/", { lookup, upstream })).rejects.toMatchObject({
      name: "BlockedUrlError",
    });
  });
});
