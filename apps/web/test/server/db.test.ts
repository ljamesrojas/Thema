// @vitest-environment node
import { getSchema } from "better-auth/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate, readMigrations } from "@/server/db";
import { authOptions } from "@/server/auth";
import { testDb } from "./pglite";

let db: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  db = await testDb();
});
afterAll(() => db.close());

const PG_TYPE = {
  string: "text",
  boolean: "boolean",
  date: "timestamp with time zone",
  number: "integer",
} as const;

describe("migrations", () => {
  it("apply in order once, and a second run applies nothing", async () => {
    const { rows } = await db.query<{ name: string }>(
      `SELECT "name" FROM "schema_migrations" ORDER BY "name"`,
    );
    expect(rows.map((r) => r.name)).toEqual(readMigrations().map((m) => m.name));
    expect(await migrate(db)).toEqual([]);
  });

  it("roll back a failing migration completely", async () => {
    await expect(
      migrate(db, [{ name: "9999_bad.sql", sql: `CREATE TABLE "half" ("a" int); SELECT nope;` }]),
    ).rejects.toThrow(/9999_bad\.sql failed/);
    const { rows } = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'half'`,
    );
    expect(rows).toEqual([]);
  });

  it("create every table and column Better Auth uses, with matching types and nullability", async () => {
    const schema = getSchema(authOptions({ secret: "x".repeat(32), baseURL: "http://localhost" }));
    for (const [table, definition] of Object.entries(schema)) {
      const { rows } = await db.query<{
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
      }>(
        `SELECT "column_name", "data_type", "is_nullable" FROM information_schema.columns WHERE "table_name" = $1`,
        [table],
      );
      const columns = new Map(rows.map((row) => [row.column_name, row]));
      expect(columns.get("id")?.data_type, `${table}.id`).toBe("text");
      for (const [key, field] of Object.entries(definition.fields)) {
        const column = columns.get(field.fieldName ?? key);
        expect(column, `${table}.${key}`).toBeDefined();
        expect(column?.data_type, `${table}.${key}`).toBe(
          PG_TYPE[field.type as keyof typeof PG_TYPE],
        );
        expect(column?.is_nullable, `${table}.${key}`).toBe(
          field.required === false ? "YES" : "NO",
        );
      }
    }
  });
});
