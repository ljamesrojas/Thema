// Postgres for accounts and saved projects (Neon in production, any Postgres works). Code talks
// to the small `Db` interface, which a `pg` pool and, in tests, PGlite both satisfy.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

export interface Db {
  /** One statement with $1… parameters. */
  query<R extends object = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>;
  /** Several statements, no parameters (migrations). */
  exec(sql: string): Promise<unknown>;
}

/** A `pg` pool as a Db. Statements without parameters run as one simple query. */
export function poolDb(pool: Pool): Db {
  return {
    query: async <R extends object>(text: string, params: unknown[] = []) => {
      const result = await pool.query(text, params);
      return { rows: result.rows as R[] };
    },
    exec: (sql) => pool.query(sql),
  };
}

export interface Migration {
  name: string;
  sql: string;
}

/** apps/web/db/migrations/*.sql, in name order. */
export const MIGRATIONS_DIR = join(import.meta.dirname, "../../db/migrations");

export function readMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}

/**
 * Apply the migrations not applied yet, each in its own transaction, and record them in
 * `schema_migrations`. Returns the names applied this time.
 */
export async function migrate(db: Db, migrations: Migration[] = readMigrations()) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS "schema_migrations" ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())`,
  );
  const { rows } = await db.query<{ name: string }>(`SELECT "name" FROM "schema_migrations"`);
  const done = new Set(rows.map((row) => row.name));
  const applied: string[] = [];
  for (const { name, sql } of migrations) {
    if (done.has(name)) continue;
    if (!/^[\w.-]+$/.test(name)) throw new Error(`migrate: bad migration name ${name}`);
    try {
      await db.exec(
        `BEGIN;\n${sql}\nINSERT INTO "schema_migrations" ("name") VALUES ('${name}');\nCOMMIT;`,
      );
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      throw new Error(`migrate: ${name} failed: ${(error as Error).message}`, { cause: error });
    }
    applied.push(name);
  }
  return applied;
}
