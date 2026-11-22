import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";
import { PLANS } from "@/server/plans";
import { CheckIcon } from "./icons";

/**
 * The Plans page's three cards. Thema is a free personal project, so there are no prices: No
 * account and Free are what everyone gets, and Pro is shown as planned (its limits exist in the
 * code as a flag set by hand; docs/plans/payments.md holds the plan for selling it). Limits come
 * from server/plans.ts and the queue's signed-out limit (passed in), so the page follows SPEC.
 */
export function PlanCards({ anonymousDaily }: { anonymousDaily: number }) {
  const plans = [
    {
      name: "No account",
      tagline: "Try it right now, nothing to sign.",
      features: [
        "1 project, saved in this browser",
        `${anonymousDaily} new extractions a day`,
        "Every feature and export",
      ],
      action: (
        <a href="/" className={buttonVariants({ variant: "ghost" })}>
          Paste a site
        </a>
      ),
      planned: false,
    },
    {
      name: PLANS.free.label,
      tagline: "Sign in with GitHub or Google to keep your work.",
      features: [
        `${PLANS.free.savedProjects} saved projects in your account`,
        `${PLANS.free.dailyExtractions} new extractions a day`,
        "Every feature and export",
      ],
      action: (
        <a href="/sign-in" className={buttonVariants({ variant: "secondary" })}>
          Sign in free
        </a>
      ),
      planned: false,
    },
    {
      name: PLANS.pro.label,
      tagline: "An idea for later, for people who blend a system for every project.",
      features: [
        "Unlimited saved projects",
        `${PLANS.pro.dailyExtractions} new extractions a day`,
        "Everything in Free",
      ],
      action: (
        <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">
          Not available. Nothing in Thema is for sale.
        </p>
      ),
      planned: true,
    },
  ];

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <ul className="m-0 grid w-full list-none items-stretch gap-4 p-0 lg:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            aria-label={`${plan.name} plan`}
            className={cn(
              "flex flex-col gap-6 rounded-xl p-7",
              plan.planned
                ? "border border-dashed border-hairline bg-surface-subtle"
                : "border border-hairline bg-surface",
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-h4 font-h4">{plan.name}</h2>
                {plan.planned && (
                  <span className="rounded-full border border-hairline px-2.5 py-1 text-token font-token text-ink-muted">
                    planned
                  </span>
                )}
              </div>
              <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">{plan.tagline}</p>
            </div>
            {!plan.planned && (
              <p className="m-0 text-h2 font-h2" data-testid="plan-price">
                $0
              </p>
            )}
            <div className="flex flex-col gap-2">{plan.action}</div>
            <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 border-t border-hairline p-0 pt-5 text-body-sm font-body-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className="mt-1 text-success">
                    <CheckIcon />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="m-0 text-center text-ui-sm font-ui-sm text-ink-muted">
        Thema is a personal project: no card, no subscription, nothing to buy.
      </p>
    </div>
  );
}
