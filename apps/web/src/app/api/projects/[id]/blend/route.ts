import { blend, fix } from "@thema/engine";
import { ApiError, handler, json, readJson, type IdParams } from "@/server/http";
import { blendBody } from "@/server/schemas";
import { getServices } from "@/server/services";
import { recordSafely } from "@/server/stats";

export const runtime = "nodejs";

const DEFAULT_NAME = "Untitled system";

/**
 * PATCH /api/projects/:id/blend { project, locks, name? }: borrow tags, sliders and locks →
 * blend → fix → the new ThemaSystem. Synchronous and in-process (SPEC: under 200 ms).
 *
 * The project comes from the browser (anonymous projects aren't stored): each reference carries
 * its extracted system, and `project.result` (the last blend) is where locked values come from.
 */
export const PATCH = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  const { project, locks, name } = await readJson(request, blendBody);
  if (project.id !== id) {
    throw new ApiError(400, "project-mismatch", "The body's project.id doesn't match the URL.");
  }
  const notReady = project.references.filter((reference) => !reference.extracted);
  if (notReady.length > 0) {
    throw new ApiError(
      400,
      "reference-not-ready",
      `Not extracted yet: ${notReady.map((reference) => reference.url).join(", ")}. Blend the finished references, or wait for these.`,
    );
  }
  const { now, stats } = await getServices();

  const blended = blend({
    references: project.references.flatMap(({ extracted, borrowed }) =>
      extracted ? [{ system: extracted, borrowed }] : [],
    ),
    settings: project.blend,
    locks,
    ...(project.result ? { previous: project.result } : {}),
    name: name ?? project.result?.meta.name ?? DEFAULT_NAME,
    createdAt: now().toISOString(),
  });
  const fixed = fix(blended.system);
  await recordSafely(stats, "blend", id);

  return json({
    system: fixed.system,
    /** The theme the fixer generated because no reference had one, if any. */
    generated: fixed.generated,
    /** Pairs still below WCAG AA, with why ("locked" or "out-of-range"). */
    unresolved: fixed.unresolved,
    /** Colors harmonize moved away from a clashing canvas. */
    adjustments: blended.adjustments,
    lockedClashes: blended.lockedClashes,
    ignoredLocks: blended.ignoredLocks,
  });
});
