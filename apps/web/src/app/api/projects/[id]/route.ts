import { z } from "zod";
import { dropUnusedScreenshots, keepScreenshots, requireAccount } from "@/server/accounts";
import { ApiError, handler, json, readJson, type IdParams } from "@/server/http";
import { projectDataSchema } from "@/server/project-schema";
import { projectId } from "@/server/schemas";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

const saveBody = z.object({ project: projectDataSchema, baseVersion: z.int().min(1) });

/** Someone else's project answers like a missing one, so ids can't be probed. */
const notFound = () => new ApiError(404, "not-found", "No such project.");

async function idOf(params: IdParams["params"]) {
  const { id } = await params;
  if (!projectId.safeParse(id).success) throw notFound();
  return id;
}

/** GET /api/projects/:id: one saved project of the signed-in account. */
export const GET = handler(async (request: Request, { params }: IdParams) => {
  const id = await idOf(params);
  const { accounts, account } = await requireAccount(await getServices(), request);
  const stored = await accounts.projects.get(account.userId, id);
  if (!stored) throw notFound();
  return json({ project: stored.data, version: stored.version, updatedAt: stored.updatedAt });
});

/**
 * PUT /api/projects/:id { project, baseVersion }: save, if baseVersion is still the current
 * version. Otherwise 409: the project changed in another tab or device since this one loaded it.
 */
export const PUT = handler(async (request: Request, { params }: IdParams) => {
  const id = await idOf(params);
  const services = await getServices();
  const { accounts, account } = await requireAccount(services, request);
  const { project, baseVersion } = await readJson(request, saveBody);
  const result = await accounts.projects.save(account.userId, id, project, baseVersion);
  if (result.status === "missing") throw notFound();
  if (result.status === "conflict") {
    throw new ApiError(
      409,
      "conflict",
      "This project changed in another tab or device. Reload it to get the latest version.",
      {},
      { version: result.version },
    );
  }
  await keepScreenshots(project, services.queue, services.screenshots);
  return json({ version: result.version, updatedAt: result.updatedAt });
});

/** DELETE /api/projects/:id: delete a saved project, and screenshots no other project uses. */
export const DELETE = handler(async (request: Request, { params }: IdParams) => {
  const id = await idOf(params);
  const services = await getServices();
  const { accounts, account } = await requireAccount(services, request);
  const removed = await accounts.projects.remove(account.userId, id);
  if (!removed) throw notFound();
  await dropUnusedScreenshots(removed, accounts, services.screenshots);
  return json({ deleted: id });
});
