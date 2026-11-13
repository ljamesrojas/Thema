import type { ColorRole } from "@thema/engine";
import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";
import { PaintChip } from "@/components/paint-chip";
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

/** The serif accent word: one per headline (DESIGN.md → Typography). */
function Accent({ children, underline = false }: { children: string; underline?: boolean }) {
  return (
    <span
      className={cn(
        "font-display-accent italic font-normal tracking-[-0.01em]",
        underline && "border-b-4 border-primary",
      )}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn("m-0 text-eyebrow font-eyebrow uppercase text-ink-muted", className)}>
      {children}
    </p>
  );
}

const container = "mx-auto max-w-[1200px] px-8";

function Nav() {
  return (
    <header className="border-b border-hairline">
      <nav
        aria-label="Main"
        className={cn(container, "flex flex-wrap items-center justify-between gap-4 py-4.5")}
      >
        <a href="#top" className="flex items-center gap-2.5 text-ink no-underline">
          <Logo />
          <span className="text-[20px] font-semibold tracking-[-0.02em]">Thema</span>
        </a>
        <div className="flex flex-wrap gap-7 text-[15px]">
          {[
            ["#how", "How it works"],
            ["#exports", "Exports"],
            ["#agents", "For agents"],
            ["#pricing", "Pricing"],
            ["#github", "GitHub"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="text-ink no-underline">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="#signin" className="px-3.5 py-2.5 text-[15px] text-ink no-underline">
            Sign in
          </a>
          <a href="#start" className={buttonVariants({ variant: "secondary" })}>
            Start blending
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero({ blend }: { blend: HeroBlend }) {
  return (
    <section id="top" className={cn(container, "flex flex-wrap items-center gap-14 pt-22 pb-18")}>
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
        <Eyebrow>DESIGN.md · Tailwind v4 · shadcn · DTCG tokens</Eyebrow>
        <h1 className="m-0 text-display font-display">
          Taste,
          <br />
          <Accent underline>exported.</Accent>
        </h1>
        <p className="m-0 max-w-[520px] text-body-lg font-body-lg text-ink-soft">
          Drop in the sites you love. Borrow the colors from one, the type from another. Get an
          original, accessible design system your AI agent actually follows.
        </p>
        <UrlInput />
        <p className="m-0 text-[14px] text-ink-muted">
          No sign-up for your first blend. Works with Claude Code, Cursor and v0.
        </p>
      </div>

      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 rounded-xl border border-hairline bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">
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
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-hairline bg-canvas px-3.5 py-3"
            >
              <span className="text-[13px] font-token">{ref.label}</span>
              <span className="flex gap-1.5">
                {ref.borrowed.map((tag) => (
                  <TagLabel key={tag}>{TAG_LABEL[tag]}</TagLabel>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 flex items-center gap-2.5 text-[13px] text-ink-muted">
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
        {/* User content sits on the stage, never on cream (DESIGN.md). */}
        <div className="grid grid-cols-2 gap-2.5 rounded-[14px] bg-stage p-4 sm:grid-cols-5">
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
    </section>
  );
}

function ReadsInto() {
  return (
    <section aria-label="Works with" className="border-y border-hairline">
      <div
        className={cn(
          container,
          "flex flex-wrap items-center justify-between gap-x-10 gap-y-3 py-6 text-[15px] text-ink-muted",
        )}
      >
        <span className="text-token font-token uppercase tracking-eyebrow">Reads into</span>
        {[
          "Claude Code",
          "Cursor",
          "v0",
          "Lovable",
          "Windsurf",
          "GitHub Copilot",
          "Google Stitch",
        ].map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  [
    "01",
    "Paste up to five sites",
    "Thema opens each one in a real browser and samples colors, type, spacing, radius and shadows from what's on screen.",
  ],
  [
    "02",
    "Borrow what you like",
    "Tag each site with what to take from it. Tune density, roundness, contrast and warmth. Lock any token you love.",
  ],
  [
    "03",
    "Export for your agent",
    "Drop DESIGN.md in your repo root. Your agent reads it before it writes a single line of UI.",
  ],
] as const;

function HowItWorks() {
  return (
    <section id="how" className={cn(container, "flex flex-col gap-12 py-26")}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="m-0 max-w-[640px] text-h2 font-h2">
          Three steps from <Accent>inspiration</Accent> to instructions.
        </h2>
        <p className="m-0 max-w-[380px] text-[17px] leading-[1.55] text-ink-soft">
          Thema reads real computed styles, not screenshots. Every hex is measured, never guessed.
        </p>
      </div>
      <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-3">
        {STEPS.map(([n, title, text]) => (
          <li
            key={n}
            className="flex flex-col gap-3.5 rounded-lg border border-hairline bg-surface p-7"
          >
            <span className="text-[13px] font-token text-primary-strong">{n}</span>
            <h3 className="m-0 text-h3 font-h3">{title}</h3>
            <p className="m-0 text-body-md font-body-md text-ink-soft">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Fixed({ blend }: { blend: HeroBlend }) {
  const rows = blend.fixes.slice(0, 2);
  return (
    <section className="bg-dark-canvas text-dark-ink">
      <div className={cn(container, "flex flex-wrap items-center gap-14 py-26")}>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <Eyebrow className="text-dark-ink-muted">Not just extracted. Fixed.</Eyebrow>
          <h2 className="m-0 text-h2 font-h2">
            Borrowed colors that{" "}
            <span className="font-display-accent italic font-normal text-dark-primary">pass</span>,
            every time.
          </h2>
          <p className="m-0 max-w-[460px] text-[17px] leading-[1.6] text-dark-ink-soft">
            Thema checks every text and background pair against WCAG 2.2 AA, nudges only what fails,
            and generates a matching dark mode when your sources don&apos;t have one.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-3 rounded-lg border border-dark-hairline bg-dark-surface p-6 font-token text-[14px]">
          <div className="flex justify-between border-b border-dark-hairline pb-2 text-[12px] text-dark-ink-muted">
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
          <div className="flex justify-between border-t border-dark-hairline pt-2 text-dark-ink-muted">
            <span>Dark mode</span>
            <span className="text-dark-ink">
              {blend.darkGenerated ? "generated" : "from the source"} · {blend.passing.dark}/
              {blend.passing.total} pass
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const FORMATS = [
  ["DESIGN.md", "Tokens plus plain-language rules for agents"],
  ["theme.css", "Tailwind v4 @theme block"],
  ["shadcn.css", "Light and dark variables, shadcn naming"],
  ["tokens.json", "W3C DTCG for Style Dictionary and Figma"],
  ["style-guide.html", "A page to share with your team"],
] as const;

function Exports() {
  return (
    <section id="exports" className={cn(container, "flex flex-col gap-10 py-26")}>
      <h2 className="m-0 max-w-[720px] text-h2 font-h2">
        One system. Every format your stack reads.
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-5">
        {FORMATS.map(([file, text]) => (
          <li
            key={file}
            className="flex min-h-[140px] flex-col gap-2 rounded-[14px] border border-hairline bg-surface p-5"
          >
            <span className="text-[14px] font-medium font-token">{file}</span>
            <span className="text-[14px] leading-[1.5] text-ink-muted">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Agents() {
  return (
    <section id="agents" className={cn(container, "pb-26")}>
      <div className="flex flex-wrap items-center gap-10 rounded-xl border border-hairline bg-surface p-12">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <h2 className="m-0 text-[40px] leading-[1.08] font-semibold tracking-[-0.03em]">
            Or let your agent <Accent>ask</Accent> for it.
          </h2>
          <p className="m-0 text-[17px] leading-[1.55] text-ink-soft">
            Thema runs as an MCP server. Your agent can extract, blend and fetch DESIGN.md without
            leaving the task.
          </p>
          <a href="#mcp" className="text-body-md font-medium">
            Set up the MCP server →
          </a>
        </div>
        <div className="min-w-0 flex-[1_1_480px] rounded-[14px] bg-ink p-6 font-token text-[14px] leading-[1.8] text-canvas">
          <div className="text-dark-ink-muted">› you</div>
          <div>
            Make the settings page match a blend of north.example colors and fieldnotes.example
            type.
          </div>
          <div className="mt-3 text-dark-ink-muted">› agent</div>
          <div>
            <span className="text-dark-primary">thema.blend</span>(2 references) … done
          </div>
          <div>
            <span className="text-dark-primary">thema.get_design_md</span>() → DESIGN.md
          </div>
          <div>Updated 6 components to use role variables.</div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="start" className="border-t border-hairline">
      <div className={cn(container, "flex flex-col items-center gap-6 py-26 text-center")}>
        <h2 className="m-0 text-[64px] leading-none font-semibold tracking-[-0.035em]">
          Your agent has <Accent underline>taste</Accent> now.
        </h2>
        <p className="m-0 text-[18px] text-ink-soft">First blend free. No sign-up.</p>
        <a href="#top" className={buttonVariants({ variant: "primary" })}>
          Paste your first site
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div
        className={cn(
          container,
          "flex flex-wrap justify-between gap-4 py-8 text-[14px] text-ink-muted",
        )}
      >
        <span>© 2026 Thema</span>
        <span className="flex gap-6">
          {["Docs", "GitHub", "Privacy"].map((label) => (
            <a key={label} href={`#${label.toLowerCase()}`} className="text-ink-muted">
              {label}
            </a>
          ))}
        </span>
      </div>
    </footer>
  );
}

/** The Landing page, from the approved mockup (SPEC.md → Screens). */
export function Landing({ blend }: { blend: HeroBlend }) {
  return (
    <>
      <Nav />
      <main>
        <Hero blend={blend} />
        <ReadsInto />
        <HowItWorks />
        <Fixed blend={blend} />
        <Exports />
        <Agents />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
