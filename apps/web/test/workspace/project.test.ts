// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addReference,
  BORROW_TAGS,
  blendKey,
  blendRequest,
  claimTag,
  loadProject,
  newProject,
  ownerOf,
  pairLockPath,
  removeReference,
  saveProject,
  STORAGE_KEY,
  swapCandidates,
  swapToken,
  toggleLock,
  updateReference,
  type ReferenceUpdate,
  type WorkspaceProject,
} from "@/workspace/project";
import { fixtureSystem } from "../api/helpers";

const ID = "6f1c1b2e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const refId = (n: number) => String(n).repeat(24);

const update = (n: number, name: string, done = true): ReferenceUpdate => ({
  id: refId(n),
  url: `https://${name}.test/`,
  status: done ? "done" : "running",
  ...(done ? { system: fixtureSystem(name) } : { stage: "reading" as const }),
  warnings: done ? ["no-dark-theme"] : [],
  screenshot: done ? `/api/references/${refId(n)}/screenshot` : null,
});

function withRefs(...names: string[]): WorkspaceProject {
  let project = newProject(ID, "2026-11-13T10:00:00.000Z");
  names.forEach((name, i) => {
    const result = addReference(project, update(i + 1, name));
    if (!result.ok) throw new Error(result.reason);
    project = result.project;
  });
  return project;
}

const owners = (project: WorkspaceProject) =>
  Object.fromEntries(BORROW_TAGS.map((tag) => [tag, ownerOf(project, tag)?.id.slice(0, 1)]));

describe("borrow tags: one owner each", () => {
  it("gives the first reference every tag, later ones none", () => {
    const project = withRefs("light-saas", "warm-editorial");
    expect(project.references[0]?.borrowed).toEqual(BORROW_TAGS);
    expect(project.references[1]?.borrowed).toEqual([]);
  });

  it("moves a claimed tag to its new owner, so every tag has exactly one owner", () => {
    let project = withRefs("light-saas", "warm-editorial", "dark-dev-tool");
    project = claimTag(project, refId(2), "typography");
    project = claimTag(project, refId(3), "spacing");
    project = claimTag(project, refId(3), "layout");
    expect(owners(project)).toEqual({
      colors: "1",
      typography: "2",
      spacing: "3",
      shape: "1",
      layout: "3",
    });
    for (const tag of BORROW_TAGS) {
      expect(project.references.filter((ref) => ref.borrowed.includes(tag))).toHaveLength(1);
    }
  });

  it("claiming a tag a reference already owns changes nothing", () => {
    const project = withRefs("light-saas", "warm-editorial");
    expect(claimTag(project, refId(1), "colors")).toEqual(project);
  });

  it("gives a removed reference's tags back to the first remaining one", () => {
    let project = withRefs("light-saas", "warm-editorial", "dark-dev-tool");
    project = claimTag(project, refId(3), "colors");
    project = removeReference(project, refId(3));
    expect(owners(project).colors).toBe("1");
    project = claimTag(project, refId(2), "shape");
    project = removeReference(project, refId(1));
    expect(project.references[0]?.borrowed).toEqual(BORROW_TAGS);
  });

  it("clears the result and locks when the last reference goes", () => {
    let project = toggleLock(withRefs("light-saas"), "color.light.primary");
    project = { ...project, result: fixtureSystem("light-saas") };
    project = removeReference(project, refId(1));
    expect(project.references).toEqual([]);
    expect(project.locks).toEqual([]);
    expect(project.result).toBeUndefined();
  });

  it("refuses a 6th reference and a duplicate", () => {
    const five = withRefs("light-saas", "warm-editorial", "dark-dev-tool", "stripe", "linear");
    expect(addReference(five, update(6, "cal-com"))).toEqual({ ok: false, reason: "full" });
    expect(addReference(five, update(1, "light-saas"))).toEqual({ ok: false, reason: "duplicate" });
  });
});

