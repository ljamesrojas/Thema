// A real Postgres for tests (PGlite: Postgres compiled to WebAssembly, in-process), migrated.
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Db } from "@/server/db";

export async function testDb(): Promise<Db & { close: () => Promise<void> }> {
  const pg = new PGlite();
  const db: Db = {
    query: async <R extends object>(text: string, params: unknown[] = []) => {
      const result = await pg.query<R>(text, params);
      return { rows: result.rows };
    },
    exec: (sql) => pg.exec(sql),
  };
  await migrate(db);
  return { ...db, close: () => pg.close() };
}

/** A user row, as Better Auth would create it on first sign-in. */
export async function insertUser(db: Db, id: string, plan: "free" | "pro" = "free") {
  await db.query(`INSERT INTO "user" ("id", "name", "email", "plan") VALUES ($1, $2, $3, $4)`, [
    id,
    `User ${id}`,
    `${id}@example.com`,
    plan,
  ]);
}
