// Pricing (docs/pages.md): plans differ only in projects kept and sites read a day. Every number
// comes from server/plans.ts, the queue's signed-out limit and the engine's reference limit.
import { MAX_REFERENCES } from "@thema/engine";
import { ANONYMOUS_DAILY_EXTRACTIONS } from "@thema/jobs";
import { Accent, Band, ClosingCta, container, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { PLANS, PRICES } from "@/server/plans";
import { PricingPlans } from "./pricing-plans";

const PLAN_NAMES = ["No account", PLANS.free.label, PLANS.pro.label] as const;
const included = ["Included", "Included", "Included"] as const;

export const COMPARE: [string, readonly [string, string, string]][] = [
  ["Price", ["$0", "$0", `$${PRICES.monthly} a month or $${PRICES.yearly} a year`]],
  ["Saved projects", ["1, in this browser", String(PLANS.free.savedProjects), "Unlimited"]],
  [
    "New extractions a day",
    [
      String(ANONYMOUS_DAILY_EXTRACTIONS),
      String(PLANS.free.dailyExtractions),
      String(PLANS.pro.dailyExtractions),
    ],
  ],
  ["Sites per blend", [String(MAX_REFERENCES), String(MAX_REFERENCES), String(MAX_REFERENCES)]],
  ["Blend, sliders and locks", included],
  ["WCAG fixes and dark mode", included],
  ["Preview on 3 templates", included],
  ["All five exports and thema.json", included],
  ["Sign-in", ["Not needed", "GitHub or Google", "GitHub or Google"]],
];

const QUESTIONS = [
  [
    "Do I need a card to start?",
    "No. Without an account you get every feature, and signing in with GitHub or Google is free. A card only comes in when you choose Pro.",
  ],
  [
    "Does Pro make better exports?",
    "No. Every plan runs the same engine and fixer and gets the same five files. Pro keeps more projects and reads more sites a day.",
  ],
  [
    "What counts as an extraction?",
    "Reading a site Thema hasn't read today. Adding one that was already read today is free and instant, and blending, tuning and exporting never count.",
  ],
  [
    "How am I billed?",
    `Through Paddle, monthly or yearly, in ${PRICES.currency}. Paddle adds sales tax or VAT where your country requires it and sends the receipt.`,
  ],
] as const;

export function PricingPage() {
  return (
    <>
      <SiteHeader current="/pricing" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "flex flex-col items-center gap-12 py-24")}>
            <PageHero
              centered
              eyebrow="Pricing"
              title={
                <>
                  Every feature, <Accent underline>free</Accent> to start.
                </>
              }
              subhead="Plans only differ in how many projects you keep and how many new sites Thema reads for you a day."
            />
            <PricingPlans anonymousDaily={ANONYMOUS_DAILY_EXTRACTIONS} />
          </div>
        </section>

        <Band tone="subtle" label="Compare plans" className="flex flex-col gap-8">
          <h2 className="m-0 text-h2 font-h2">Compare plans.</h2>
          <div
            role="region"
            aria-label="Plan comparison"
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-hairline bg-surface"
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-body-sm font-body-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-5 py-4 font-medium text-ink-subtle">
                    <span className="sr-only">Feature</span>
                  </th>
                  {PLAN_NAMES.map((name) => (
                    <th key={name} scope="col" className="px-5 py-4 font-semibold">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([feature, values]) => (
                  <tr key={feature} className="border-b border-divider last:border-b-0">
                    <th scope="row" className="px-5 py-3 font-medium">
                      {feature}
                    </th>
                    {values.map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-5 py-3",
                          value === "Included" ? "text-success" : "text-ink-muted",
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Band>

        <Band
          label="More about pricing"
          className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
        >
          <div className="flex flex-col gap-4 rounded-xl bg-band p-8 text-band-ink">
            <h2 className="m-0 text-h3 font-h3">Prefer your terminal?</h2>
            <p className="m-0 text-body-sm font-body-sm text-band-ink-soft">
              The CLI and MCP server are free and open source. They run on your own machine, with no
              account and no daily limit.
            </p>
            <a
              href="/agents"
              className="flex min-h-11 w-fit items-center text-label-md font-label-md text-band-link"
            >
              Set them up →
            </a>
          </div>
          <div className="flex flex-col gap-6">
            <h2 className="m-0 text-h2 font-h2">Pricing questions.</h2>
            <dl className="m-0 grid gap-6 md:grid-cols-2">
              {QUESTIONS.map(([question, answer]) => (
                <div key={question} className="flex flex-col gap-2">
                  <dt className="text-title-sm font-title-sm">{question}</dt>
                  <dd className="m-0 text-body-sm font-body-sm text-ink-muted">{answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Band>

        <ClosingCta
          primary={false}
          title={
            <>
              Your first blend is <Accent underline>free</Accent>.
            </>
          }
          line="No card, no sign-up."
          action="Paste your first site"
        />
      </main>
      <SiteFooter />
    </>
  );
}
