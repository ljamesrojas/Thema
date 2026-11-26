-- Serverless mode (THEMA_EXTRACTION=serverless): what Redis holds when there's a worker server,
-- kept in Postgres instead, so Thema runs on Vercel alone. Unused otherwise.

-- Extraction jobs: one per URL and UTC day (the id), kept 24 hours with their screenshot.
CREATE TABLE "extraction_jobs" (
  "id" text PRIMARY KEY,
  "url" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('queued', 'running', 'done', 'failed')),
  "stage" text,
  "result" jsonb,
  "screenshot" bytea,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL,
  "started_at" timestamptz
);
CREATE INDEX "extraction_jobs_status" ON "extraction_jobs" ("status", "created_at");

-- Daily limits: new extractions per client (hashed IP or user) and in total, per UTC day.
CREATE TABLE "rate_limits" (
  "key" text NOT NULL,
  "day" date NOT NULL,
  "count" integer NOT NULL,
  PRIMARY KEY ("key", "day")
);

-- Anonymous daily totals (server/stats.ts): counts per event, and the random ids of projects
-- that blended or exported (to count distinct projects). Kept about 400 days.
CREATE TABLE "daily_totals" (
  "day" date NOT NULL,
  "event" text NOT NULL,
  "count" integer NOT NULL,
  PRIMARY KEY ("day", "event")
);
CREATE TABLE "daily_projects" (
  "day" date NOT NULL,
  "event" text NOT NULL,
  "project" text NOT NULL,
  PRIMARY KEY ("day", "event", "project")
);
