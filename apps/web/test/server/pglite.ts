// A real Postgres for tests (PGlite: Postgres compiled to WebAssembly, in-process), migrated.
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { migrate, type Db } from "@/server/db";

/** PGlite (or one of its transactions) as a Db. */
export function pgliteDb(pg: PGlite | Transaction): Db {
  const db: Db = {
    query: async <R extends object>(text: string, params: unknown[] = []) => {
      const result = await pg.query<R>(text, params);
      return { rows: result.rows };
    },
    exec: (sql) => pg.exec(sql),
    transaction: (fn) => ("transaction" in pg ? pg.transaction((tx) => fn(pgliteDb(tx))) : fn(db)),
  };
  return db;
}

export async function testDb(): Promise<Db & { close: () => Promise<void> }> {
  const pg = new PGlite();
  const db = pgliteDb(pg);
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
