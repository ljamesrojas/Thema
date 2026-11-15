// What each kind of user gets (user-approved 2026-11-15). Signing in unlocks saved projects
// (SPEC); Pro is a flag on the user until billing is connected. No imports: the sign-in and
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

/** Pro's price in USD, the same everywhere (decided 2026-11-15); sold through Paddle. */
export const PRICES = { monthly: 12, yearly: 96, currency: "USD" } as const;

/** What paying yearly saves, against twelve months: 33 for $96 vs $144. */
export const yearlySaving = (): number =>
  Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
