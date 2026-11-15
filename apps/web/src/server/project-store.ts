// Saved projects for signed-in users. Two implementations behind one interface, like the job
// queue: Postgres (DATABASE_URL) and in-memory (tests). Both pass test/server/project-store.test.ts.
import type { Db } from "./db";
import type { ProjectData } from "./project-schema";

/** A saved project as the Projects screen lists it, without the heavy systems. */
export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  /** The references' URLs, in order. */
  urls: string[];
  /** The last blend's light colors (OKLCH), for the palette strip; null before the first blend. */
  colors: Record<string, string> | null;
}

export interface StoredProject {
  data: ProjectData;
  version: number;
  updatedAt: string;
}

export type CreateResult =
  /** Saved under `id`: the project's own id, or a new one if another account already uses it. */
  | { status: "created"; id: string; version: number }
  /** This account already has the project (claiming twice saves it once). */
  | { status: "exists"; id: string; version: number };

export type SaveResult =
  | { status: "saved"; version: number; updatedAt: string }
  /** A newer save exists (another tab or device): `version` is the current one. */
  | { status: "conflict"; version: number }
  | { status: "missing" };

export interface ProjectStore {
  /** The owner's projects, most recently edited first. */
  list(ownerId: string): Promise<ProjectSummary[]>;
  count(ownerId: string): Promise<number>;
  get(ownerId: string, id: string): Promise<StoredProject | null>;
  create(ownerId: string, data: ProjectData, newId: () => string): Promise<CreateResult>;
  /** Replace the project if `baseVersion` is still the current version. */
  save(ownerId: string, id: string, data: ProjectData, baseVersion: number): Promise<SaveResult>;
  /** Delete it; returns what was deleted, or null if the owner has no such project. */
  remove(ownerId: string, id: string): Promise<ProjectData | null>;
  /** Whether any of the owner's projects (or, without an owner, anyone's) has this reference. */
  hasReference(referenceId: string, ownerId?: string): Promise<boolean>;
}

const summaryOf = (
  id: string,
  data: ProjectData,
  version: number,
  updatedAt: string,
): ProjectSummary => ({
  id,
  name: data.name,
  version,
  updatedAt,
  urls: data.references.map((ref) => ref.url),
  colors: data.result?.color.light ?? null,
});

export function createMemoryProjectStore(now: () => Date = () => new Date()): ProjectStore {
  const rows = new Map<
    string,
    { ownerId: string; data: ProjectData; version: number; updatedAt: string }
  >();
  const mine = (ownerId: string, id: string) => {
    const row = rows.get(id);
    return row?.ownerId === ownerId ? row : undefined;
  };
  const copy = (data: ProjectData) => structuredClone(data);

  return {
    list(ownerId) {
      return Promise.resolve(
        [...rows.entries()]
          .filter(([, row]) => row.ownerId === ownerId)
          .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
          .map(([id, row]) => summaryOf(id, row.data, row.version, row.updatedAt)),
      );
    },
    count(ownerId) {
      return Promise.resolve([...rows.values()].filter((row) => row.ownerId === ownerId).length);
    },
    get(ownerId, id) {
      const row = mine(ownerId, id);
      return Promise.resolve(
        row ? { data: copy(row.data), version: row.version, updatedAt: row.updatedAt } : null,
      );
    },
    create(ownerId, data, newId) {
      let id = data.id;
      const existing = rows.get(id);
      if (existing?.ownerId === ownerId) {
        return Promise.resolve({ status: "exists" as const, id, version: existing.version });
      }
      while (rows.has(id)) id = newId();
      rows.set(id, {
        ownerId,
        data: { ...copy(data), id },
        version: 1,
        updatedAt: now().toISOString(),
      });
      return Promise.resolve({ status: "created" as const, id, version: 1 });
    },
    save(ownerId, id, data, baseVersion) {
      const row = mine(ownerId, id);
      if (!row) return Promise.resolve({ status: "missing" as const });
      if (row.version !== baseVersion) {
        return Promise.resolve({ status: "conflict" as const, version: row.version });
      }
      row.data = { ...copy(data), id };
      row.version += 1;
      row.updatedAt = now().toISOString();
      return Promise.resolve({
        status: "saved" as const,
        version: row.version,
        updatedAt: row.updatedAt,
      });
    },
    remove(ownerId, id) {
      const row = mine(ownerId, id);
      if (!row) return Promise.resolve(null);
      rows.delete(id);
      return Promise.resolve(row.data);
    },
    hasReference(referenceId, ownerId) {
      return Promise.resolve(
        [...rows.values()].some(
          (row) =>
            (ownerId === undefined || row.ownerId === ownerId) &&
            row.data.references.some((ref) => ref.id === referenceId),
        ),
      );
    },
  };
}

