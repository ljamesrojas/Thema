"use client";

import { useId, useState } from "react";
import { buttonVariants } from "@/components/button";
import { Choice } from "@/components/choice";
import { cn } from "@/lib/cn";
import { PLANS, PRICES, yearlySaving } from "@/server/plans";

type Billing = "monthly" | "yearly";

/**
 * Pricing's toggle and plan cards (docs/pages.md). Limits and prices come from server/plans.ts
 * and the queue's signed-out limit (passed in), so the page follows SPEC when they change.
 */
export function PricingPlans({ anonymousDaily }: { anonymousDaily: number }) {
  const id = useId();
  const [billing, setBilling] = useState<Billing>("monthly");
  const yearly = billing === "yearly";

  const plans = [
    {
      name: "No account",
      price: "$0",
      per: "forever",
      note: null,
      features: [
        "1 project, in this browser",
        `${anonymousDaily} new extractions a day`,
        "Every feature and export",
      ],
      action: (
        <a href="/" className={buttonVariants({ variant: "ghost" })}>
          Paste a site
        </a>
      ),
      pro: false,
    },
    {
      name: PLANS.free.label,
      price: "$0",
      per: "forever",
      note: null,
      features: [
        `${PLANS.free.savedProjects} saved projects`,
        `${PLANS.free.dailyExtractions} new extractions a day`,
        "Every feature and export",
      ],
      action: (
        <a href="/sign-in" className={buttonVariants({ variant: "secondary" })}>
          Sign in free
        </a>
      ),
      pro: false,
    },
    {
      name: PLANS.pro.label,
      price: `$${yearly ? PRICES.yearly : PRICES.monthly}`,
      per: yearly ? "/ year" : "/ month",
      note: yearly
        ? `That's $${PRICES.yearly / 12} a month, billed once a year.`
        : "Billed monthly. Cancel anytime.",
      features: [
        "Unlimited saved projects",
        `${PLANS.pro.dailyExtractions} new extractions a day`,
        "Everything in Free",
      ],
      // Until Paddle approves the account (SPEC: Pro is a flag): focusable text, not a link.
      action: (
        <span
          tabIndex={0}
          aria-describedby={`${id}-soon`}
          className={cn(buttonVariants({ variant: "primary" }), "cursor-default")}
        >
          Coming soon
        </span>
      ),
      pro: true,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-3">
        <Choice
          label="Billing"
          value={billing}
          options={[
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
          ]}
          onChange={setBilling}
        />
        <span className="rounded-full bg-primary-tint px-2.5 py-1 text-ui-sm font-ui-sm text-primary-deep">
          save {yearlySaving()}%
        </span>
      </div>

      <ul className="m-0 grid w-full list-none items-stretch gap-4 p-0 lg:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            aria-label={`${plan.name} plan`}
            className={cn(
              "flex flex-col gap-6 rounded-xl p-7",
              plan.pro
                ? "bg-band text-band-ink shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_rgb(0_0_0/0.12)]"
                : "border border-hairline bg-surface",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-h4 font-h4">{plan.name}</h2>
              {plan.pro && (
                <span className="rounded-full bg-band-accent px-2.5 py-1 text-ui-sm font-ui-sm text-ink">
                  for regular use
                </span>
              )}
            </div>
            <p className="m-0 flex items-baseline gap-2">
              <span data-testid={plan.pro ? "pro-price" : undefined} className="text-h2 font-h2">
                {plan.price}
              </span>
              <span className={plan.pro ? "text-band-ink-soft" : "text-ink-muted"}>{plan.per}</span>
            </p>
            {plan.note && (
              <p className="m-0 -mt-4 text-ui-sm font-ui-sm text-band-ink-soft">{plan.note}</p>
            )}
            <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0 text-body-sm font-body-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className={plan.pro ? "text-band-accent" : "text-success"}
                  >
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            {plan.action}
            {plan.pro && (
              <p id={`${id}-soon`} className="m-0 -mt-3 text-ui-sm font-ui-sm text-band-ink-soft">
                Pro opens once payments are set up.
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 text-center text-ui-sm font-ui-sm text-ink-muted">
        Prices in {PRICES.currency}. Payments run through Paddle, which handles sales tax and VAT
        for your country.
      </p>
    </div>
  );
}
