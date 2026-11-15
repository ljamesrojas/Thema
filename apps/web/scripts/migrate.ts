// pnpm --filter @thema/web db:migrate: apply db/migrations/*.sql to DATABASE_URL.
import pg from "pg";
import { migrate, poolDb } from "../src/server/db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (e.g. in apps/web/.env.local) first.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const applied = await migrate(poolDb(pool));
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Up to date.");
} finally {
  await pool.end();
}
