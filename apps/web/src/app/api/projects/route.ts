import { randomUUID } from "node:crypto";
import { handler, json } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/**
 * POST /api/projects: a new, empty anonymous project. Nothing is stored: anonymous projects live
 * in the browser (SPEC), which sends the project back with each blend or export. There's no
 * `result` until the first blend.
 */
export const POST = handler(async () => {
  const { now } = await getServices();
  return json(
    {
      project: {
        id: randomUUID(),
        references: [],
        blend: { density: 0, roundness: 0, contrast: 0, warmth: 0 },
        updatedAt: now().toISOString(),
      },
    },
    { status: 201 },
  );
});
