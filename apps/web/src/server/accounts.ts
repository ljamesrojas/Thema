// Helpers for the routes behind sign-in: who's asking, plan limits, and keeping saved projects'
// screenshots after the job queue drops them (24 h).
import type { ExtractionQueue } from "@thema/jobs";
import type { Account } from "./auth";
import { ApiError } from "./http";
import type { ProjectData } from "./project-schema";
import type { ScreenshotStore } from "./screenshot-store";
import type { Accounts, Services } from "./services";

/** The signed-in account, or 401 (404 when this server has no accounts at all). */
export async function requireAccount(
  services: Services,
  request: Request,
): Promise<{ accounts: Accounts; account: Account }> {
  const { accounts } = services;
  if (!accounts) {
    throw new ApiError(404, "accounts-off", "Accounts aren't set up on this server.");
  }
  const account = await accounts.session(request);
  if (!account) throw new ApiError(401, "sign-in-required", "Sign in to use saved projects.");
  return { accounts, account };
}

/** The signed-in account if there is one; never throws for signed-out requests. */
export async function optionalAccount(services: Services, request: Request) {
  return services.accounts ? services.accounts.session(request) : null;
}

/**
 * Copy finished references' screenshots from the queue into storage, so a saved project keeps
 * them. Best effort: a storage outage mustn't fail the save, the card then shows no picture.
 */
export async function keepScreenshots(
  data: ProjectData,
  queue: ExtractionQueue,
  screenshots: ScreenshotStore,
): Promise<void> {
  for (const ref of data.references) {
    if (ref.status !== "done") continue;
    try {
      if (await screenshots.has(ref.id)) continue;
      const png = await queue.screenshot(ref.id);
      if (png) await screenshots.put(ref.id, png);
    } catch (error) {
      console.error(`Couldn't keep the screenshot of ${ref.id}:`, error);
    }
  }
}

/** After a delete: drop screenshots no saved project uses anymore. */
export async function dropUnusedScreenshots(
  data: ProjectData,
  accounts: Accounts,
  screenshots: ScreenshotStore,
): Promise<void> {
  for (const ref of data.references) {
    try {
      if (!(await accounts.projects.hasReference(ref.id))) await screenshots.remove(ref.id);
    } catch (error) {
      console.error(`Couldn't remove the screenshot of ${ref.id}:`, error);
    }
  }
}
