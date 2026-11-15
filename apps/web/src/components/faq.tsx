"use client";

import { useId, useState } from "react";
import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";
import styles from "./faq.module.css";

export const QUESTIONS: [string, string][] = [
  [
    "Is Thema a site cloner?",
    "No. Thema measures colors, type, spacing, radius and shadows on several sites and blends them into one original system. It never copies logos, images, layouts or copy, and every exported file names its sources.",
  ],
  [
    "Which formats can I export?",
    "DESIGN.md, a Tailwind v4 theme, shadcn/ui variables, W3C DTCG tokens.json and a style-guide page. Download them all as a zip or copy any single file.",
  ],
  [
    "What about paid fonts?",
    "Thema records font family names, never font files. If a reference uses a paid font, your export names it with fallbacks; license it or swap in another family before you ship.",
  ],
  [
    "Do I need an account?",
    "Your first blend works without sign-up. Sign in with GitHub or Google to keep saved projects. The CLI and MCP server run on your own machine and need no account.",
  ],
  [
    "Which agents can read it?",
    "Any agent that reads files from your repo: Claude Code, Cursor, v0, Lovable, Windsurf, GitHub Copilot, Google Stitch and Google Antigravity. Thema also runs as an MCP server, so an agent can blend and fetch DESIGN.md mid-task.",
  ],
];

/** The serif italic period after "Questions, answered" (one accent per headline). */
function Period() {
  return <span className="font-display-accent italic font-normal">.</span>;
}

/** FAQ: all closed at first, one item open at a time. Real buttons with aria-expanded. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <section id="faq" className={cn(styles.band, "border-y border-hairline")}>
      {/* docs/landing-white.md → FAQ: a 5/7 grid whose columns stretch to equal height, so both
          start and end on the same line; one column below ~900px. */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-8 py-26 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:gap-16">
        <div className="flex min-w-0 flex-col justify-between gap-10">
          <div className="flex flex-col gap-5">
            <p className="m-0 text-eyebrow font-eyebrow uppercase text-primary-strong">FAQ</p>
            <h2 className="m-0 text-h2 font-h2">
              Questions, answered
              <Period />
            </h2>
            <p className="m-0 text-body-md font-body-md text-ink-muted">
              The short version of how Thema reads sites, what it exports, and what it never copies.
            </p>
          </div>
          {/* No card: the accordion is the section's only card. Pushed to the bottom, it lines up
              with the bottom of the accordion. */}
          <div
            data-testid="faq-still-curious"
            className="flex flex-col gap-3 border-t border-pill-border pt-6"
          >
            <p className="m-0 text-label-md font-label-md font-semibold">Still curious?</p>
            <p className="m-0 text-caption font-caption text-ink-muted">
              Read the docs or ask us on GitHub.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <a href="#docs" className={buttonVariants({ variant: "secondary" })}>
                Read the docs
              </a>
              <a href="#github" className={buttonVariants({ variant: "ghost" })}>
                Ask on GitHub
              </a>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-hairline bg-surface px-6 py-1 shadow-accordion">
          {QUESTIONS.map(([question, answer], index) => {
            const isOpen = open === index;
            const buttonId = `${id}-q${index}`;
            const panelId = `${id}-a${index}`;
            return (
              <div key={question} className={cn(index > 0 && "border-t border-divider")}>
                <h3 className="m-0">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-4.5 text-left text-ink"
                  >
                    <span
                      className={cn(
                        "w-6 flex-none text-token font-token",
                        isOpen ? "text-primary-strong" : "text-ink-subtle",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-title-sm font-title-sm">{question}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex-none text-title-sm font-title-sm",
                        isOpen ? "text-primary-strong" : "text-ink-faint",
                      )}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-5 pl-9 text-body-sm font-body-sm text-ink-muted"
                >
                  {answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
