// Exports (docs/pages.md): the five files, shown as the exporters write them for the sample
// system (the Landing hero's blend of three .example fixtures). Computed when the page is built.
import { CHECKED_PAIRS } from "@thema/engine";
import { exportAll } from "@thema/exporters";
import { Accent, Band, ClosingCta, container, Eyebrow, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { sampleSystem } from "@/lib/hero-blend";
import { FileExplorer } from "./file-explorer";

/** The three commands from packages/cli/README.md. */
export const CLI_COMMANDS = [
  "thema extract https://example.com --out north.json",
  "thema blend north.json=colors,shape notes.json=typography --density 0.2 --out blend.json",
  "thema export --in blend.json --format all --out design",
] as const;

const PLACES = [
  [
    "DESIGN.md",
    "In your repo root, where Claude Code, Cursor and the others look before they write UI.",
    "./DESIGN.md",
  ],
  [
    "theme.css",
    "Imported after Tailwind, so bg-primary, text-ink and rounded-md are your system's.",
    '@import "tailwindcss";\n@import "./theme.css";',
  ],
  [
    "shadcn.css",
    "In place of the :root and .dark blocks shadcn/ui put in your global stylesheet.",
    '/* globals.css */\n@import "./shadcn.css";',
  ],
] as const;

export function ExportsPage() {
  const files = exportAll(sampleSystem());

  return (
    <>
      <SiteHeader current="/exports" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "flex flex-col gap-14 py-24")}>
            <PageHero
              eyebrow="Exports"
              title={
                <>
                  Five files. <Accent underline>One</Accent> system.
                </>
              }
              subhead="Every file comes from the same blended, fixed system: one for your agent, three for your code, one for your team. Here they are for a sample blend of three example sites."
            />
            <FileExplorer files={files} />
          </div>
        </section>

        <Band tone="subtle" label="Built in to every file" className="flex flex-col gap-10">
          <h2 className="m-0 text-h2 font-h2">Built in to every file.</h2>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Where it came from",
                "A header names Thema and the sites each part was borrowed from.",
              ],
              [
                "Dark mode included",
                "Light and dark in every file; when a site has no dark theme, one is generated.",
              ],
              [
                "WCAG AA colors",
                `All ${CHECKED_PAIRS.length} checked text and background pairs pass, in both themes.`,
              ],
              ["Spec-clean", "DESIGN.md passes Google's design.md linter with no errors."],
            ].map(([title, text]) => (
              <li
                key={title}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-6"
              >
                <h3 className="m-0 text-h4 font-h4">{title}</h3>
                <p className="m-0 text-body-sm font-body-sm text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Band>

        <Band label="Three files, three places" className="flex flex-col gap-10">
          <h2 className="m-0 text-h2 font-h2">Three files, three places.</h2>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {PLACES.map(([name, text, code]) => (
              <li
                key={name}
                className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface"
              >
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <h3 className="m-0 text-token font-token">{name}</h3>
                  <p className="m-0 text-body-sm font-body-sm text-ink-muted">{text}</p>
                </div>
                <pre className="m-0 bg-band px-6 py-4 text-token font-token whitespace-pre-wrap text-band-ink">
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
              Take the whole system <Accent>with you</Accent>.
            </h2>
            <p className="m-0 text-lead font-lead text-band-ink-soft">
              Download thema.json from the Export screen and keep going in the terminal or in your
              agent: the open-source CLI and the MCP server read and write the same file.
            </p>
            <a
              href="/agents"
              className="flex min-h-11 w-fit items-center text-label-md font-label-md text-band-link"
            >
              Set it up for your agent →
            </a>
          </div>
          <pre className="m-0 overflow-x-auto rounded-lg border border-band-hairline bg-band-surface p-6 text-token font-token leading-[1.8] whitespace-pre-wrap text-band-ink">
            {CLI_COMMANDS.join("\n")}
          </pre>
        </Band>

        <ClosingCta
          title={
            <>
              Get your <Accent underline>five</Accent> files.
            </>
          }
          line="Paste a site, blend, and download the zip."
          action="Paste your first site"
        />
      </main>
      <SiteFooter />
    </>
  );
}
