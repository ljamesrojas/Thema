// @vitest-environment node
import { fix } from "@thema/engine";
import {
  exportAll,
  toDesignMd,
  toDtcg,
  toShadcnCss,
  toStyleGuide,
  toTailwindCss,
} from "@thema/exporters";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as exportRoute } from "@/app/api/projects/[id]/export/route";
import { setServices } from "@/server/services";
import { call, errorCode, fixtureSystem, PROJECT_ID, useFakeServices } from "./helpers";

// A real, fixed system: a recorded site after the fixer (what the blend route returns).
const system = fix(fixtureSystem("cal-com")).system;

const exportAs = (format: string, body: unknown = { system }) =>
  call(exportRoute, {
    method: "POST",
    path: `/api/projects/${PROJECT_ID}/export?format=${format}`,
    id: PROJECT_ID,
    body,
  });

beforeEach(() => {
  useFakeServices();
});
afterEach(() => setServices(undefined));

describe("POST /api/projects/:id/export", () => {
  it.each([
    ["design-md", "DESIGN.md", "text/markdown; charset=utf-8", toDesignMd],
    ["tailwind", "theme.css", "text/css; charset=utf-8", toTailwindCss],
    ["shadcn", "shadcn.css", "text/css; charset=utf-8", toShadcnCss],
    ["dtcg", "tokens.json", "application/json; charset=utf-8", toDtcg],
    ["styleguide", "style-guide.html", "text/html; charset=utf-8", toStyleGuide],
  ])("%s matches packages/exporters byte for byte", async (format, file, type, exporter) => {
    const response = await exportAs(format);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(type);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${file}"`);
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new TextEncoder().encode(exporter(system)));
  });

  it("zip holds the five files, each byte for byte, and is the same on every call", async () => {
    const response = await exportAs("zip");
    expect(response.headers.get("content-type")).toBe("application/zip");
    const archive = new Uint8Array(await response.arrayBuffer());
    const files = unzipSync(archive);
    const expected = exportAll(system);
    expect(Object.keys(files).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, content] of Object.entries(expected)) {
      expect(strFromU8(files[name] ?? new Uint8Array()), name).toBe(content);
    }
    const again = new Uint8Array(await (await exportAs("zip")).arrayBuffer());
    expect(again).toEqual(archive);
  });

  it("refuses unknown formats and invalid systems", async () => {
    expect(await errorCode(await exportAs("pdf"))).toBe("invalid-format");
    expect(await errorCode(await exportAs("tailwind", { system: { meta: {} } }))).toBe(
      "invalid-body",
    );
  });
});
