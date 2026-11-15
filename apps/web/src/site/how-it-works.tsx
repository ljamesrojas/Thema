// How it works (docs/pages.md): five steps, each shown with values from the sample system (the
// Landing hero's blend of three .example fixtures), so nothing on the page is made up.
import { CHECKED_PAIRS, MAX_REFERENCES, type BorrowTag } from "@thema/engine";
import { toHex } from "@thema/exporters";
import { checkUrl } from "@thema/url-guard";
import type { ReactNode } from "react";
import { PaintChip } from "@/components/paint-chip";
import { Accent, Band, ClosingCta, container, Eyebrow, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { UrlInput } from "@/components/url-input";
import { cn } from "@/lib/cn";
import { EXPORT_FILES } from "@/lib/exports-meta";
import { heroBlend, sampleSystem } from "@/lib/hero-blend";
import { BlendTune } from "./blend-tune";

const STEPS = [
  ["paste", "01", "Paste"],
  ["extract", "02", "Extract"],
  ["tag", "03", "Add and tag"],
  ["tune", "04", "Blend and tune"],
  ["export", "05", "Preview and export"],
] as const;

const TAGS: [BorrowTag, string][] = [
  ["colors", "Colors"],
  ["typography", "Type"],
  ["spacing", "Spacing"],
  ["shape", "Shape"],
  ["layout", "Layout"],
];

/** Shown with the verdicts of @thema/url-guard: the worker's and the API's own check. */
const GUARD_EXAMPLES = ["https://north.example/", "http://localhost:3000/", "http://192.168.1.10/"];

const chip = "rounded-full border border-pill-border bg-surface px-3 py-1.5 text-token font-token";

function Step({
  id,
  n,
  title,
  text,
  visual,
  flip,
  subtle,
}: {
  id: string;
  n: string;
  title: string;
  text: ReactNode;
  visual: ReactNode;
  flip: boolean;
  subtle: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("border-t border-hairline", subtle ? "bg-surface-subtle" : "bg-canvas")}
    >
      <div
        className={cn(
          container,
          "grid items-center gap-14 py-26",
          flip
            ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
            : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        )}
      >
        <div className={cn("flex flex-col gap-4", flip && "lg:order-2")}>
          <Eyebrow tone="kiln">{`${n} · ${title}`}</Eyebrow>
          <h2 id={`${id}-title`} className="m-0 text-h2 font-h2">
            {title}
          </h2>
          <div className="flex flex-col gap-3 text-lead font-lead text-ink-muted">{text}</div>
        </div>
        <div className="min-w-0">{visual}</div>
      </div>
    </section>
  );
}

