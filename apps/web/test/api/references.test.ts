// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createProject } from "@/app/api/projects/route";
import { POST as addReference } from "@/app/api/projects/[id]/references/route";
import { GET as getReference } from "@/app/api/references/[id]/route";
import { GET as getScreenshot } from "@/app/api/references/[id]/screenshot/route";
import type { ReferenceView } from "@/server/references";
import { setServices } from "@/server/services";
import { call, errorCode, PNG, PROJECT_ID, useFakeServices, type TestServices } from "./helpers";

interface AddResponse {
  reference: ReferenceView & { borrowed: string[] };
  cached: boolean;
  limit?: { remaining: number; resetAt: string };
}

const add = (url: string, options: { borrowed?: string[]; ip?: string } = {}) =>
  call(addReference, {
    method: "POST",
    path: `/api/projects/${PROJECT_ID}/references`,
    id: PROJECT_ID,
    body: { url, borrowed: options.borrowed ?? ["colors"] },
    headers: { "x-forwarded-for": options.ip ?? "203.0.113.7" },
  });

const poll = async (id: string) => {
  const response = await call(getReference, { path: `/api/references/${id}`, id });
  return { response, data: (await response.json()) as { reference: ReferenceView } };
};

let services: TestServices;
beforeEach(() => {
  services = useFakeServices();
});
afterEach(() => setServices(undefined));

describe("POST /api/projects", () => {
  it("returns a new anonymous project and stores nothing", async () => {
    const response = await call(createProject, { method: "POST", path: "/api/projects" });
    expect(response.status).toBe(201);
    const { project } = (await response.json()) as { project: Record<string, unknown> };
    expect(project).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      references: [],
      blend: { density: 0, roundness: 0, contrast: 0, warmth: 0 },
      updatedAt: "2026-11-13T10:00:00.000Z",
    });
  });
});

describe("POST /api/projects/:id/references", () => {
  it("enqueues an extraction and returns the reference (202)", async () => {
    const response = await add("light-saas.test", { borrowed: ["colors", "shape"] });
    expect(response.status).toBe(202);
    const data = (await response.json()) as AddResponse;
    expect(data.reference).toMatchObject({
      url: "https://light-saas.test/",
      borrowed: ["colors", "shape"],
      screenshot: null,
    });
    expect(data.reference.id).toMatch(/^[0-9a-f]{24}$/);
    expect(data.cached).toBe(false);
    expect(data.limit?.remaining).toBe(2);
  });

  it.each([
    ["localhost", "http://localhost:3000"],
    ["a private IP", "http://10.1.2.3/"],
    ["a host that resolves to a private address", "https://db.internal/"],
    ["credentials", "https://user:pass@light-saas.test/"],
    ["a non-http scheme", "ftp://light-saas.test/"],
  ])("refuses %s before enqueueing (400)", async (_label, url) => {
    const response = await add(url);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("blocked-url");
    expect(services.runs).toEqual([]);
  });

  it("refuses unknown borrow tags and empty URLs (400)", async () => {
    expect(await errorCode(await add("light-saas.test", { borrowed: ["logos"] }))).toBe(
      "invalid-body",
    );
    expect(await errorCode(await add("  "))).toBe("invalid-body");
  });

  it("returns 404 for a malformed project id and 400 for a bad JSON body", async () => {
    const notFound = await call(addReference, {
      method: "POST",
      path: "/api/projects/nope/references",
      id: "nope",
      body: { url: "light-saas.test" },
    });
    expect(notFound.status).toBe(404);
    const badJson = await call(addReference, {
      method: "POST",
      path: `/api/projects/${PROJECT_ID}/references`,
      id: PROJECT_ID,
      body: "{not json",
    });
    expect(await errorCode(badJson)).toBe("invalid-json");
  });
});

describe("GET /api/references/:id", () => {
  it("goes from queued to done with the system, warnings and screenshot route", async () => {
    const { reference } = (await (await add("light-saas.test")).json()) as AddResponse;
    await services.queue.settled(reference.id);
    const { response, data } = await poll(reference.id);
    expect(response.status).toBe(200);
    expect(data.reference.status).toBe("done");
    // light-saas has no dark recording: extractSystem warns, and the fixer will generate one.
    expect(data.reference.warnings).toContain("no-dark-theme");
    expect(data.reference.screenshot).toBe(`/api/references/${reference.id}/screenshot`);
    expect(data.reference.system?.meta.sources[0]?.screenshot).toBe(data.reference.screenshot);
    expect(data.reference.system?.color.light.canvas).toMatch(/^oklch\(/);
  });

  it("reports a failed extraction with its error", async () => {
    const { reference } = (await (await add("unknown-site.test")).json()) as AddResponse;
    await services.queue.settled(reference.id);
    const { data } = await poll(reference.id);
    expect(data.reference.status).toBe("failed");
    expect(data.reference).not.toHaveProperty("system");
    expect(data.reference.error).toMatch(/ERR_NAME_NOT_RESOLVED/);
  });

  it("returns 404 for unknown or malformed ids", async () => {
    expect((await poll("0".repeat(24))).response.status).toBe(404);
    expect((await poll("../etc")).response.status).toBe(404);
  });

  it("serves the screenshot as PNG once done", async () => {
    const { reference } = (await (await add("light-saas.test")).json()) as AddResponse;
    await services.queue.settled(reference.id);
    const response = await call(getScreenshot, {
      path: `/api/references/${reference.id}/screenshot`,
      id: reference.id,
    });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });
});

describe("cache and anonymous limit", () => {
  it("the same URL today is the same reference, extracted once, and doesn't count", async () => {
    const first = (await (await add("light-saas.test")).json()) as AddResponse;
    await services.queue.settled(first.reference.id);
    const again = await add("https://light-saas.test/#top", { borrowed: ["typography"] });
    expect(again.status).toBe(200);
    const data = (await again.json()) as AddResponse;
    expect(data).toMatchObject({ cached: true, reference: { status: "done" } });
    expect(data.reference.id).toBe(first.reference.id);
    expect(data.reference.borrowed).toEqual(["typography"]);
    expect(services.runs).toHaveLength(1);

    // Cache hits are free: three new URLs still fit in the day after two hits.
    await add("light-saas.test");
    expect((await add("warm-editorial.test")).status).toBe(202);
    expect((await add("dark-dev-tool.test")).status).toBe(202);
  });

  it("allows 3 new extractions a day per client, then 429 until UTC midnight", async () => {
    for (const name of ["light-saas", "warm-editorial", "dark-dev-tool"]) {
      expect((await add(`${name}.test`)).status).toBe(202);
    }
    const refused = await add("stripe.test");
    expect(refused.status).toBe(429);
    expect(await errorCode(refused)).toBe("rate-limited");
    expect(refused.headers.get("retry-after")).toBe(String(14 * 60 * 60)); // 10:00 → midnight UTC
    expect(services.runs).toHaveLength(3);

    // Already-extracted URLs still work, another client has its own count, and the day resets.
    expect((await add("light-saas.test")).status).toBeLessThan(400);
    expect((await add("stripe.test", { ip: "198.51.100.4" })).status).toBe(202);
    services.clock.now = new Date("2026-11-14T00:00:01.000Z");
    expect((await add("linear.test")).status).toBe(202);
  });
});
