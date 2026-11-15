import type { ColorRole } from "@thema/engine";
import { AgentsStrip } from "@/components/agents-strip";
import { BlendDemo } from "@/components/blend-demo";
import { buttonVariants } from "@/components/button";
import { Faq } from "@/components/faq";
import { PaintChip } from "@/components/paint-chip";
import { Accent, container, Eyebrow } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TagLabel } from "@/components/tag";
import { UrlInput } from "@/components/url-input";
import { cn } from "@/lib/cn";
import type { HeroBlend } from "@/lib/hero-blend";

const TAG_LABEL = {
  colors: "Colors",
  typography: "Type",
  spacing: "Spacing",
  shape: "Shape",
  layout: "Layout",
} as const;
const PAIR_LABEL: Partial<Record<ColorRole, string>> = {
  "ink-muted": "muted",
  "primary-ink": "label",
};
const pairName = ([fg, bg]: [ColorRole, ColorRole]) => `${PAIR_LABEL[fg] ?? fg} on ${bg}`;

function Hero({ blend }: { blend: HeroBlend }) {
  return (
    <section id="top" className="bg-canvas">
      <div className={cn(container, "flex flex-wrap items-center gap-14 py-24")}>
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
          <Eyebrow>DESIGN.md · Tailwind v4 · shadcn · DTCG tokens</Eyebrow>
          {/* DESIGN.md → Typography: the display style scales from 56px up to its 92px token. */}
          <h1
            className="m-0 text-display font-display"
            style={{ fontSize: "clamp(56px, 7vw, var(--text-display))" }}
          >
            Taste,
            <br />
            <Accent underline>exported.</Accent>
          </h1>
          <p className="m-0 max-w-[520px] text-body-lg font-body-lg text-ink-soft">
            Drop in the sites you love. Borrow the colors from one, the type from another. Get an
            original, accessible design system your AI agent actually follows.
          </p>
          <UrlInput />
          <p className="m-0 text-caption font-caption text-ink-subtle">
            No sign-up for your first blend. Works with Claude Code, Cursor and v0.
          </p>
        </div>

        {/* The stage panel: the blend is user content, so it sits on stage (DESIGN.md). */}
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 rounded-xl border border-hairline bg-stage p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ui-sm font-ui-sm">
              Blend · {blend.references.length} references
            </span>
            <span className="flex items-center gap-1.5 text-token font-token text-success">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M2.5 7.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              WCAG AA · {blend.passing.light}/{blend.passing.total} pairs
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {blend.references.map((ref) => (
              <li
                key={ref.label}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-input-border bg-surface px-3.5 py-3"
              >
                <span className="text-token font-token">{ref.label}</span>
                <span className="flex gap-1.5">
                  {ref.borrowed.map((tag) => (
                    <TagLabel key={tag}>{TAG_LABEL[tag]}</TagLabel>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 flex items-center gap-2.5 text-ui-sm font-ui-sm text-ink-muted">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 2v11M3.5 8.5L8 13l4.5-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Blended, contrast-fixed{blend.darkGenerated ? ", dark mode generated" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-hairline bg-surface p-4 sm:grid-cols-5">
            {blend.chips.map((chip) => (
              <PaintChip
                key={chip.name}
                name={chip.name}
                color={chip.color}
                hex={chip.hex}
                ink={blend.ink}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadsInto() {
  return (
    <section aria-label="Reads into" className="border-y border-hairline bg-surface-subtle">
      <AgentsStrip className={cn(container, "py-7")} />
    </section>
  );
}

/** The interactive demo (#try): the real blend and fix on our three sample sites. */
function TryIt({ blend }: { blend: HeroBlend }) {
  return (
    <section id="try" aria-labelledby="try-heading" className="bg-canvas">
      <div className={cn(container, "flex flex-col gap-8 py-26")}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Eyebrow tone="kiln">Try it · no sign-up</Eyebrow>
            <h2 id="try-heading" className="m-0 text-h2 font-h2">
              Borrow it. Blend it. Ship it.
            </h2>
          </div>
          <p className="m-0 max-w-[360px] text-body-sm font-body-sm text-ink-muted">
            Click a chip to borrow from a site, then drag the sliders. The preview and the DESIGN.md
            update live.
          </p>
        </div>
        <BlendDemo sites={blend.sites} />
      </div>
    </section>
  );
}

const STEPS = [
  [
    "01",
    "Paste",
    "Up to five sites. Each opens in a real browser that reads colors, type, spacing and shape.",
  ],
  [
    "02",
    "Borrow",
    "Tag what to take from each. Tune density, roundness, contrast and warmth. Lock what you love.",
  ],
  [
    "03",
    "Fix",
    "Every text pair is checked against WCAG AA and nudged only if it fails. Dark mode is generated.",
  ],
  [
    "04",
    "Export",
    "Drop DESIGN.md in your repo. Your agent reads it before it writes a single line of UI.",
  ],
] as const;

function HowItWorks() {
  return (
    <section id="how" className="border-y border-hairline bg-stage">
      <div className={cn(container, "flex flex-col gap-12 py-26")}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="m-0 max-w-[620px] text-h2 font-h2">
            From inspiration to instructions, in four steps.
          </h2>
          <p className="m-0 max-w-[380px] text-body-md font-body-md text-ink-muted">
            Thema reads real computed styles in a real browser. Every value is measured, never
            guessed.
          </p>
        </div>
        <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, title, text]) => (
            <li
              key={n}
              className="flex flex-col gap-3 rounded-lg border border-input-border bg-surface p-6"
            >
              <span className="flex items-center gap-3" aria-hidden="true">
                {/* Step 04 is Kiln. White on Kiln is only 4.01:1, so its number is ink (4.94:1). */}
                <span
                  className={cn(
                    "flex size-[26px] flex-none items-center justify-center rounded-full text-token font-token",
                    n === "04" ? "bg-primary text-ink" : "bg-ink text-canvas",
                  )}
                >
                  {n}
                </span>
                <span className="h-px flex-1 bg-pill-border" />
              </span>
              <h3 className="m-0 text-h4 font-h4">
                <span className="sr-only">Step {n}: </span>
                {title}
              </h3>
              <p className="m-0 text-caption font-caption text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Extraction({ blend }: { blend: HeroBlend }) {
  const { source, rows, result } = blend.read;
  return (
    <section id="exports" className="bg-canvas">
      <div className={cn(container, "flex flex-wrap items-center gap-14 py-26")}>
        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <Eyebrow tone="kiln">01 · Extraction</Eyebrow>
          <h2 className="m-0 text-h2 font-h2">
            Measured, not guessed<Accent>.</Accent>
          </h2>
          <p className="m-0 max-w-[460px] text-lead font-lead text-ink-muted">
            Thema opens each site in a real browser, closes cookie banners, scrolls every section
            into view and reads computed styles. Default link blues and hidden skip links don&apos;t
            fool it.
          </p>
        </div>
        {/* Rows are samples the browser recorded on the first sample site (hero-blend.ts). */}
        <div className="min-w-0 flex-[1_1_460px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
          <div className="flex justify-between gap-3 border-b border-divider bg-surface-subtle px-4 py-3 text-token font-token text-ink-subtle">
            <span>{source}</span>
            <span>reading styles…</span>
          </div>
          <dl className="m-0 flex flex-col gap-2 p-4 font-token text-token">
            {rows.map(([selector, value]) => (
              <div
                key={selector}
                className="flex justify-between gap-3 rounded-sm bg-surface-subtle px-2.5 py-2"
              >
                <dt className="text-ink-muted">{selector}</dt>
                <dd className="m-0 flex items-center gap-2">
                  {value.startsWith("background ") && (
                    <span
                      aria-hidden="true"
                      className="inline-block size-3 rounded-[3px]"
                      style={{ background: value.slice("background ".length) }}
                    />
                  )}
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 rounded-sm bg-primary-tint px-2.5 py-2 text-primary-deep">
              <dt>result</dt>
              <dd className="m-0">{result}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Fixed({ blend }: { blend: HeroBlend }) {
  const rows = blend.fixes.slice(0, 2);
  return (
    <section id="fixed" className="bg-band text-band-ink">
      <div className={cn(container, "flex flex-wrap items-center gap-14 py-26")}>
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-3 rounded-lg border border-band-hairline bg-band-surface p-6 text-token font-token">
          <div className="flex justify-between border-b border-band-hairline pb-2 text-band-ink-muted">
            <span>Pair</span>
            <span>Before → After</span>
          </div>
          {rows.map((f) => (
            <div key={`${f.theme}-${f.pair.join("-")}`} className="flex justify-between gap-3">
              <span>
                {pairName(f.pair)}
                {f.theme === "dark" ? " (dark)" : ""}
              </span>
              <span>
                <span className="text-dark-danger">{f.before.toFixed(1)}</span> →{" "}
                <span className="text-dark-success">{f.after.toFixed(1)} ✓</span>
              </span>
            </div>
          ))}
          {blend.passed.map((p) => (
            <div key={p.pair.join("-")} className="flex justify-between gap-3">
              <span>{pairName(p.pair)}</span>
              <span className="text-dark-success">{p.ratio.toFixed(1)} ✓</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-band-hairline pt-2 text-band-ink-muted">
            <span>Dark mode</span>
            <span className="text-band-ink">
              {blend.darkGenerated ? "generated" : "from the source"} · {blend.passing.dark}/
              {blend.passing.total} pass
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <Eyebrow tone="band">02 · Not just extracted. Fixed.</Eyebrow>
          <h2 className="m-0 text-h2 font-h2 text-band-ink">
            Borrowed colors that <span className="text-band-accent">pass</span>, every time.
          </h2>
          <p className="m-0 max-w-[460px] text-lead font-lead text-band-ink-soft">
            Thema checks every text and background pair against WCAG 2.2 AA, nudges only what fails,
            and generates a matching dark mode when your sources don&apos;t have one.
          </p>
        </div>
      </div>
    </section>
  );
}

const FILES = ["DESIGN.md", "theme.css", "shadcn.css", "tokens.json"] as const;

function Agents() {
  return (
    <section id="agents" className="bg-canvas">
      <div className={cn(container, "flex flex-wrap items-center gap-14 py-26")}>
        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
          <Eyebrow tone="kiln">03 · Agents</Eyebrow>
          <h2 className="m-0 text-h2 font-h2">
            Made for your agent<Accent>.</Accent>
          </h2>
          <p className="m-0 max-w-[460px] text-lead font-lead text-ink-muted">
            Export DESIGN.md, Tailwind v4, shadcn and DTCG tokens, or let Claude Code and Cursor
            call Thema directly through its MCP server.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {FILES.map((file) => (
              <li
                key={file}
                className="rounded-full border border-pill-border bg-surface-subtle px-2.5 py-1.5 text-token font-token"
              >
                {file}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 flex-[1_1_460px] rounded-xl border border-hairline bg-stage p-4">
          <div className="rounded-lg bg-band p-6 font-token text-token leading-[1.8] text-band-ink">
            <div className="text-band-ink-muted">› you</div>
            <div>
              Make the settings page match a blend of north.example colors and fieldnotes.example
              type.
            </div>
            <div className="mt-3 text-band-ink-muted">› agent</div>
            <div>
              <span className="text-band-accent">thema.blend</span>(2 references) … done
            </div>
            <div>
              <span className="text-band-accent">thema.get_design_md</span>() → DESIGN.md
            </div>
            <div>Updated 6 components to use role variables.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="start" className="bg-canvas">
      <div className={cn(container, "flex flex-col items-center gap-6 py-26 text-center")}>
        <h2 className="m-0 text-h2-lg font-h2-lg">
          Your agent has <Accent underline>taste</Accent> now.
        </h2>
        <p className="m-0 text-lead font-lead text-ink-muted">First blend free. No sign-up.</p>
        <a href="#top" className={buttonVariants({ variant: "primary" })}>
          Paste your first site
        </a>
      </div>
    </section>
  );
}

/** The Landing, "Premium White" (docs/landing-white.md and the canvas's Landing-white board). */
export function Landing({ blend }: { blend: HeroBlend }) {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero blend={blend} />
        <ReadsInto />
        <TryIt blend={blend} />
        <HowItWorks />
        <Extraction blend={blend} />
        <Fixed blend={blend} />
        <Agents />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
