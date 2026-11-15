import { optionalAccount } from "@/server/accounts";
import { ApiError, handler, type IdParams } from "@/server/http";
import { referenceId } from "@/server/schemas";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/**
 * GET /api/references/:id/screenshot: the full-page PNG of a finished extraction. From the
 * queue for 24 hours; after that, from storage, for the account whose saved project has it.
 */
export const GET = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!referenceId.safeParse(id).success) throw notFound();
  const services = await getServices();
  let png = await services.queue.screenshot(id);
  if (!png && services.accounts) {
    const account = await optionalAccount(services, request);
    if (account && (await services.accounts.projects.hasReference(id, account.userId))) {
      png = await services.screenshots.get(id);
    }
  }
  if (!png) throw notFound();
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // Results for a URL don't change within the day; the browser may keep it as long.
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
});

const notFound = () => new ApiError(404, "not-found", "No screenshot for this reference.");
