-- Saved projects (signed-in users). `data` is the Workspace project as JSON (references with
-- their extracted systems, sliders, locks, the last result), validated by the API before it's
-- written. `version` rises by one on every save; a save based on an older version is refused.
CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY,
  "owner_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "projects_owner_updated_idx" ON "projects" ("owner_id", "updated_at" DESC);
