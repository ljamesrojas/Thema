// @vitest-environment node
// Better Auth on the migrated tables (PGlite behind a pg-style pool): a real session cookie is
// read back as an Account, with the Pro flag from the database. Email sign-up is enabled only
// here, to get a session without a GitHub/Google round trip; production uses OAuth only.
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { authConfigFromEnv, createAuth, providersOf, sessionReader } from "@/server/auth";
import { migrate } from "@/server/db";
import { pgliteDb } from "./pglite";

const pg = new PGlite();
const db = pgliteDb(pg);
await migrate(db);
afterAll(() => pg.close());

/** Just enough of pg's Pool for Better Auth's Kysely adapter. */
const client = {
  query: async (text: string, params: unknown[] = []) => {
    const result = await pg.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
      command: text.trim().split(/\s+/)[0]?.toUpperCase() ?? "",
    };
  },
  release: () => undefined,
};
const pool = { connect: () => Promise.resolve(client), end: () => Promise.resolve() };

/** Sign-ups the hook reported (the anonymous sign-up total). */
let signups = 0;

const auth = createAuth(
  pool as unknown as Pool,
  {
    secret: "s".repeat(40),
    baseURL: "http://localhost:3000",
    github: { clientId: "id", clientSecret: "secret" },
  },
  { emailAndPassword: { enabled: true } },
  () => {
    signups += 1;
    return Promise.resolve();
  },
);

describe("Better Auth on Thema's tables", () => {
  it("signs up, reads the session back as an account, and follows the Pro flag", async () => {
    const response = await auth.api.signUpEmail({
      body: { name: "Ana", email: "ana@example.com", password: "a long test password" },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const cookie = (response.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    const request = new Request("http://localhost:3000/api/account", { headers: { cookie } });
    const read = sessionReader(auth);

    const account = await read(request);
    expect(account).toMatchObject({ name: "Ana", email: "ana@example.com", plan: "free" });
    expect(signups).toBe(1);

    await db.query(`UPDATE "user" SET "plan" = 'pro' WHERE "email" = $1`, ["ana@example.com"]);
    expect((await read(request))?.plan).toBe("pro");
    expect(await read(new Request("http://localhost:3000/api/account"))).toBeNull();
  });

  it("can't set its own plan when signing up", async () => {
    await auth.api
      .signUpEmail({
        body: {
          name: "Ben",
          email: "ben@example.com",
          password: "a long test password",
          plan: "pro",
        } as never,
      })
      .catch(() => undefined);
    const { rows } = await db.query<{ plan: string }>(
      `SELECT "plan" FROM "user" WHERE "email" = $1`,
      ["ben@example.com"],
    );
    expect(rows.every((row) => row.plan === "free")).toBe(true);
  });
});

describe("sign-in settings from the environment", () => {
  const base = { DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "s".repeat(32) };
  it("need a database, a 32+ character secret and at least one provider", () => {
    expect(authConfigFromEnv({ ...base })).toBeNull();
    expect(
      authConfigFromEnv({
        ...base,
        BETTER_AUTH_SECRET: "short",
        GITHUB_CLIENT_ID: "a",
        GITHUB_CLIENT_SECRET: "b",
      }),
    ).toBeNull();
    const config = authConfigFromEnv({ ...base, GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" });
    expect(config && providersOf(config)).toEqual(["google"]);
  });
});