const iso = (value: Date | string) =>
  (value instanceof Date ? value : new Date(value)).toISOString();

export function createPostgresProjectStore(db: Db): ProjectStore {
  return {
    async list(ownerId) {
      const { rows } = await db.query<{
        id: string;
        name: string;
        version: number;
        updated_at: Date | string;
        urls: string[] | null;
        colors: Record<string, string> | null;
      }>(
        `SELECT "id", "name", "version", "updated_at",
                jsonb_path_query_array("data", '$.references[*].url') AS "urls",
                "data"->'result'->'color'->'light' AS "colors"
           FROM "projects" WHERE "owner_id" = $1 ORDER BY "updated_at" DESC, "id"`,
        [ownerId],
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        version: row.version,
        updatedAt: iso(row.updated_at),
        urls: row.urls ?? [],
        colors: row.colors ?? null,
      }));
    },
    async count(ownerId) {
      const { rows } = await db.query<{ n: number }>(
        `SELECT count(*)::int AS "n" FROM "projects" WHERE "owner_id" = $1`,
        [ownerId],
      );
      return rows[0]?.n ?? 0;
    },
    async get(ownerId, id) {
      const { rows } = await db.query<{
        data: ProjectData;
        version: number;
        updated_at: Date | string;
      }>(
        `SELECT "data", "version", "updated_at" FROM "projects" WHERE "id" = $1 AND "owner_id" = $2`,
        [id, ownerId],
      );
      const row = rows[0];
      return row ? { data: row.data, version: row.version, updatedAt: iso(row.updated_at) } : null;
    },
    async create(ownerId, data, newId) {
      let id = data.id;
      for (let attempt = 0; attempt < 5; attempt++) {
        const inserted = await db.query<{ version: number }>(
          `INSERT INTO "projects" ("id", "owner_id", "name", "data") VALUES ($1, $2, $3, $4)
           ON CONFLICT ("id") DO NOTHING RETURNING "version"`,
          [id, ownerId, data.name, JSON.stringify({ ...data, id })],
        );
        if (inserted.rows[0]) return { status: "created", id, version: inserted.rows[0].version };
        const { rows } = await db.query<{ owner_id: string; version: number }>(
          `SELECT "owner_id", "version" FROM "projects" WHERE "id" = $1`,
          [id],
        );
        const row = rows[0];
        if (row?.owner_id === ownerId) return { status: "exists", id, version: row.version };
        id = newId();
      }
      throw new Error("projects: no free id after 5 attempts");
    },
    async save(ownerId, id, data, baseVersion) {
      const updated = await db.query<{ version: number; updated_at: Date | string }>(
        `UPDATE "projects" SET "data" = $1, "name" = $2, "version" = "version" + 1, "updated_at" = now()
          WHERE "id" = $3 AND "owner_id" = $4 AND "version" = $5
          RETURNING "version", "updated_at"`,
        [JSON.stringify({ ...data, id }), data.name, id, ownerId, baseVersion],
      );
      const row = updated.rows[0];
      if (row) return { status: "saved", version: row.version, updatedAt: iso(row.updated_at) };
      const { rows } = await db.query<{ version: number }>(
        `SELECT "version" FROM "projects" WHERE "id" = $1 AND "owner_id" = $2`,
        [id, ownerId],
      );
      return rows[0] ? { status: "conflict", version: rows[0].version } : { status: "missing" };
    },
    async remove(ownerId, id) {
      const { rows } = await db.query<{ data: ProjectData }>(
        `DELETE FROM "projects" WHERE "id" = $1 AND "owner_id" = $2 RETURNING "data"`,
        [id, ownerId],
      );
      return rows[0]?.data ?? null;
    },
    async hasReference(referenceId, ownerId) {
      const needle = JSON.stringify([{ id: referenceId }]);
      const { rows } =
        ownerId === undefined
          ? await db.query(
              `SELECT 1 FROM "projects" WHERE "data"->'references' @> $1::jsonb LIMIT 1`,
              [needle],
            )
          : await db.query(
              `SELECT 1 FROM "projects" WHERE "owner_id" = $2 AND "data"->'references' @> $1::jsonb LIMIT 1`,
              [needle, ownerId],
            );
      return rows.length > 0;
    },
  };
}
