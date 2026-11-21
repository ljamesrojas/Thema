// @vitest-environment node
// Routes behind sign-in: the account, saved projects (claim, open, save, delete, export),
// per-plan limits and screenshots that outlive the queue. Sessions are faked by a header.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE as deleteAccount, GET as getAccount } from "@/app/api/account/route";
import { GET as authRoute } from "@/app/api/auth/[...all]/route";
import { GET as listProjects, POST as createProject } from "@/app/api/projects/route";
import {
  DELETE as deleteProject,
  GET as getProject,
  PUT as saveProject,
} from "@/app/api/projects/[id]/route";
import { GET as exportSaved } from "@/app/api/projects/[id]/export/route";
import { POST as addReference } from "@/app/api/projects/[id]/references/route";
import { GET as getReference } from "@/app/api/references/[id]/route";
import { GET as getScreenshot } from "@/app/api/references/[id]/screenshot/route";
import type { ReferenceView } from "@/server/references";
import { setServices } from "@/server/services";
import { ID, OTHER_ID, projectData } from "../server/project-data";
import { call, errorCode, PNG, signedIn, useFakeServices, type TestServices } from "./helpers";

let services: TestServices;
beforeEach(() => {
  services = useFakeServices();
});
afterEach(() => setServices(undefined));

const ana = signedIn("ana");
const ben = signedIn("ben");

const claim = (body: unknown, headers: Record<string, string> = ana) =>
  call(createProject, { method: "POST", path: "/api/projects", body, headers });
const save = (id: string, body: unknown, headers: Record<string, string> = ana) =>
  call(saveProject, { method: "PUT", path: `/api/projects/${id}`, id, body, headers });

describe("GET /api/account", () => {
  it("says accounts are off when the server has none", async () => {
    services = useFakeServices({ accounts: false });
    const data = (await (await call(getAccount, { path: "/api/account" })).json()) as unknown;
    expect(data).toEqual({
      enabled: false,
      providers: [],
      account: null,
      limits: { dailyExtractions: 3 },
    });
    const auth = await call(authRoute, { path: "/api/auth/get-session" });
    expect(auth.status).toBe(404);
  });

  it("lists the sign-in options when signed out", async () => {
    const data = (await (await call(getAccount, { path: "/api/account" })).json()) as {
      enabled: boolean;
      providers: string[];
      account: null;
    };
    expect(data).toMatchObject({ enabled: true, providers: ["github", "google"], account: null });
  });

  it("returns the account with its plan's limits and saved count", async () => {
    await claim({ project: projectData() });
    const free = (await (
      await call(getAccount, { path: "/api/account", headers: ana })
    ).json()) as { account: { plan: string }; limits: unknown };
    expect(free.account.plan).toBe("free");
    expect(free.limits).toEqual({ dailyExtractions: 10, savedProjects: 3, saved: 1 });
    const pro = (await (
      await call(getAccount, { path: "/api/account", headers: signedIn("ana", "pro") })
    ).json()) as { limits: unknown };
    expect(pro.limits).toEqual({ dailyExtractions: 50, savedProjects: null, saved: 1 });
  });
});

