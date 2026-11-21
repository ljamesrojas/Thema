// pnpm --filter @thema/web stats [days]: the anonymous daily totals (server/stats.ts) for the last
// `days` days (default 28), and SPEC's "projects that reach an export" over that window. Reads
// REDIS_URL from apps/web/.env.local or the environment: totals only persist in Redis.
import { redisConnection, redisTlsCa } from "@thema/jobs/bull";
import { createRedisStats, EVENTS } from "../src/server/stats";

const days = Number(process.argv[2] ?? 28);
const url = process.env.REDIS_URL;
if (!url || !Number.isInteger(days) || days < 1 || days > 400) {
  console.error(
    url
      ? "Usage: pnpm --filter @thema/web stats [days 1-400]"
      : "Set REDIS_URL (the production Redis) to read the totals: without Redis they live only in the dev server's memory.",
  );
  process.exit(1);
}

const connection = redisConnection(url, { ca: redisTlsCa(process.env) });
try {
  const { days: rows, window } = await createRedisStats(connection).report(days);
  const header = ["day", ...EVENTS, "projects blended", "projects exported"];
  console.log(header.join("\t"));
  for (const row of rows) {
    console.log(
      [row.day, ...EVENTS.map((e) => row.counts[e]), row.projects.blend, row.projects.export].join(
        "\t",
      ),
    );
  }
  const total = (event: (typeof EVENTS)[number]) =>
    rows.reduce((sum, row) => sum + row.counts[event], 0);
  const share = window.blend ? Math.round((window.export / window.blend) * 100) : 0;
  console.log(
    `\nLast ${days} days: ${total("extraction")} extractions, ${total("blend")} blends, ${total("export")} exports, ${total("signup")} sign-ups.`,
  );
  console.log(
    `Projects that reached an export: ${window.export} of ${window.blend} that blended (${share}%; SPEC target 40%). Distinct counts are estimates (HyperLogLog, about 1% off).`,
  );
} finally {
  connection.disconnect();
}
