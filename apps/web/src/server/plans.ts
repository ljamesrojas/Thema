// What each kind of user gets (user-approved 2026-11-15). Signing in unlocks saved projects
// (SPEC); Pro is a flag on the user until billing is connected.
import { ANONYMOUS_DAILY_EXTRACTIONS } from "@thema/jobs";

export type Plan = "free" | "pro";

export const PLANS = {
  free: { label: "Free", dailyExtractions: 10, savedProjects: 3 },
  pro: { label: "Pro", dailyExtractions: 50, savedProjects: Number.POSITIVE_INFINITY },
} as const satisfies Record<
  Plan,
  { label: string; dailyExtractions: number; savedProjects: number }
>;

export const ANONYMOUS = { dailyExtractions: ANONYMOUS_DAILY_EXTRACTIONS } as const;

export const planOf = (value: unknown): Plan => (value === "pro" ? "pro" : "free");