describe("claiming and listing saved projects", () => {
  it("needs a session (401), and is off without accounts (404)", async () => {
    expect((await call(listProjects, { path: "/api/projects" })).status).toBe(401);
    expect(await errorCode(await claim({ project: projectData() }, {}))).toBe("sign-in-required");
    services = useFakeServices({ accounts: false });
    const off = await call(listProjects, { path: "/api/projects", headers: ana });
    expect(off.status).toBe(404);
    expect(await errorCode(off)).toBe("accounts-off");
  });

  it("still makes an empty browser project without a body, signed in or not", async () => {
    const response = await call(createProject, {
      method: "POST",
      path: "/api/projects",
      headers: ana,
    });
    expect(response.status).toBe(201);
    expect(await services.projects.count("ana")).toBe(0);
  });

  it("saves the browser's project once, however often it's claimed", async () => {
    const first = await claim({ project: projectData() });
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ status: "created", project: { id: ID, version: 1 } });
    const again = await claim({ project: projectData() });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ status: "exists", project: { id: ID, version: 1 } });

    const list = (await (
      await call(listProjects, { path: "/api/projects", headers: ana })
    ).json()) as { projects: { id: string; urls: string[] }[] };
    expect(list.projects.map((p) => [p.id, p.urls])).toEqual([[ID, ["https://light-saas.test/"]]]);
    const theirs = (await (
      await call(listProjects, { path: "/api/projects", headers: ben })
    ).json()) as { projects: unknown[] };
    expect(theirs.projects).toEqual([]);
  });

  it("refuses a fourth project on Free and has no limit on Pro", async () => {
    const ids = [ID, OTHER_ID, "11111111-2222-4333-8444-555555555555"];
    for (const id of ids) expect((await claim({ project: projectData({ id }) })).status).toBe(201);
    const fourth = await claim({
      project: projectData({ id: "99999999-2222-4333-8444-555555555555" }),
    });
    expect(fourth.status).toBe(403);
    expect(await errorCode(fourth)).toBe("project-limit");
    // Re-claiming one it already has isn't a new project.
    expect((await claim({ project: projectData({ id: ID }) })).status).toBe(200);

    const pro = signedIn("ana", "pro");
    const more = await claim(
      { project: projectData({ id: "99999999-2222-4333-8444-555555555555" }) },
      pro,
    );
    expect(more.status).toBe(201);
  });

  it("validates the project it's sent (400)", async () => {
    const bad = await claim({ project: { ...projectData(), blend: { density: 9 } } });
    expect(bad.status).toBe(400);
    const sneaky = projectData();
    const ref = sneaky.references[0];
    if (ref) ref.screenshot = "https://tracker.example/pixel.png";
    expect((await claim({ project: sneaky })).status).toBe(400);
  });
});

describe("one saved project", () => {
  beforeEach(async () => {
    await claim({ project: projectData() });
  });

  it("opens for its owner and is 'not found' for anyone else", async () => {
    const mine = await call(getProject, { path: `/api/projects/${ID}`, id: ID, headers: ana });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ project: projectData(), version: 1 });
    for (const [headers, status] of [
      [ben, 404],
      [{}, 401],
    ] as const) {
      const response = await call(getProject, { path: `/api/projects/${ID}`, id: ID, headers });
      expect(response.status).toBe(status);
    }
    expect(
      (await call(getProject, { path: "/api/projects/nope", id: "nope", headers: ana })).status,
    ).toBe(404);
  });

  it("saves on the current version and refuses a stale one with the current version (409)", async () => {
    const saved = await save(ID, { project: projectData({ name: "Kiln" }), baseVersion: 1 });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ version: 2 });
    const stale = await save(ID, { project: projectData({ name: "Old tab" }), baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: { code: "conflict", details: { version: 2 } },
    });
    expect((await save(ID, { project: projectData(), baseVersion: 2 }, ben)).status).toBe(404);
  });

  it("deletes for its owner only", async () => {
    const del = (headers: Record<string, string>) =>
      call(deleteProject, { method: "DELETE", path: `/api/projects/${ID}`, id: ID, headers });
    expect((await del(ben)).status).toBe(404);
    expect((await del(ana)).status).toBe(200);
    expect(await services.projects.count("ana")).toBe(0);
    expect((await del(ana)).status).toBe(404);
  });

  it("exports the last blend for its owner", async () => {
    const response = await call(exportSaved, {
      path: `/api/projects/${ID}/export?format=design-md`,
      id: ID,
      headers: ana,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/^---/);
    const theirs = await call(exportSaved, {
      path: `/api/projects/${ID}/export?format=zip`,
      id: ID,
      headers: ben,
    });
    expect(theirs.status).toBe(404);
  });

  it("can't export before the first blend (409)", async () => {
    const data = projectData({ id: OTHER_ID });
    delete data.result;
    await claim({ project: data });
    const response = await call(exportSaved, {
      path: `/api/projects/${OTHER_ID}/export?format=tailwind`,
      id: OTHER_ID,
      headers: ana,
    });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("not-blended");
  });
});

