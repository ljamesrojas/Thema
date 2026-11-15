import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Better Auth's routes: sign-in with GitHub or Google, callbacks, session, sign-out. */
async function auth(request: Request): Promise<Response> {
  const { accounts } = await getServices();
  if (!accounts) {
    return Response.json(
      { error: { code: "accounts-off", message: "Accounts aren't set up on this server." } },
      { status: 404 },
    );
  }
  return accounts.handler(request);
}

export const GET = auth;
export const POST = auth;