describe("references", () => {
  it("merges status updates and keeps borrow tags", () => {
    let project = newProject(ID, "x");
    const added = addReference(project, update(1, "light-saas", false));
    if (!added.ok) throw new Error("not added");
    project = added.project;
    expect(project.references[0]).toMatchObject({ status: "running", stage: "reading" });
    project = updateReference(project, update(1, "light-saas"));
    expect(project.references[0]).toMatchObject({ status: "done", borrowed: BORROW_TAGS });
    expect(project.references[0]).not.toHaveProperty("stage");
    expect(project.references[0]?.extracted?.meta.name).toBe("light-saas.test");
  });

  it("sends only finished references to the blend", () => {
    let project = withRefs("light-saas");
    const pending = addReference(project, update(2, "warm-editorial", false));
    if (!pending.ok) throw new Error("not added");
    project = pending.project;
    const body = blendRequest(project);
    expect(body.project.references.map((ref) => ref.id)).toEqual([refId(1)]);
    expect(body.project.id).toBe(ID);
  });
});

describe("locks and swaps", () => {
  const base = (): WorkspaceProject => ({
    ...withRefs("light-saas", "warm-editorial"),
    result: fixtureSystem("light-saas"),
  });

  it("locks and unlocks a token path", () => {
    let project = toggleLock(base(), "radius.md");
    expect(project.locks).toEqual(["radius.md"]);
    project = toggleLock(project, "radius.md");
    expect(project.locks).toEqual([]);
  });

  it("offers the other references' values, and swapping takes one and locks it", () => {
    let project = base();
    const path = "typography.families.sans";
    const candidates = swapCandidates(project, path);
    expect(candidates).toEqual([
      {
        refId: refId(2),
        host: "warm-editorial.test",
        value: fixtureSystem("warm-editorial").typography.families.sans,
      },
    ]);
    const before = blendKey(project);
    const value = candidates[0]?.value ?? "";
    project = swapToken(project, path, value);
    expect(project.result?.typography.families.sans).toBe(value);
    expect(project.locks).toEqual([path]);
    expect(blendKey(project)).not.toBe(before);
    // Now the first reference's own font is the one offered back.
    expect(swapCandidates(project, path).map((c) => c.refId)).toEqual([refId(1)]);
  });

  it("names the lock an unresolved pair is blocked by: its foreground", () => {
    expect(
      pairLockPath({
        theme: "dark",
        pair: ["primary", "canvas"],
        ratio: 2,
        min: 3,
        reason: "locked",
      }),
    ).toBe("color.dark.primary");
  });
});

describe("saved in the browser", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      data,
    };
  };

  it("round-trips a project (without the report)", () => {
    const storage = memory();
    const project = {
      ...withRefs("light-saas"),
      result: fixtureSystem("light-saas"),
      report: { generated: null, unresolved: [], lockedClashes: [], ignoredLocks: [] },
    };
    expect(saveProject(storage, project)).toBe(true);
    const loaded = loadProject(storage);
    expect(loaded?.references[0]?.extracted).toEqual(project.references[0]?.extracted);
    expect(loaded?.result).toEqual(project.result);
    expect(loaded).not.toHaveProperty("report");
  });

  it("returns null for nothing saved, broken JSON or a tampered project", () => {
    const storage = memory();
    expect(loadProject(storage)).toBeNull();
    storage.data.set(STORAGE_KEY, "{not json");
    expect(loadProject(storage)).toBeNull();
    const tampered = withRefs("light-saas");
    const extracted = tampered.references[0]?.extracted;
    if (!extracted) throw new Error("no system");
    extracted.typography.families.sans = "Inter</style>";
    storage.data.set(STORAGE_KEY, JSON.stringify(tampered));
    expect(loadProject(storage)).toBeNull();
  });

  it("survives blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadProject(blocked)).toBeNull();
    expect(saveProject(blocked, withRefs())).toBe(false);
    expect(loadProject(undefined)).toBeNull();
  });
});
