// @vitest-environment node
import { CHECKED_PAIRS, type ThemaSystem, type UnresolvedPair } from "@thema/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as blendRoute } from "@/app/api/projects/[id]/blend/route";
import { setServices } from "@/server/services";
import { call, errorCode, fixtureSystem, PROJECT_ID, useFakeServices } from "./helpers";

interface BlendResponse {
  system: ThemaSystem;
  generated: "light" | "dark" | null;
  unresolved: UnresolvedPair[];
  adjustments: unknown[];
  lockedClashes: string[];
  ignoredLocks: string[];
}

const SETTINGS = { density: 0, roundness: 0, contrast: 0, warmth: 0 };

const reference = (name: string, id: string, borrowed: string[]) => ({
  id,
  url: `https://${name}.test/`,
  status: "done",
  borrowed,
  extracted: fixtureSystem(name),
});

const patch = (body: unknown, id = PROJECT_ID) =>
  call(blendRoute, { method: "PATCH", path: `/api/projects/${id}/blend`, id, body });

beforeEach(() => {
  useFakeServices();
});
afterEach(() => setServices(undefined));

describe("PATCH /api/projects/:id/blend", () => {
  const references = [
    reference("light-saas", "a".repeat(24), ["colors", "shape"]),
    reference("warm-editorial", "b".repeat(24), ["typography"]),
    reference("dark-dev-tool", "c".repeat(24), ["spacing", "layout"]),
  ];

  it("blends, fixes and returns the system with the fixer's report", async () => {
    const response = await patch({
      project: { id: PROJECT_ID, references, blend: SETTINGS },
      name: "Hero blend",
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as BlendResponse;
    expect(data.system.meta.name).toBe("Hero blend");
    expect(data.system.meta.sources.map((s) => s.borrowed)).toEqual([
      ["colors", "shape"],
      ["typography"],
      ["spacing", "layout"],
    ]);
    expect(data.system.typography.families).toEqual(references[1]?.extracted.typography.families);
    expect(data.system.a11y.passes).toBe(true);
    expect(data.unresolved).toEqual([]);
    expect(data.generated).toBe("dark"); // no reference had a dark recording
  });

  it("keeps a locked token from the previous result and reports the pair it blocks", async () => {
    const first = (await (
      await patch({ project: { id: PROJECT_ID, references, blend: SETTINGS } })
    ).json()) as BlendResponse;
    // The user locks a pale yellow primary: below 3:1 on a light canvas.
    const previous = structuredClone(first.system);
    previous.color.light.primary = "oklch(0.95 0.12 100)";

    const response = await patch({
      project: { id: PROJECT_ID, references, blend: SETTINGS, result: previous },
      locks: ["color.light.primary"],
    });
    const data = (await response.json()) as BlendResponse;
    expect(data.system.color.light.primary).toBe("oklch(0.95 0.12 100)");
    expect(data.system.locks).toEqual(["color.light.primary"]);
    expect(data.unresolved).toContainEqual(
      expect.objectContaining({ theme: "light", pair: ["primary", "canvas"], reason: "locked" }),
    );
    expect(data.system.a11y.passes).toBe(false);
  });

  it("reports locks that don't name a token", async () => {
    const data = (await (
      await patch({
        project: { id: PROJECT_ID, references, blend: SETTINGS },
        locks: ["color.light.nope"],
      })
    ).json()) as BlendResponse;
    expect(data.ignoredLocks).toEqual(["color.light.nope"]);
  });

  it("refuses a mismatched project id, missing systems and out-of-range sliders", async () => {
    const other = "11111111-2222-4333-8444-555555555555";
    expect(
      await errorCode(await patch({ project: { id: other, references, blend: SETTINGS } })),
    ).toBe("project-mismatch");

    const loading = {
      id: "d".repeat(24),
      url: "https://slow.test/",
      status: "running",
      borrowed: [],
    };
    const notReady = await patch({
      project: { id: PROJECT_ID, references: [...references, loading], blend: SETTINGS },
    });
    expect(await errorCode(notReady)).toBe("reference-not-ready");

    const tooFar = await patch({
      project: { id: PROJECT_ID, references, blend: { ...SETTINGS, density: 2 } },
    });
    expect(await errorCode(tooFar)).toBe("invalid-body");

    const six = Array.from({ length: 6 }, (_, i) =>
      reference("light-saas", String(i).repeat(24), []),
    );
    expect(
      await errorCode(
        await patch({ project: { id: PROJECT_ID, references: six, blend: SETTINGS } }),
      ),
    ).toBe("invalid-body");
  });

  it("refuses a tampered system (a color that isn't OKLCH, markup in a font name)", async () => {
    const bad = structuredClone(references);
    const first = bad[0];
    if (!first) throw new Error("no reference");
    first.extracted.color.light.primary = "red";
    expect(
      await errorCode(
        await patch({ project: { id: PROJECT_ID, references: bad, blend: SETTINGS } }),
      ),
    ).toBe("invalid-body");

    const markup = structuredClone(references);
    const second = markup[1];
    if (!second) throw new Error("no reference");
    second.extracted.typography.families.sans = "Inter</style><script>";
    expect(
      await errorCode(
        await patch({ project: { id: PROJECT_ID, references: markup, blend: SETTINGS } }),
      ),
    ).toBe("invalid-body");
  });
});

describe("blend timing", () => {
  it("answers a 5-reference project in under 200 ms (median of 10 after warm-up)", async () => {
    const five = [
      reference("light-saas", "a".repeat(24), ["colors"]),
      reference("warm-editorial", "b".repeat(24), ["typography"]),
      reference("dark-dev-tool", "c".repeat(24), ["spacing"]),
      reference("stripe", "d".repeat(24), ["shape"]),
      reference("cal-com", "e".repeat(24), ["layout"]),
    ];
    const body = JSON.stringify({
      project: {
        id: PROJECT_ID,
        references: five,
        blend: { ...SETTINGS, density: 0.4, warmth: -0.3 },
      },
      locks: [],
    });
    let previous: ThemaSystem | undefined;
    const run = async () => {
      const started = performance.now();
      const response = await patch(body);
      const data = (await response.json()) as BlendResponse;
      const elapsed = performance.now() - started;
      expect(response.status).toBe(200);
      previous = data.system;
      return elapsed;
    };
    for (let i = 0; i < 3; i += 1) await run();
    const times: number[] = [];
    for (let i = 0; i < 10; i += 1) times.push(await run());
    times.sort((a, b) => a - b);
    const median = ((times[4] ?? 0) + (times[5] ?? 0)) / 2;
    expect(median).toBeLessThan(200);
    expect(previous?.meta.sources).toHaveLength(5);
    // Every checked pair passes in both themes.
    expect(previous?.a11y.passes).toBe(true);
    expect(CHECKED_PAIRS.length).toBeGreaterThan(0);
  });
});
