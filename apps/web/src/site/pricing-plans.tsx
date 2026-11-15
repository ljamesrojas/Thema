"use client";

import { useId, useState } from "react";
import { buttonVariants } from "@/components/button";
import { Choice } from "@/components/choice";
import { cn } from "@/lib/cn";
import { PLANS, PRICES, yearlySaving } from "@/server/plans";
import { CheckIcon } from "./icons";

type Billing = "monthly" | "yearly";

/**
 * Pricing's toggle and plan cards (docs/pages.md, docs/mockups/pricing.png). Limits and prices
 * come from server/plans.ts and the queue's signed-out limit (passed in), so the page follows
 * SPEC when they change.
 */
export function PricingPlans({ anonymousDaily }: { anonymousDaily: number }) {
  const id = useId();
  const [billing, setBilling] = useState<Billing>("monthly");
  const yearly = billing === "yearly";
  const saving = yearlySaving();

  const plans = [
    {
      name: "No account",
      tagline: "Try it right now, nothing to sign.",
      price: "$0",
      per: "forever",
      note: null,
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
      pro: false,
    },
    {
      name: PLANS.free.label,
      tagline: "Sign in with GitHub or Google to keep your work.",
      price: "$0",
      per: "forever",
      note: null,
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
      pro: false,
    },
    {
      name: PLANS.pro.label,
      tagline: "For people who blend a system for every project.",
      price: `$${yearly ? PRICES.yearly : PRICES.monthly}`,
      per: yearly ? "/ year" : "/ month",
      note: yearly
        ? `That's $${PRICES.yearly / 12} a month, billed once a year.`
        : `Or $${PRICES.yearly} a year, and save ${saving}%.`,
      features: [
        "Unlimited saved projects",
        `${PLANS.pro.dailyExtractions} new extractions a day`,
        "Everything in Free",
      ],
      // Until Paddle approves the account (SPEC: Pro is a flag): a muted, focusable label, not a
      // link or a button, so nothing looks clickable that isn't.
      action: (
        <span
          tabIndex={0}
          aria-describedby={`${id}-soon`}
          className="flex min-h-11 items-center justify-center rounded-full border border-band-hairline text-body-md font-body-md text-band-ink-soft"
        >
          Coming soon
        </span>
      ),
      pro: true,
    },
  ];

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <Choice
        label="Billing"
        value={billing}
        options={[
          ["monthly", "Monthly"],
          [
            "yearly",
            <span key="yearly" className="flex items-center gap-2">
              Yearly{" "}
              <span
                className={cn(
                  "text-token font-token",
                  yearly ? "text-band-accent" : "text-primary-strong",
                )}
              >
                save {saving}%
              </span>
            </span>,
          ],
        ]}
        onChange={setBilling}
      />

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
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-h4 font-h4">{plan.name}</h2>
                {plan.pro && (
                  <span className="rounded-full bg-band-accent px-2.5 py-1 text-token font-token text-ink">
                    for regular use
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "m-0 text-ui-sm font-ui-sm",
                  plan.pro ? "text-band-ink-soft" : "text-ink-muted",
                )}
              >
                {plan.tagline}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="m-0 flex items-baseline gap-2">
                <span data-testid={plan.pro ? "pro-price" : undefined} className="text-h2 font-h2">
                  {plan.price}
                </span>
                <span className={plan.pro ? "text-band-ink-soft" : "text-ink-muted"}>
                  {plan.per}
                </span>
              </p>
              {plan.note && (
                <p className="m-0 text-ui-sm font-ui-sm text-band-ink-soft">{plan.note}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {plan.action}
              {plan.pro && (
                <p id={`${id}-soon`} className="m-0 text-ui-sm font-ui-sm text-band-ink-soft">
                  Pro opens once payments are set up.
                </p>
              )}
            </div>
            <ul
              className={cn(
                "m-0 flex flex-1 list-none flex-col gap-2.5 border-t p-0 pt-5 text-body-sm font-body-sm",
                plan.pro ? "border-band-hairline" : "border-hairline",
              )}
            >
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className={cn("mt-1", plan.pro ? "text-dark-success" : "text-success")}>
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
        Prices in {PRICES.currency}. Payments run through Paddle, which handles sales tax and VAT
        for your country.
      </p>
    </div>
  );
}
