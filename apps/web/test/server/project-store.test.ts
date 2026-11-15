// @vitest-environment node
// One contract for both project stores: in-memory and Postgres (PGlite, after the migrations).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryProjectStore,
  createPostgresProjectStore,
  type ProjectStore,
} from "@/server/project-store";
import { ID, newId, OTHER_ID, projectData } from "./project-data";
import { insertUser, testDb } from "./pglite";

const pg = await testDb();
afterAll(() => pg.close());

const stores: [string, () => Promise<ProjectStore>][] = [
  ["memory", () => Promise.resolve(createMemoryProjectStore())],
  [
    "postgres",
    async () => {
      await pg.exec(`DELETE FROM "projects"; DELETE FROM "user";`);
      for (const user of ["ana", "ben"]) await insertUser(pg, user);
      return createPostgresProjectStore(pg);
    },
  ],
];

describe.each(stores)("project store (%s)", (_name, make) => {
  let store: ProjectStore;
  beforeEach(async () => {
    store = await make();
  });

  it("creates, gets and lists a project for its owner only", async () => {
    expect(await store.create("ana", projectData(), newId)).toEqual({
      status: "created",
      id: ID,
      version: 1,
    });
    const got = await store.get("ana", ID);
    expect(got?.data).toEqual(projectData());
    expect(got?.version).toBe(1);
    expect(await store.get("ben", ID)).toBeNull();
    expect(await store.list("ben")).toEqual([]);
    const [summary] = await store.list("ana");
    expect(summary).toMatchObject({
      id: ID,
      name: "Untitled system",
      version: 1,
      urls: ["https://light-saas.test/"],
    });
    expect(summary?.colors?.primary).toBe(projectData().result?.color.light.primary);
    expect(await store.count("ana")).toBe(1);
  });

  it("saves a claimed project once, and gives another account's id a new one", async () => {
    await store.create("ana", projectData(), newId);
    expect(await store.create("ana", projectData(), newId)).toMatchObject({ status: "exists" });
    expect(await store.count("ana")).toBe(1);
    const theirs = await store.create("ben", projectData(), newId);
    expect(theirs.status).toBe("created");
    expect(theirs.id).not.toBe(ID);
    expect((await store.get("ben", theirs.id))?.data.id).toBe(theirs.id);
  });

  it("saves on the current version and refuses an older one", async () => {
    await store.create("ana", projectData(), newId);
    const saved = await store.save("ana", ID, projectData({ name: "Kiln" }), 1);
    expect(saved).toMatchObject({ status: "saved", version: 2 });
    expect(await store.save("ana", ID, projectData({ name: "Stale" }), 1)).toEqual({
      status: "conflict",
      version: 2,
    });
    expect((await store.get("ana", ID))?.data.name).toBe("Kiln");
    expect((await store.list("ana"))[0]?.name).toBe("Kiln");
    expect(await store.save("ben", ID, projectData(), 2)).toEqual({ status: "missing" });
  });

  it("lists the most recently edited first", async () => {
    await store.create("ana", projectData(), newId);
    await new Promise((r) => setTimeout(r, 5));
    await store.create("ana", projectData({ id: OTHER_ID, name: "Second" }), newId);
    expect((await store.list("ana")).map((p) => p.name)).toEqual(["Second", "Untitled system"]);
    await new Promise((r) => setTimeout(r, 5));
    await store.save("ana", ID, projectData({ name: "First again" }), 1);
    expect((await store.list("ana")).map((p) => p.name)).toEqual(["First again", "Second"]);
  });

  it("removes only the owner's project and finds references by owner", async () => {
    await store.create("ana", projectData(), newId);
    const ref = "a".repeat(24);
    expect(await store.hasReference(ref, "ana")).toBe(true);
    expect(await store.hasReference(ref, "ben")).toBe(false);
    expect(await store.hasReference(ref)).toBe(true);
    expect(await store.hasReference("b".repeat(24))).toBe(false);
    expect(await store.remove("ben", ID)).toBeNull();
    expect((await store.remove("ana", ID))?.name).toBe("Untitled system");
    expect(await store.get("ana", ID)).toBeNull();
    expect(await store.hasReference(ref)).toBe(false);
  });

  it("has no palette before the first blend", async () => {
    const data = projectData();
    delete data.result;
    await store.create("ana", data, newId);
    expect((await store.list("ana"))[0]?.colors).toBeNull();
  });
});
