// What each kind of user gets (user-approved 2026-11-15). Signing in unlocks saved projects
// (SPEC); Pro is a flag on the user, set by hand. Thema is a free personal project: nothing is
// sold, and the payments plan for Pro waits in docs/plans/payments.md. No imports: the sign-in and
// Projects screens show these numbers too. Signed-out limits live with the queue (@thema/jobs).

export type Plan = "free" | "pro";

export const PLANS = {
  free: { label: "Free", dailyExtractions: 10, savedProjects: 3 },
  pro: { label: "Pro", dailyExtractions: 50, savedProjects: Number.POSITIVE_INFINITY },
} as const satisfies Record<
  Plan,
  { label: string; dailyExtractions: number; savedProjects: number }
>;

export const planOf = (value: unknown): Plan => (value === "pro" ? "pro" : "free");
