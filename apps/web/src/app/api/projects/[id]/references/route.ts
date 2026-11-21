import { assertPublicUrl, BlockedUrlError, normalizeUrl } from "@thema/url-guard";
import { optionalAccount } from "@/server/accounts";
import { clientId } from "@/server/client-id";
import { ApiError, handler, json, readJson, type IdParams } from "@/server/http";
import { referenceView } from "@/server/references";
import { PLANS } from "@/server/plans";
import { addReferenceBody, projectId } from "@/server/schemas";
import { getServices } from "@/server/services";
import { recordSafely } from "@/server/stats";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/references { url, borrowed }: start (or reuse) the extraction of a URL.
 *
 * Order: validate → SSRF guard with DNS (before anything is enqueued) → today's cached job for
 * the URL (free) → the daily limit (per IP when signed out, per account and plan when signed
 * in) → enqueue. Returns the reference with its status;
 * poll GET /api/references/:id until it's done.
 */
export const POST = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) {
    throw new ApiError(404, "not-found", "No such project.");
  }
  const body = await readJson(request, addReferenceBody);
  const services = await getServices();
  const { queue, limiter, lookup, dailyLimit, now } = services;

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

  const account = await optionalAccount(services, request);
  const plan = account ? PLANS[account.plan] : null;
  const decision = account
    ? await limiter.consume(`user:${account.userId}`, plan?.dailyExtractions)
    : await limiter.consume(clientId(request));
  if (!decision.allowed) {
    const seconds = Math.max(1, Math.ceil((decision.resetAt.getTime() - now().getTime()) / 1000));
    const who = plan
      ? `${plan.label} accounts get ${plan.dailyExtractions}`
      : `Without an account you get ${dailyLimit}; sign in for more`;
    throw new ApiError(
      429,
      "rate-limited",
      `${who} new extractions a day. Sites already extracted today still work. The limit resets at ${decision.resetAt.toISOString()}.`,
      { "retry-after": String(seconds) },
    );
  }

  const job = await queue.submit(url);
  // A new extraction (cache hits returned above aren't counted).
  await recordSafely(services.stats, "extraction");
  return json(
    {
      reference: { ...referenceView(job), borrowed: body.borrowed },
      cached: false,
      limit: { remaining: decision.remaining, resetAt: decision.resetAt.toISOString() },
    },
    { status: 202 },
  );
});
