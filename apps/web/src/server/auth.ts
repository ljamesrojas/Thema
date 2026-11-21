// Sign-in with Better Auth (GitHub and Google). It runs inside the app and keeps users and
// sessions in the same Postgres as saved projects; no passwords are stored.
import { betterAuth, type BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";
import { planOf, type Plan } from "./plans";

export type Provider = "github" | "google";

/** The signed-in person, as routes see them. */
export interface Account {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  plan: Plan;
}

export interface AuthConfig {
  secret: string;
  baseURL: string;
  github?: { clientId: string; clientSecret: string } | undefined;
  google?: { clientId: string; clientSecret: string } | undefined;
}

/** Better Auth's options without the database: also what the migration test checks against. */
export function authOptions(config: AuthConfig) {
  return {
    secret: config.secret,
    baseURL: config.baseURL,
    socialProviders: {
      ...(config.github ? { github: config.github } : {}),
      ...(config.google ? { google: config.google } : {}),
    },
    user: {
      additionalFields: {
        // The Pro flag: set by Thema (by hand until billing), never by the user.
        plan: { type: "string", required: true, defaultValue: "free", input: false },
      },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

/** Configured providers, in the order the sign-in page shows them. */
export const providersOf = (config: AuthConfig): Provider[] =>
  (["github", "google"] as const).filter((p) => config[p] !== undefined);

/**
 * Better Auth on this database. `extra` is for tests (e.g. email sign-up, to get a real session
 * without an OAuth round trip); production passes nothing.
 */
export function createAuth(
  pool: Pool,
  config: AuthConfig,
  extra: Partial<BetterAuthOptions> = {},
  /** Called once per new account (the anonymous sign-up total). */
  onSignup?: () => Promise<void>,
) {
  return betterAuth({
    ...authOptions(config),
    database: pool,
    databaseHooks: {
      user: {
        create: {
          after: async () => {
            await onSignup?.();
          },
        },
      },
    },
    ...extra,
  });
}

export type ThemaAuth = ReturnType<typeof createAuth>;

/** The signed-in account for a request, or null. */
export function sessionReader(auth: ThemaAuth) {
  return async (request: Request): Promise<Account | null> => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    const { user } = session;
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      plan: planOf("plan" in user ? user.plan : undefined),
    };
  };
}

/** Sign-in settings from the environment, or null when accounts aren't configured. */
export function authConfigFromEnv(env: Record<string, string | undefined>): AuthConfig | null {
  const secret = env.BETTER_AUTH_SECRET;
  if (!env.DATABASE_URL || !secret || secret.length < 32) return null;
  const pair = (id?: string, key?: string) =>
    id && key ? { clientId: id, clientSecret: key } : undefined;
  const config: AuthConfig = {
    secret,
    baseURL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
    github: pair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
    google: pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  };
  return providersOf(config).length > 0 ? config : null;
}
