import { ApiError, handler, json, type IdParams } from "@/server/http";
import { referenceView } from "@/server/references";
import { referenceId } from "@/server/schemas";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** GET /api/references/:id: status, and once done the extracted system and its warnings. */
export const GET = handler(async (_request: Request, { params }: IdParams) => {
  const { id } = await params;
  const { queue } = await getServices();
  const job = referenceId.safeParse(id).success ? await queue.get(id) : null;
  if (!job) {
    throw new ApiError(
      404,
      "not-found",
      "No such reference. Extractions are kept for 24 hours; add the URL again.",
    );
  }
  return json({ reference: referenceView(job) });
});
