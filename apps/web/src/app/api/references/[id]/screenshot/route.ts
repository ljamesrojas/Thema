import { ApiError, handler, type IdParams } from "@/server/http";
import { referenceId } from "@/server/schemas";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** GET /api/references/:id/screenshot: the full-page PNG of a finished extraction. */
export const GET = handler(async (_request: Request, { params }: IdParams) => {
  const { id } = await params;
  const { queue } = await getServices();
  const png = referenceId.safeParse(id).success ? await queue.screenshot(id) : null;
  if (!png) throw new ApiError(404, "not-found", "No screenshot for this reference.");
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // Results for a URL don't change within the day; the browser may keep it as long.
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
});
