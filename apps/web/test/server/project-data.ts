// A saved project's data for tests: one light-saas reference, blended and fixed.
import { fix } from "@thema/engine";
import type { ProjectData } from "@/server/project-schema";
import { fixtureSystem } from "../api/helpers";

export const ID = "6f1c1b2e-3d4a-4b5c-8d6e-7f8091a2b3c4";
export const OTHER_ID = "0d9c8b7a-6f5e-4d3c-8b2a-190807060504";
let n = 0;
export const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function projectData(overrides: Partial<ProjectData> = {}): ProjectData {
  const system = fixtureSystem("light-saas");
  return {
    id: ID,
    name: "Untitled system",
    references: [
      {
        id: "a".repeat(24),
        url: "https://light-saas.test/",
        status: "done",
        borrowed: ["colors", "typography", "spacing", "shape", "layout"],
        extracted: system,
        warnings: [],
        screenshot: `/api/references/${"a".repeat(24)}/screenshot`,
      },
    ],
    blend: { density: 0, roundness: 0, contrast: 0, warmth: 0 },
    locks: [],
    result: fix(system).system,
    revision: 0,
    updatedAt: "2026-11-15T00:00:00.000Z",
    ...overrides,
  };
}
