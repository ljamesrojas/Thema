import { optionalAccount } from "@/server/accounts";
import { handler, json } from "@/server/http";
import { PLANS } from "@/server/plans";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/**
 * GET /api/account: whether accounts are on, which sign-in buttons to show, and the signed-in
 * account with its plan's limits (savedProjects null = unlimited).
 */
export const GET = handler(async (request: Request) => {
  const services = await getServices();
  const account = await optionalAccount(services, request);
  if (!services.accounts || !account) {
    return json({
      enabled: services.accounts !== null,
      providers: services.accounts?.providers ?? [],
      account: null,
      limits: { dailyExtractions: services.dailyLimit },
    });
  }
  const plan = PLANS[account.plan];
  return json({
    enabled: true,
    providers: services.accounts.providers,
    account: {
      userId: account.userId,
      name: account.name,
      email: account.email,
      image: account.image,
      plan: account.plan,
    },
    limits: {
      dailyExtractions: plan.dailyExtractions,
      savedProjects: Number.isFinite(plan.savedProjects) ? plan.savedProjects : null,
      saved: await services.accounts.projects.count(account.userId),
    },
  });
});
