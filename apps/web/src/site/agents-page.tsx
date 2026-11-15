// For agents (docs/pages.md): what an agent gets from Thema, the three MCP tools (as in
// packages/mcp/README.md) and the setup commands the Export screen gives.
import { CHECKED_PAIRS } from "@thema/engine";
import { AgentsStrip } from "@/components/agents-strip";
import { buttonVariants } from "@/components/button";
import { Accent, Band, ClosingCta, container, Eyebrow, PageHero } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { GITHUB_URL, GitHubLink, SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { SetupTabs } from "./setup-tabs";

/** The MCP server's tools, as packages/mcp/README.md describes them. */
export const TOOLS = [
  [
    "extract",
    "A url, and optionally an out_path.",
    "A system_id, a short summary (palette hex, fonts, spacing base, radius, WCAG AA pass counts) and warnings in words. Local and private addresses are refused.",
  ],
  [
    "blend",
    "1–5 references (a system_id or system_path, plus the parts each lends), the sliders density, roundness, contrast and warmth (−1 to 1), and locks.",
    "A new system_id and summary, the number of contrast fixes, the generated theme, and any pairs that couldn't be fixed, with why.",
  ],
  [
    "get_design_md",
    "A system_id or system_path, and optionally an out_path.",
    "The DESIGN.md text; with out_path, also written there.",
  ],
] as const;

/** The hero terminal: an agent using the three tools (an illustration of a session). */
const SESSION: [string, string][] = [
  ["you", "Restyle the app: colors from north.example, type from fieldnotes.example."],
  ["agent", 'thema.extract("north.example") → sys_1'],
  ["agent", 'thema.extract("fieldnotes.example") → sys_2'],
  ["agent", "thema.blend(sys_1: colors, sys_2: typography) → sys_3"],
  ["thema", `${CHECKED_PAIRS.length}/${CHECKED_PAIRS.length} pairs pass WCAG AA, light and dark`],
  ["agent", 'thema.get_design_md(sys_3, out_path: "DESIGN.md")'],
  ["agent", "Wrote DESIGN.md. Updating components to follow it."],
];

export function AgentsPage() {
  return (
    <>
      <SiteHeader current="/agents" />
      <main>
        <section className="bg-canvas">
          <div className={cn(container, "grid items-center gap-14 py-24 lg:grid-cols-2")}>
            <PageHero
              eyebrow="For agents"
              title={
                <>
                  Your agent, now with <Accent underline>taste.</Accent>
                </>
              }
              subhead="Give Claude Code, Cursor and the rest a design system to follow: a DESIGN.md in your repo, or Thema itself as an MCP server they can call mid-task."
            >
              <div className="flex flex-wrap gap-3">
                <a href="#setup" className={buttonVariants({ variant: "primary" })}>
                  Set up the MCP server
                </a>
                <GitHubLink
                  label="View on GitHub"
                  className={cn(buttonVariants({ variant: "ghost" }), "gap-1")}
                />
              </div>
            </PageHero>
            <div className="rounded-xl bg-stage p-4">
              <pre
                aria-label="An agent using Thema's tools"
                className="m-0 overflow-hidden rounded-lg bg-band p-6 text-token font-token leading-[1.8] whitespace-pre-wrap text-band-ink"
              >
                {SESSION.map(([who, line], i) => (
                  <span key={i} className="block">
                    <span
                      className={cn(
                        who === "you" && "text-band-ink-soft",
                        who === "agent" && "text-band-ink-muted",
                        who === "thema" && "text-band-accent",
                      )}
                    >
                      {who} ›{" "}
                    </span>
                    <span className={cn(line.startsWith("thema.") && "text-band-accent")}>
                      {line}
                    </span>
                  </span>
                ))}
              </pre>
            </div>
          </div>
        </section>

        <section aria-label="Reads into" className="border-t border-hairline bg-surface-subtle">
          <AgentsStrip href="#setup" className={cn(container, "py-7")} />
        </section>

        <Band label="Two ways in" className="flex flex-col gap-10">
          <h2 className="m-0 text-h2 font-h2">Two ways in.</h2>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {[
              [
                "No setup",
                "Drop DESIGN.md in your repo",
                "Export from Thema and commit the file. Every agent that reads your repo follows its tokens and rules, with nothing to install.",
              ],
              [
                "MCP",
                "Let your agent call Thema",
                "Add the MCP server and your agent can extract sites, blend them and fetch DESIGN.md itself, mid-task.",
              ],
            ].map(([tag, title, text]) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-6"
              >
                <span className="w-fit rounded-full border border-pill-border px-2.5 py-1 text-token font-token text-ink-subtle">
                  {tag}
                </span>
                <h3 className="m-0 text-h4 font-h4">{title}</h3>
                <p className="m-0 text-body-sm font-body-sm text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Band>

        <Band tone="subtle" label="The tools" className="flex flex-col gap-10">
          <h2 className="m-0 text-h2 font-h2">
            Three tools. That&apos;s the whole <Accent>API</Accent>.
          </h2>
          <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-3">
            {TOOLS.map(([name, takes, returns]) => (
              <li
                key={name}
                className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-6"
              >
                <h3 className="m-0 text-token font-token text-primary-strong">{name}</h3>
                <dl className="m-0 flex flex-col gap-2 text-body-sm font-body-sm">
                  <dt className="text-ink-subtle">Takes</dt>
                  <dd className="m-0 text-ink-muted">{takes}</dd>
                  <dt className="text-ink-subtle">Returns</dt>
                  <dd className="m-0 text-ink-muted">{returns}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </Band>

        <Band
          id="setup"
          label="Setup"
          className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          <div className="flex flex-col gap-4">
            <Eyebrow tone="kiln">Setup</Eyebrow>
            <h2 className="m-0 text-h2 font-h2">One command.</h2>
            <p className="m-0 text-lead font-lead text-ink-muted">
              Pick your client. The MCP server runs on your machine over stdio and needs no account;
              extraction uses a local Chromium behind the same address guard as Thema&apos;s
              servers.
            </p>
          </div>
          <SetupTabs />
        </Band>

        <Band tone="band" label="Open source" className="flex flex-col items-start gap-6">
          <Eyebrow tone="band">Open source · MIT</Eyebrow>
          <h2 className="m-0 max-w-[22ch] text-h2 font-h2 text-band-ink">
            The engine is <Accent>yours</Accent> to read.
          </h2>
          <p className="m-0 max-w-[620px] text-lead font-lead text-band-ink-soft">
            The CLI, the MCP server and everything they run on, from extraction to the fixer and the
            exporters, are MIT licensed.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <GitHubLink
              label="Star on GitHub"
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-canvas px-5 text-body-md font-body-md text-ink no-underline"
            />
            <code className="text-token font-token text-band-ink-muted">
              {GITHUB_URL.replace("https://", "")}
            </code>
          </div>
        </Band>

        <ClosingCta
          title={
            <>
              Give your agent some <Accent underline>taste.</Accent>
            </>
          }
          line="Blend in the browser first: no sign-up."
          action="Paste your first site"
        />
      </main>
      <SiteFooter />
    </>
  );
}