export function HowItWorksPage() {
  const blend = heroBlend();
  const system = sampleSystem();
  const light = system.color.light;
  const guard = GUARD_EXAMPLES.map((raw) => {
    const result = checkUrl(raw);
    return {
      label: result.ok ? "public address" : `${new URL(raw).host} · refused`,
      ok: result.ok,
    };
  });

  return (
    <>
      <SiteHeader current="/how-it-works" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "flex flex-col gap-14 py-24")}>
            <PageHero
              eyebrow="How it works"
              title={
                <>
                  From five links to one <Accent underline>system.</Accent>
                </>
              }
              subhead="Paste the sites you like, pick what each one lends, tune the blend, and export files your coding agent follows. Under two minutes, start to finish."
            />
            <nav aria-label="Steps">
              <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-5">
                {STEPS.map(([id, n, title]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex min-h-11 items-center gap-3 rounded-md border border-hairline bg-surface px-4 py-3 text-ink no-underline"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-[26px] flex-none items-center justify-center rounded-full text-token font-token",
                          n === "05" ? "bg-primary text-ink" : "bg-ink text-canvas",
                        )}
                      >
                        {n}
                      </span>
                      <span className="text-label-md font-label-md">{title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        <Step
          id="paste"
          n="01"
          title="Paste"
          flip={false}
          subtle={false}
          text={
            <p className="m-0">
              Start with any public website. Thema checks the address before anything loads: local
              and private addresses are refused, and so is every redirect that points at one.
            </p>
          }
          visual={
            <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-6">
              <UrlInput />
              <ul
                aria-label="What the guard says"
                className="m-0 flex list-none flex-wrap gap-2 p-0"
              >
                {guard.map(({ label, ok }) => (
                  <li key={label} className={chip}>
                    {ok ? `${label} ✓` : label}
                  </li>
                ))}
              </ul>
            </div>
          }
        />

        <Step
          id="extract"
          n="02"
          title="Extract"
          flip
          subtle
          text={
            <p className="m-0">
              A real browser opens the page, dismisses the cookie banner and scrolls so lazy content
              loads, then reads the computed styles of what&apos;s visible. The engine turns them
              into colors, type, spacing, radius, shadows and layout.
            </p>
          }
          visual={
            <div className="flex flex-col gap-5 rounded-lg border border-hairline bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label-md font-label-md">north.example</span>
                <span className="text-token font-token text-ink-subtle">1440 × 900 · Chromium</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui-sm font-ui-sm">
                {[
                  ["Fetching the page", "done"],
                  ["Cookie banner and scroll", "done"],
                  ["Reading styles", "done"],
                  ["Naming roles", "working"],
                ].map(([label, state]) => (
                  <li key={label} className="flex justify-between border-b border-divider pb-2">
                    <span>{label}</span>
                    <span className={state === "done" ? "text-success" : "text-ink-subtle"}>
                      {state}
                    </span>
                  </li>
                ))}
              </ul>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-hairline">
                <span className="block h-full w-4/5 rounded-full bg-ink" />
              </span>
              <div className="grid grid-cols-5 gap-2">
                {blend.chips.map((c) => (
                  <PaintChip
                    key={c.name}
                    name={c.name}
                    color={c.color}
                    hex={c.hex}
                    ink={blend.ink}
                    compact
                  />
                ))}
              </div>
              <ul
                aria-label="Read from the page"
                className="m-0 flex list-none flex-wrap gap-2 p-0"
              >
                <li className={chip}>{system.typography.families.sans}</li>
                <li className={chip}>base {system.spacing.base}</li>
                <li className={chip}>radius {system.radius.md}</li>
              </ul>
            </div>
          }
        />

        <Step
          id="tag"
          n="03"
          title="Add and tag"
          flip={false}
          subtle={false}
          text={
            <p className="m-0">
              Add up to {MAX_REFERENCES} sites. Tag what each one lends: colors from one, type from
              another, spacing from a third. Each part has exactly one owner.
            </p>
          }
          visual={
            <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-6">
              {blend.references.map(({ label, borrowed }) => (
                <div
                  key={label}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-3"
                >
                  <span className="text-label-md font-label-md">{label}</span>
                  <ul
                    aria-label={`Borrowed from ${label}`}
                    className="m-0 flex list-none flex-wrap gap-1 p-0"
                  >
                    {TAGS.map(([tag, text]) => {
                      const on = borrowed.includes(tag);
                      return (
                        <li
                          key={tag}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-ui-sm font-ui-sm",
                            on ? "bg-ink text-canvas" : "border border-hairline text-ink-muted",
                          )}
                        >
                          {text}
                          {on && <span className="sr-only"> (borrowed)</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <span className="rounded-md border border-dashed border-hairline px-4 py-3 text-ui-sm font-ui-sm text-ink-subtle">
                Add a site · {blend.references.length} of {MAX_REFERENCES}
              </span>
            </div>
          }
        />

        <Step
          id="tune"
          n="04"
          title="Blend and tune"
          flip
          subtle
          text={
            <>
              <p className="m-0">
                Four sliders shape the blend: density, roundness, contrast and warmth. Lock any
                token to keep its exact value, then the fixer brings every text pair to WCAG AA.
              </p>
              <p className="m-0">Try roundness and density here.</p>
            </>
          }
          visual={
            <BlendTune
              primary={light.primary}
              primaryInk={light["primary-ink"]}
              hex={toHex(light.primary)}
            />
          }
        />

        <Step
          id="export"
          n="05"
          title="Preview and export"
          flip={false}
          subtle={false}
          text={
            <p className="m-0">
              See the system on a landing page, a dashboard and a form, in light and dark. Then take
              five files: one for your agent, three for your code, one for your team.
            </p>
          }
          visual={
            <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-6">
              <div aria-hidden="true" className="flex flex-wrap gap-2">
                {(
                  [
                    ["Landing", true],
                    ["Dashboard", false],
                    ["Form", false],
                  ] as const
                ).map(([label, on]) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-ui-sm font-ui-sm",
                      on ? "bg-ink text-canvas" : "border border-pill-border text-ink",
                    )}
                  >
                    {label}
                  </span>
                ))}
                <span className="ml-auto flex gap-1">
                  <span className="rounded-full border border-pill-border px-3 py-1.5 text-ui-sm font-ui-sm text-ink">
                    Light
                  </span>
                  <span className="rounded-full bg-ink px-3 py-1.5 text-ui-sm font-ui-sm text-canvas">
                    Dark
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-3 rounded-md bg-band p-6 text-band-ink">
                <span className="text-h3 font-h3">Calm software for busy teams</span>
                <span className="text-ui-sm font-ui-sm text-band-ink-soft">
                  The dark theme, generated and checked when a site has none.
                </span>
              </div>
              <ul aria-label="The five files" className="m-0 flex list-none flex-wrap gap-2 p-0">
                {EXPORT_FILES.map(([name]) => (
                  <li key={name} className={chip}>
                    {name}
                  </li>
                ))}
              </ul>
              <a
                href="/exports"
                className="flex min-h-11 w-fit items-center text-label-md font-label-md text-ink"
              >
                What&apos;s in each file →
              </a>
            </div>
          }
        />

        <Band tone="band" label="Under the hood" className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Eyebrow tone="band">Under the hood</Eyebrow>
            <h2 className="m-0 max-w-[20ch] text-h2 font-h2 text-band-ink">
              Code decides every value. Always the <Accent>same</Accent> answer.
            </h2>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {[
              [
                "Measured",
                "Colors, type and spacing come from a real browser's computed styles, weighted by how much of the page they cover.",
              ],
              [
                "Harmonized",
                "Each part comes from the site you tagged. When two borrowed colors clash, the free one moves in lightness until they read apart.",
              ],
              [
                "Accessible",
                `${CHECKED_PAIRS.length} text and background pairs are fixed to WCAG AA in light and dark, and a missing theme is generated.`,
              ],
            ].map(([title, text]) => (
              <li
                key={title}
                className="flex flex-col gap-2 rounded-lg border border-band-hairline bg-band-surface p-6"
              >
                <h3 className="m-0 text-h4 font-h4 text-band-ink">{title}</h3>
                <p className="m-0 text-body-sm font-body-sm text-band-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </Band>

        <ClosingCta
          title={
            <>
              Try it with your <Accent underline>first</Accent> site.
            </>
          }
          line="No sign-up for your first blend."
          action="Paste your first site"
        />
      </main>
      <SiteFooter />
    </>
  );
}
