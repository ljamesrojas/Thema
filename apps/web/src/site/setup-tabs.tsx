"use client";

import { useId, useState } from "react";
import { Choice } from "@/components/choice";
import { SNIPPETS } from "@/lib/exports-meta";

/** Tab names for the Export screen's snippets, in the same order. */
const TABS = ["Claude Code", "Cursor", "CLI"] as const;
type Tab = (typeof TABS)[number];

/**
 * For agents → Setup (docs/pages.md): one tab per client, each showing the exact commands the
 * Export screen gives (the same SNIPPETS list), until the npm package ships.
 */
export function SetupTabs() {
  const id = useId();
  const [tab, setTab] = useState<Tab>("Claude Code");
  const index = TABS.indexOf(tab);
  const [label, text] = SNIPPETS[index] ?? SNIPPETS[0];
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-fit">
        <Choice
          label="Set up for"
          value={tab}
          options={TABS.map((t) => [t, t] as const)}
          onChange={(t) => {
            setTab(t);
            setCopied(false);
          }}
        />
      </div>
      <section
        aria-labelledby={`${id}-label`}
        className="flex flex-col overflow-hidden rounded-lg bg-band text-band-ink"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-band-hairline px-4 py-2">
          <h3 id={`${id}-label`} className="m-0 text-token font-token text-band-ink-soft">
            {label}
          </h3>
          <span className="flex items-center gap-2">
            <span role="status" className="text-ui-sm font-ui-sm text-band-accent">
              {copied ? "Copied" : ""}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={`Copy the ${tab} setup`}
              className="min-h-11 cursor-pointer rounded-full border border-band-hairline bg-band-surface px-4 text-ui-sm font-ui-sm text-band-ink"
            >
              Copy
            </button>
          </span>
        </div>
        <pre
          data-testid="setup-code"
          className="m-0 px-4 py-5 text-token font-token leading-[1.7] break-all whitespace-pre-wrap"
        >
          {text}
        </pre>
        <p className="m-0 border-t border-band-hairline px-4 py-3 text-ui-sm font-ui-sm text-band-ink-soft">
          Until the npm package ships, run it from a clone of the repo: replace /path/to/thema with
          where you cloned it.
        </p>
      </section>
    </div>
  );
}
