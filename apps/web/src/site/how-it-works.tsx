// How it works (docs/pages.md, docs/mockups/how-it-works.png): five steps, each shown with values
// from the sample system (the Landing hero's blend of three .example fixtures), so nothing on the
// page is made up.
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
import { CheckIcon, CrossIcon, PlusIcon } from "./icons";

const STEPS = [
  ["paste", "01", "Paste", "One public URL, no sign-up"],
  ["extract", "02", "Extract", "A real browser reads the styles"],
  ["tag", "03", "Add and tag", "Borrow one part from each site"],
  ["tune", "04", "Blend and tune", "Sliders, locks, contrast fixes"],
  ["export", "05", "Preview and export", "Five files your agent reads"],
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

/** The stage panel every step's visual sits on (docs/landing-white.md → stage). */
function Stage({ children }: { children: ReactNode }) {
  return <div className="rounded-[20px] bg-stage p-5 sm:p-7">{children}</div>;
}

/** Green-check lines under a step's text. */
function Checks({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body-sm font-body-sm text-ink">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1 text-success">
            <CheckIcon />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Step({
  id,
  n,
  label,
  title,
  text,
  visual,
  flip,
  subtle,
}: {
  id: string;
  n: string;
  label: string;
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
        <div className={cn("flex flex-col gap-5", flip && "lg:order-2")}>
          <Eyebrow tone="kiln">{`${n} · ${label}`}</Eyebrow>
          <h2 id={`${id}-title`} className="m-0 text-h2 font-h2">
            {title}
          </h2>
          <div className="flex flex-col gap-4 text-lead font-lead text-ink-muted">{text}</div>
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
  const dark = system.color.dark;
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
              split
              eyebrow="How it works"
              title={
                <>
                  From five links to one <Accent underline>system.</Accent>
                </>
              }
              subhead="Paste the sites you love, choose what to borrow from each, and get an accessible design system your agent follows. The whole flow is built to take under two minutes."
            />
            <nav aria-label="Steps" className="border-t border-hairline pt-6">
              <ol className="m-0 grid list-none gap-6 p-0 sm:grid-cols-5">
                {STEPS.map(([id, n, title, description]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex min-h-11 flex-col gap-2 text-ink no-underline"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-[26px] items-center justify-center rounded-full text-token font-token",
                          n === "05" ? "bg-primary text-ink" : "border border-hairline text-ink",
                        )}
                      >
                        {n}
                      </span>
                      <span className="text-label-md font-label-md font-semibold">{title}</span>
                      <span className="text-ui-sm font-ui-sm text-ink-muted">{description}</span>
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
          label="Paste"
          title="Paste a site you love."
          flip={false}
          subtle
          text={
            <>
              <p className="m-0">
                Start with one public URL on the landing page, no account needed. Thema checks the
                address before it opens anything, so local and private addresses are refused.
              </p>
              <Checks
                items={[
                  `Up to ${MAX_REFERENCES} sites per project`,
                  "Repeat pastes load instantly for 24 hours",
                ]}
              />
            </>
          }
          visual={
            <Stage>
              <div className="flex flex-col gap-4">
                <UrlInput />
                <ul
                  aria-label="What the guard says"
                  className="m-0 flex list-none flex-wrap gap-2 p-0"
                >
                  {guard.map(({ label, ok }) => (
                    <li
                      key={label}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border border-pill-border bg-surface px-3 py-1.5 text-token font-token",
                        ok ? "text-success" : "text-danger",
                      )}
                    >
                      {ok ? <CheckIcon size={12} /> : <CrossIcon size={12} />}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </Stage>
          }
        />

        <Step
          id="extract"
          n="02"
          label="Extract"
          title="A real browser reads it."
          flip
          subtle={false}
          text={
            <>
              <p className="m-0">
                Each site opens in headless Chromium at 1440 × 900. Thema closes cookie banners,
                scrolls so lazy content appears, and reads the computed styles of every visible
                element.
              </p>
              <Checks
                items={[
                  "Buttons and headings count more than footers",
                  "Default link blues and hidden elements are ignored",
                  "The dark theme is read too, when the site has one",
                ]}
              />
            </>
          }
          visual={
            <Stage>
              <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-token font-token text-ink-subtle">
                  <span>north.example</span>
                  <span>1440 × 900 · Chromium</span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui-sm font-ui-sm">
                  {[
                    ["Fetching the page", true],
                    ["Closing the cookie banner, scrolling every section", true],
                    ["Reading computed styles", true],
                    ["Naming roles", false],
                  ].map(([label, done]) => (
                    <li key={String(label)} className="flex items-center gap-2">
                      {done ? (
                        <span className="text-success">
                          <CheckIcon />
                        </span>
                      ) : (
                        <span aria-hidden="true" className="mx-1 size-2 rounded-full bg-primary" />
                      )}
                      <span className="flex-1">{label}</span>
                      <span
                        className={cn(
                          "text-token font-token",
                          done ? "text-ink-subtle" : "text-primary-strong",
                        )}
                      >
                        {done ? "done" : "working…"}
                      </span>
                    </li>
                  ))}
                </ul>
                <span aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-hairline">
                  <span className="block h-full w-4/5 rounded-full bg-primary" />
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
            </Stage>
          }
        />

        <Step
          id="tag"
          n="03"
          label="Add and tag"
          title="Borrow one part from each."
          flip={false}
          subtle
          text={
            <p className="m-0">
              Add up to {MAX_REFERENCES - 1} more sites and tag what each one lends: Colors, Type,
              Spacing, Shape or Layout. Each part belongs to one site at a time, so the result is a
              blend, never a copy.
            </p>
          }
          visual={
            <Stage>
              <div className="flex flex-col gap-3">
                {blend.references.map(({ label, borrowed }) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-4 py-3"
                  >
                    <span className="text-token font-token">{label}</span>
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
                <span className="flex items-center justify-center gap-2 rounded-md border border-dashed border-ink-faint px-4 py-3 text-ui-sm font-ui-sm text-ink-muted">
                  <PlusIcon />
                  Add a site · {blend.references.length} of {MAX_REFERENCES}
                </span>
              </div>
            </Stage>
          }
        />

        <Step
          id="tune"
          n="04"
          label="Blend and tune"
          title="Tune it. Lock what you love."
          flip
          subtle={false}
          text={
            <>
              <p className="m-0">
                Four sliders shape the whole system: density, roundness, contrast and warmth. Lock
                any token, like an exact primary blue, and nothing will change it.
              </p>
              <p className="m-0">
                Meanwhile every text pair is checked against WCAG 2.2 AA and nudged only if it
                fails. Missing dark mode and status colors are generated.
              </p>
              <p className="m-0 text-caption font-caption text-ink-subtle">
                Try the two sliders on the left.
              </p>
            </>
          }
          visual={
            <Stage>
              <BlendTune colors={light} hex={toHex(light.primary)} radius={system.radius.md} />
            </Stage>
          }
        />

        <Step
          id="export"
          n="05"
          label="Preview and export"
          title="See it, then ship it."
          flip={false}
          subtle
          text={
            <>
              <p className="m-0">
                Check the system on three real pages (Landing, Dashboard and Settings form) in light
                and dark, next to your sources. Then download a zip or copy a single file.
              </p>
              <a
                href="/exports"
                className="flex min-h-11 w-fit items-center text-label-md font-label-md text-primary-strong"
              >
                See every export format →
              </a>
            </>
          }
          visual={
            <Stage>
              <div className="flex flex-col gap-4">
                <div aria-hidden="true" className="flex flex-wrap justify-between gap-2">
                  <span className="flex gap-0.5 rounded-full border border-pill-border bg-surface p-0.5">
                    {["Landing", "Dashboard", "Form"].map((label, i) => (
                      <span
                        key={label}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-ui-sm font-ui-sm",
                          i === 0 ? "bg-ink text-canvas" : "text-ink",
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </span>
                  <span className="flex gap-0.5 rounded-full border border-pill-border bg-surface p-0.5">
                    <span className="rounded-full px-3 py-1.5 text-ui-sm font-ui-sm text-ink">
                      Light
                    </span>
                    <span className="rounded-full bg-ink px-3 py-1.5 text-ui-sm font-ui-sm text-canvas">
                      Dark
                    </span>
                  </span>
                </div>
                <div
                  className="flex flex-col gap-4 rounded-lg p-6"
                  style={{ background: dark.canvas, color: dark.ink }}
                  aria-label="The sample system's dark theme"
                  role="img"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2 text-ui-sm font-ui-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="size-2.5 rounded-sm" style={{ background: dark.primary }} />
                      Acme
                    </span>
                    <span style={{ color: dark["ink-muted"] }}>Product · Pricing · Docs</span>
                  </span>
                  <span className="text-h3 font-h3">Calm software for busy teams</span>
                  <span className="text-ui-sm font-ui-sm" style={{ color: dark["ink-muted"] }}>
                    Dark mode generated from your light theme, contrast re-checked.
                  </span>
                  <span className="flex flex-wrap gap-2 text-ui-sm font-ui-sm">
                    <span
                      className="rounded-sm px-3 py-1.5"
                      style={{ background: dark.primary, color: dark["primary-ink"] }}
                    >
                      Get started
                    </span>
                    <span
                      className="rounded-sm border px-3 py-1.5"
                      style={{ borderColor: dark.hairline }}
                    >
                      Book a demo
                    </span>
                  </span>
                </div>
                <ul aria-label="The five files" className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {EXPORT_FILES.map(([name]) => (
                    <li key={name} className={chip}>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </Stage>
          }
        />

        <Band tone="band" label="Under the hood" className="flex flex-col gap-12">
          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
            <div className="flex flex-col gap-4">
              <Eyebrow tone="band">Under the hood</Eyebrow>
              <h2 className="m-0 text-h2 font-h2 text-band-ink">
                Code decides every value. <span className="text-band-accent">Always</span> the same
                answer.
              </h2>
            </div>
            <p className="m-0 text-body-sm font-body-sm text-band-ink-soft">
              No AI guesses at your colors. The same sites and settings give the same tokens, every
              time.
            </p>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {[
              [
                "measure",
                "Measured",
                "Colors are clustered by how different they look (OKLCH), weighted by how much of the page they cover and how important each element is.",
              ],
              [
                "blend",
                "Harmonized",
                "Borrowed parts are made to fit together: a color that clashes with the new canvas moves in lightness, keeping its hue.",
              ],
              [
                "fix",
                "Accessible",
                `All ${CHECKED_PAIRS.length} checked color pairs meet WCAG 2.2 AA. Each fix is the smallest one that passes, and it's listed in your report.`,
              ],
            ].map(([tag, title, text]) => (
              <li
                key={title}
                className="flex flex-col gap-2 rounded-lg border border-band-hairline bg-band-surface p-6"
              >
                <span className="text-token font-token text-band-ink-muted">{tag}</span>
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
