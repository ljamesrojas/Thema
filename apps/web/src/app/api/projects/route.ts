import { randomUUID } from "node:crypto";
import { z } from "zod";
import { keepScreenshots, requireAccount } from "@/server/accounts";
import { ApiError, handler, json, readJson } from "@/server/http";
import { PLANS } from "@/server/plans";
import { projectDataSchema } from "@/server/project-schema";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

const claimBody = z.object({ project: projectDataSchema });

/** GET /api/projects: the signed-in account's saved projects, most recently edited first. */
export const GET = handler(async (request: Request) => {
  const services = await getServices();
  const { accounts, account } = await requireAccount(services, request);
  return json({ projects: await accounts.projects.list(account.userId) });
});

/**
 * POST /api/projects
 * - No body: a new, empty project that lives in the browser. Nothing is stored (SPEC: anonymous
 *   projects live in the browser); a signed-in browser claims it with its first reference.
 * - { project } while signed in: save it to the account (claiming the browser's project).
 *   Claiming the same project twice saves it once; it keeps its id unless another account
 *   already uses it. Refused past the plan's saved-project limit.
 */
export const POST = handler(async (request: Request) => {
  const services = await getServices();
  const hasBody = (await request.clone().text()).trim() !== "";
  if (!hasBody) {
    return json(
      {
        project: {
          id: randomUUID(),
          references: [],
          blend: { density: 0, roundness: 0, contrast: 0, warmth: 0 },
          updatedAt: services.now().toISOString(),
        },
      },
      { status: 201 },
    );
  }

  const { accounts, account } = await requireAccount(services, request);
  const { project } = await readJson(request, claimBody);
  const existing = await accounts.projects.get(account.userId, project.id);
  if (existing) {
    return json({ status: "exists", project: { id: project.id, version: existing.version } });
  }
  const plan = PLANS[account.plan];
  if ((await accounts.projects.count(account.userId)) >= plan.savedProjects) {
    throw new ApiError(
      403,
      "project-limit",
      `${plan.label} accounts keep ${plan.savedProjects} projects. Delete one on the Projects screen to save this one.`,
    );
  }
  const created = await accounts.projects.create(account.userId, project, randomUUID);
  await keepScreenshots(project, services.queue, services.screenshots);
  return json(
    { status: created.status, project: { id: created.id, version: created.version } },
    { status: created.status === "created" ? 201 : 200 },
  );
});
