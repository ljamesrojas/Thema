// Plans (docs/pages.md → Pricing, reworked 2026-11-22): Thema is a free personal project, so the
// page shows what each kind of user gets, with no prices; Pro is planned (docs/plans/payments.md).
// Every number comes from server/plans.ts, the queue's signed-out limit and the engine's limit.
import { MAX_REFERENCES } from "@thema/engine";
import { ANONYMOUS_DAILY_EXTRACTIONS } from "@thema/jobs";
import { Accent, Band, ClosingCta, container, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { PLANS } from "@/server/plans";
import { PlanCards } from "./plan-cards";

const PLAN_NAMES = ["No account", PLANS.free.label, `${PLANS.pro.label} (planned)`] as const;
const included = ["Included", "Included", "Included"] as const;

export const COMPARE: [string, readonly [string, string, string]][] = [
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

export const QUESTIONS = [
  [
    "Does Thema cost anything?",
    "No. Thema is a personal project: every feature is free, there's nothing to buy, and you never need a card.",
  ],
  [
    "Why are there daily limits?",
    "Every new site runs a real browser on a small server. The limits keep it quick, and free, for everyone who tries it.",
  ],
  [
    "What counts as an extraction?",
    "Reading a site Thema hasn't read today. Adding one that was already read today is free and instant, and blending, tuning and exporting never count.",
  ],
  [
    "Will there be a Pro plan?",
    `Maybe, later. It would keep unlimited projects and read ${PLANS.pro.dailyExtractions} new sites a day, with the same engine and exports as everyone else. Nothing is for sale today.`,
  ],
] as const;

export function PlansPage() {
  return (
    <>
      <SiteHeader current="/plans" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "flex flex-col items-center gap-12 py-24")}>
            <PageHero
              centered
              eyebrow="Plans"
              title={<>Every feature, free for everyone.</>}
              subhead="Signing in only changes how many projects you keep and how many new sites Thema reads for you a day."
            />
            <PlanCards anonymousDaily={ANONYMOUS_DAILY_EXTRACTIONS} />
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
          label="More about plans"
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
            <h2 className="m-0 text-h2 font-h2">Questions.</h2>
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
