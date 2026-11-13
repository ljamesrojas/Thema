import { assertPublicUrl, BlockedUrlError, normalizeUrl } from "@thema/url-guard";
import { clientId } from "@/server/client-id";
import { ApiError, handler, json, readJson, type IdParams } from "@/server/http";
import { referenceView } from "@/server/references";
import { addReferenceBody, projectId } from "@/server/schemas";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/references { url, borrowed }: start (or reuse) the extraction of a URL.
 *
 * Order: validate → SSRF guard with DNS (before anything is enqueued) → today's cached job for
 * the URL (free) → the anonymous daily limit → enqueue. Returns the reference with its status;
 * poll GET /api/references/:id until it's done.
 */
export const POST = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) {
    throw new ApiError(404, "not-found", "No such project.");
  }
  const body = await readJson(request, addReferenceBody);
  const { queue, limiter, lookup, dailyLimit, now } = await getServices();

  let url: string;
  try {
    url = (await assertPublicUrl(normalizeUrl(body.url), lookup)).href;
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      throw new ApiError(400, "blocked-url", error.message);
    }
    throw error;
  }

  const cached = await queue.find(url);
  if (cached) {
    return json(
      { reference: { ...referenceView(cached), borrowed: body.borrowed }, cached: true },
      { status: cached.status === "done" ? 200 : 202 },
    );
  }

  const decision = await limiter.consume(clientId(request));
  if (!decision.allowed) {
    const seconds = Math.max(1, Math.ceil((decision.resetAt.getTime() - now().getTime()) / 1000));
    throw new ApiError(
      429,
      "rate-limited",
      `Anonymous use is limited to ${dailyLimit} new extractions a day. Sites already extracted today still work. The limit resets at ${decision.resetAt.toISOString()}.`,
      { "retry-after": String(seconds) },
    );
  }

  const job = await queue.submit(url);
  return json(
    {
      reference: { ...referenceView(job), borrowed: body.borrowed },
      cached: false,
      limit: { remaining: decision.remaining, resetAt: decision.resetAt.toISOString() },
    },
    { status: 202 },
  );
});
