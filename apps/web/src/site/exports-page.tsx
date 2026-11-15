// Exports (docs/pages.md, docs/mockups/exports.png): the five files, shown as the exporters write
// them for the sample system (the Landing hero's blend of three .example fixtures). Computed when
// the page is built.
import { exportAll } from "@thema/exporters";
import type { ReactNode } from "react";
import { Accent, Band, ClosingCta, container, Eyebrow, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { sampleSystem } from "@/lib/hero-blend";
import { FileExplorer } from "./file-explorer";

/** The three commands from packages/cli/README.md, each with what it does. */
export const CLI_COMMANDS = [
  ["a site → its system", "thema extract https://example.com --out north.json"],
  [
    "up to five systems → one, fixed to WCAG AA",
    "thema blend north.json=colors,shape notes.json=typography --density 0.2 --out blend.json",
  ],
  ["all five files", "thema export --in blend.json --format all --out design"],
] as const;

const icon = {
  "aria-hidden": true,
  viewBox: "0 0 20 20",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The "Built in" cards' line icons: a document, a moon, a checked circle, stacked layers. */
const BUILT_IN: [ReactNode, string, string][] = [
  [
    <svg key="doc" {...icon}>
      <path d="M5 2.5h6.5L15 6v11.5H5z" />
      <path d="M11.5 2.5V6H15M8 10h4M8 13h4" />
    </svg>,
    "Where it came from",
    "A header comment names the Thema version and every source site.",
  ],
  [
    <svg key="moon" {...icon}>
      <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />
    </svg>,
    "Dark mode included",
    "Measured from the site or generated, then checked again for contrast.",
  ],
  [
    <svg key="check" {...icon}>
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10 2 2 4-4" />
    </svg>,
    "WCAG AA colors",
    "Every text pair passes 2.2 AA, in light and in dark.",
  ],
  [
    <svg key="layers" {...icon}>
      <path d="m10 3 7 3.5-7 3.5-7-3.5z" />
      <path d="m3 10 7 3.5 7-3.5M3 13.5 10 17l7-3.5" />
    </svg>,
    "Spec-clean",
    "DESIGN.md passes Google's design.md linter with no errors.",
  ],
];

const KEY = "text-band-accent";
const COMMENT = "text-band-ink-muted";

/**
 * Lines in the tallest snippet below (the folder tree). Every snippet is at least this tall, so
 * the three black blocks start on the same line.
 */
const PLACE_CODE_LINES = 4;

/** Where each file goes: the line that matters is in the band accent. */
const PLACES: [string, string, string, ReactNode][] = [
  [
    "01",
    "DESIGN.md in your repo root",
    "Your agent reads it before it writes UI, next to AGENTS.md or CLAUDE.md.",
    <>
      <span className={COMMENT}>my-app/</span>
      {"\n├ "}
      <span className={KEY}>DESIGN.md</span>
      {"\n├ AGENTS.md\n└ src/"}
    </>,
  ],
  [
    "02",
    "theme.css after Tailwind",
    "Import it in your global stylesheet. Utilities like bg-primary just work.",
    <>
      <span className={COMMENT}>/* globals.css */</span>
      {'\n@import "tailwindcss";\n'}
      <span className={KEY}>@import &quot;./theme.css&quot;;</span>
    </>,
  ],
  [
    "03",
    "shadcn.css over the defaults",
    "It replaces the :root and .dark variables, so every component restyles.",
    <>
      <span className={COMMENT}>/* globals.css */</span>
      {"\n"}
      <span className={KEY}>@import &quot;./shadcn.css&quot;;</span>
      {"\n"}
      <span className={COMMENT}>/* remove the old :root and .dark */</span>
    </>,
  ],
];

export function ExportsPage() {
  const files = exportAll(sampleSystem());

  return (
    <>
      <SiteHeader current="/exports" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "flex flex-col gap-14 py-24")}>
            <PageHero
              split
              eyebrow="Exports"
              title={
                <>
                  Five files. <br />
                  <Accent underline>One</Accent> system.
                </>
              }
              subhead="Every file is generated from the same tokens, so they never disagree. Download them all as a zip, or copy the one you need."
            />
            <FileExplorer files={files} />
          </div>
        </section>

        <Band tone="subtle" label="Built in to every file" className="flex flex-col gap-10">
          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
            <h2 className="m-0 text-h2 font-h2">Built in to every file.</h2>
            <p className="m-0 text-body-md font-body-md text-ink-muted">
              Whichever format your stack reads, you get the same guarantees.
            </p>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {BUILT_IN.map(([svg, title, text]) => (
              <li
                key={title}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-6"
              >
                <span className="mb-2 text-primary-strong">{svg}</span>
                <h3 className="m-0 text-h4 font-h4">{title}</h3>
                <p className="m-0 text-body-sm font-body-sm text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Band>

        <Band label="Three files, three places" className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Eyebrow tone="kiln">Drop-in</Eyebrow>
            <h2 className="m-0 text-h2 font-h2">Three files, three places.</h2>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {PLACES.map(([n, title, text, code]) => (
              <li
                key={n}
                className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface"
              >
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <span className="text-token font-token text-ink-subtle">{n}</span>
                  <h3 className="m-0 text-h4 font-h4">{title}</h3>
                  <p className="m-0 text-body-sm font-body-sm text-ink-muted">{text}</p>
                </div>
                <pre
                  className="m-0 bg-band px-6 py-5 text-token font-token leading-[1.75] whitespace-pre-wrap text-band-ink"
                  style={{ minHeight: `calc(${PLACE_CODE_LINES}lh + 2.5rem)` }}
                >
                  {code}
                </pre>
              </li>
            ))}
          </ul>
        </Band>

        <Band tone="band" label="thema.json" className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Eyebrow tone="band">thema.json</Eyebrow>
            <h2 className="m-0 text-h2 font-h2 text-band-ink">
              Take the whole system <span className="text-band-accent">with you</span>.
            </h2>
            <p className="m-0 text-lead font-lead text-band-ink-soft">
              Download thema.json from the Export screen and keep working in your terminal. The
              open-source CLI uses the same engine and writes the same five files.
            </p>
            <a
              href="/agents"
              className="flex min-h-11 w-fit items-center text-label-md font-label-md text-band-accent"
            >
              CLI and MCP setup →
            </a>
          </div>
          <pre
            role="region"
            aria-label="The CLI's three commands"
            tabIndex={0}
            className="m-0 min-w-0 overflow-x-auto rounded-lg border border-band-hairline bg-band-surface p-6 text-token font-token leading-[1.9] whitespace-pre text-band-ink"
          >
            {CLI_COMMANDS.map(([comment, command]) => (
              <span key={command} className="block">
                <span className={COMMENT}># {comment}</span>
                {"\n"}
                <span className={KEY}>thema</span>
                {command.slice("thema".length)}
              </span>
            ))}
          </pre>
        </Band>

        <ClosingCta
          title={
            <>
              Get your <Accent underline>five</Accent> files.
            </>
          }
          line="First blend free. No sign-up."
          action="Paste your first site"
        />
      </main>
      <SiteFooter />
    </>
  );
}
