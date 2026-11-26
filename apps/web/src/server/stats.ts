// Anonymous daily totals for SPEC's 4-week check (user's call: no analytics, no tracking). Per UTC
// day: how many extractions, blends, exports and sign-ups happened, and how many different
// projects blended and exported (by the project's random id, which identifies no person). Never
// an IP address, a name, a cookie or a URL. Redis with a worker server, Postgres in serverless
// mode, memory otherwise.
import type { Redis } from "ioredis";
import type { Db } from "./db";

export const EVENTS = ["extraction", "blend", "export", "signup"] as const;
export type StatEvent = (typeof EVENTS)[number];

/** Events counted per distinct project as well (projects that blended, projects that exported). */
const PER_PROJECT: readonly StatEvent[] = ["blend", "export"];

/** Totals are kept this long. */
export const STATS_KEEP_DAYS = 400;

export interface DayTotals {
  /** YYYY-MM-DD (UTC). */
  day: string;
  counts: Record<StatEvent, number>;
  /** Different projects that blended / exported that day. */
  projects: { blend: number; export: number };
}

export interface Stats {
  /** Count one event; `projectId` also adds the project to that day's distinct set. */
  record(event: StatEvent, projectId?: string): Promise<void>;
  /** The last `days` days, oldest first, plus distinct projects over the whole window. */
  report(days: number): Promise<{ days: DayTotals[]; window: { blend: number; export: number } }>;
}

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

const lastDays = (now: Date, days: number) =>
  Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (days - 1 - i));
    return utcDay(date);
  });

const zero = (): Record<StatEvent, number> =>
  Object.fromEntries(EVENTS.map((e) => [e, 0])) as Record<StatEvent, number>;

export function createMemoryStats(now: () => Date = () => new Date()): Stats {
  const counts = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  return {
    record(event, projectId) {
      const day = utcDay(now());
      const key = `${day}:${event}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (projectId && PER_PROJECT.includes(event)) {
        const set = sets.get(key) ?? new Set<string>();
        set.add(projectId);
        sets.set(key, set);
      }
      return Promise.resolve();
    },
    report(n) {
      const days = lastDays(now(), n).map((day) => {
        const totals = zero();
        for (const event of EVENTS) totals[event] = counts.get(`${day}:${event}`) ?? 0;
        return {
          day,
          counts: totals,
          projects: {
            blend: sets.get(`${day}:blend`)?.size ?? 0,
            export: sets.get(`${day}:export`)?.size ?? 0,
          },
        };
      });
      const union = (event: StatEvent) =>
        new Set(days.flatMap(({ day }) => [...(sets.get(`${day}:${event}`) ?? [])])).size;
      return Promise.resolve({ days, window: { blend: union("blend"), export: union("export") } });
    },
  };
}

/**
 * Redis: a counter per day and event (INCR) and, for per-project events, a HyperLogLog of project
 * ids (PFADD), which estimates distinct counts in 12 KB and can't list the ids back.
 */
export function createRedisStats(connection: Redis, now: () => Date = () => new Date()): Stats {
  const ttl = STATS_KEEP_DAYS * 24 * 60 * 60;
  const count = (day: string, event: StatEvent) => `thema:stats:${day}:${event}`;
  const projects = (day: string, event: StatEvent) => `thema:stats:${day}:${event}:projects`;
  return {
    async record(event, projectId) {
      const day = utcDay(now());
      const multi = connection.multi().incr(count(day, event)).expire(count(day, event), ttl);
      if (projectId && PER_PROJECT.includes(event)) {
        multi.pfadd(projects(day, event), projectId).expire(projects(day, event), ttl);
      }
      await multi.exec();
    },
    async report(n) {
      const dayList = lastDays(now(), n);
      const days: DayTotals[] = [];
      for (const day of dayList) {
        const values = await connection.mget(...EVENTS.map((e) => count(day, e)));
        const totals = zero();
        EVENTS.forEach((event, i) => (totals[event] = Number(values[i] ?? 0)));
        days.push({
          day,
          counts: totals,
          projects: {
            blend: await connection.pfcount(projects(day, "blend")),
            export: await connection.pfcount(projects(day, "export")),
          },
        });
      }
      return {
        days,
        window: {
          blend: await connection.pfcount(...dayList.map((d) => projects(d, "blend"))),
          export: await connection.pfcount(...dayList.map((d) => projects(d, "export"))),
        },
      };
    },
  };
}

/**
 * Postgres (serverless mode): a count per day and event, and the ids of projects that blended or
 * exported per day (random ids, see the top of this file), for distinct counts. Rows older than
 * STATS_KEEP_DAYS are deleted as new ones arrive.
 */
export function createPostgresStats(db: Db, now: () => Date = () => new Date()): Stats {
  const since = (n: number) => lastDays(now(), n)[0] ?? utcDay(now());
  return {
    async record(event, projectId) {
      const day = utcDay(now());
      await db.query(
        `INSERT INTO "daily_totals" ("day", "event", "count") VALUES ($1::date, $2, 1)
         ON CONFLICT ("day", "event") DO UPDATE SET "count" = "daily_totals"."count" + 1`,
        [day, event],
      );
      if (projectId && PER_PROJECT.includes(event)) {
        await db.query(
          `INSERT INTO "daily_projects" ("day", "event", "project") VALUES ($1::date, $2, $3)
           ON CONFLICT DO NOTHING`,
          [day, event, projectId],
        );
      }
      const oldest = since(STATS_KEEP_DAYS);
      await db.query(`DELETE FROM "daily_totals" WHERE "day" < $1::date`, [oldest]);
      await db.query(`DELETE FROM "daily_projects" WHERE "day" < $1::date`, [oldest]);
    },
    async report(n) {
      const dayList = lastDays(now(), n);
      const from = dayList[0] ?? utcDay(now());
      const { rows: totals } = await db.query<{ day: string; event: StatEvent; count: number }>(
        `SELECT to_char("day", 'YYYY-MM-DD') AS "day", "event", "count"
         FROM "daily_totals" WHERE "day" >= $1::date`,
        [from],
      );
      const { rows: perDay } = await db.query<{ day: string; event: StatEvent; count: number }>(
        `SELECT to_char("day", 'YYYY-MM-DD') AS "day", "event", count(*)::int AS "count"
         FROM "daily_projects" WHERE "day" >= $1::date GROUP BY "day", "event"`,
        [from],
      );
      const { rows: window } = await db.query<{ event: StatEvent; count: number }>(
        `SELECT "event", count(DISTINCT "project")::int AS "count"
         FROM "daily_projects" WHERE "day" >= $1::date GROUP BY "event"`,
        [from],
      );
      const find = (
        rows: { day?: string; event: StatEvent; count: number }[],
        event: string,
        day?: string,
      ) => rows.find((r) => r.event === event && (day === undefined || r.day === day))?.count ?? 0;
      return {
        days: dayList.map((day) => {
          const counts = zero();
          for (const event of EVENTS) counts[event] = find(totals, event, day);
          return {
            day,
            counts,
            projects: { blend: find(perDay, "blend", day), export: find(perDay, "export", day) },
          };
        }),
        window: { blend: find(window, "blend"), export: find(window, "export") },
      };
    },
  };
}

/** Counting must never break the request it's counting: failures are logged and dropped. */
export function recordSafely(stats: Stats, event: StatEvent, projectId?: string): Promise<void> {
  return stats.record(event, projectId).catch((error: unknown) => {
    console.error(`Couldn't count ${event}:`, error);
  });
}
