import { ApiError, handler, type IdParams } from "@/server/http";
import { projectId } from "@/server/schemas";
import { getServices } from "@/server/services";
import { recordSafely } from "@/server/stats";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/exported, no body: the Export screen made its files in the browser
 * (zip, a single file, a copy, thema.json). Counted in the anonymous daily totals by the
 * project's random id only, so "projects that reach an export" can be measured (SPEC).
 */
export const POST = handler(async (_request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) throw new ApiError(404, "not-found", "No such project.");
  await recordSafely((await getServices()).stats, "export", id);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
});