describe("daily extraction limits by plan", () => {
  const add = (n: number, headers: Record<string, string>) =>
    call(addReference, {
      method: "POST",
      path: `/api/projects/${ID}/references`,
      id: ID,
      body: { url: `https://site-${n}.test/`, borrowed: [] },
      headers: { "x-forwarded-for": "203.0.113.9", ...headers },
    });

  it("gives Free accounts 10 a day, counted per account, not per IP", async () => {
    const statuses = [];
    for (let n = 0; n < 11; n++) statuses.push((await add(n, ana)).status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(10);
    const refused = await add(99, ana);
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { error: { message: string } }).error.message).toMatch(
      /^Free accounts get 10 new extractions a day/,
    );
    // Same IP, signed out: its own anonymous count (3).
    expect((await add(100, {})).status).toBe(202);
  });

  it("tells signed-out users that signing in gives more", async () => {
    for (let n = 0; n < 3; n++) await add(n, {});
    const refused = await add(3, {});
    expect(((await refused.json()) as { error: { message: string } }).error.message).toMatch(
      /^Without an account you get 3; sign in for more/,
    );
  });
});

describe("screenshots of saved projects", () => {
  async function extracted() {
    const added = await call(addReference, {
      method: "POST",
      path: `/api/projects/${ID}/references`,
      id: ID,
      body: { url: "light-saas.test", borrowed: [] },
      headers: ana,
    });
    const { reference } = (await added.json()) as { reference: ReferenceView };
    for (let i = 0; i < 50; i++) {
      const polled = await call(getReference, {
        path: `/api/references/${reference.id}`,
        id: reference.id,
      });
      const { reference: now } = (await polled.json()) as { reference: ReferenceView };
      if (now.status === "done") return now;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("extraction didn't finish");
  }

  const shot = (id: string, headers: Record<string, string>) =>
    call(getScreenshot, { path: `/api/references/${id}/screenshot`, id, headers });

  it("are kept when saved, served to the owner after the queue forgets them, and dropped with the last project", async () => {
    const reference = await extracted();
    const data = projectData();
    const [first] = data.references;
    if (!first) throw new Error("projectData has a reference");
    data.references = [{ ...first, id: reference.id, screenshot: reference.screenshot }];
    await claim({ project: data });
    expect(await services.screenshots.has(reference.id)).toBe(true);

    services.clock.now = new Date(services.clock.now.getTime() + 25 * 60 * 60 * 1000);
    expect(await services.queue.screenshot(reference.id)).toBeNull();
    const mine = await shot(reference.id, ana);
    expect(mine.status).toBe(200);
    expect(new Uint8Array(await mine.arrayBuffer())).toEqual(PNG);
    expect((await shot(reference.id, ben)).status).toBe(404);
    expect((await shot(reference.id, {})).status).toBe(404);

    await call(deleteProject, {
      method: "DELETE",
      path: `/api/projects/${ID}`,
      id: ID,
      headers: ana,
    });
    expect(await services.screenshots.has(reference.id)).toBe(false);
  });
});

describe("DELETE /api/account", () => {
  const del = (headers: Record<string, string>) =>
    call(deleteAccount, { method: "DELETE", path: "/api/account", headers });

  it("needs a session (401), and is off without accounts (404)", async () => {
    expect((await del({})).status).toBe(401);
    services = useFakeServices({ accounts: false });
    expect((await del(ana)).status).toBe(404);
  });

  it("deletes the account's projects, their unused screenshots, then the user", async () => {
    await claim({ project: projectData() });
    await claim({ project: projectData({ id: OTHER_ID }) });
    const shared = projectData({ id: "33333333-2222-4333-8444-555555555555" });
    await claim({ project: shared }, ben);
    const ref = projectData().references[0]?.id ?? "";
    await services.screenshots.put(ref, PNG);

    const response = await del(ana);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(await services.projects.count("ana")).toBe(0);
    expect(services.deletedUsers).toEqual(["ana"]);
    // Ben's project uses the same site, so its screenshot stays.
    expect(await services.screenshots.has(ref)).toBe(true);
    expect(await services.projects.count("ben")).toBe(1);

    await call(deleteAccount, { method: "DELETE", path: "/api/account", headers: ben });
    expect(await services.screenshots.has(ref)).toBe(false);
  });
});
