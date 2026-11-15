"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { EXPORT_FILES, type ExportFile } from "@/lib/exports-meta";

/** Per file: the extension tile, one sentence under the panel, and the format's name. */
const DETAILS: Record<ExportFile, { tile: string; note: string; format: string }> = {
  "DESIGN.md": {
    tile: "MD",
    note: "Tokens up top, then plain-language rules your agent reads before it writes UI.",
    format: "Google design.md",
  },
  "theme.css": {
    tile: "CSS",
    note: "Import it after Tailwind and every utility uses your colors, type, radius and spacing.",
    format: "Tailwind v4 @theme",
  },
  "shadcn.css": {
    tile: "CSS",
    note: "Every shadcn/ui variable, light and dark, in the names shadcn expects.",
    format: "shadcn/ui theme",
  },
  "tokens.json": {
    tile: "JSON",
    note: "For Style Dictionary, Figma plugins and anything else that reads the W3C format.",
    format: "W3C DTCG",
  },
  "style-guide.html": {
    tile: "HTML",
    note: "One self-contained page to share with your team: no scripts, nothing loaded from elsewhere.",
    format: "HTML",
  },
};

/**
 * Exports (docs/pages.md): the five files as the exporters wrote them for the sample system.
 * `files` comes from exportAll on the server; nothing here is hand-written.
 */
export function FileExplorer({ files }: { files: Record<string, string> }) {
  const id = useId();
  const [selected, setSelected] = useState<ExportFile>("DESIGN.md");
  const [copied, setCopied] = useState(false);
  const content = files[selected] ?? "";
  const details = DETAILS[selected];

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <ul aria-label="Files" className="m-0 flex list-none flex-col gap-2 p-0">
        {EXPORT_FILES.map(([name, description]) => (
          <li key={name}>
            <button
              type="button"
              aria-pressed={selected === name}
              onClick={() => {
                setSelected(name);
                setCopied(false);
              }}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-left",
                selected === name
                  ? "border-ink bg-surface"
                  : "border-hairline bg-surface-subtle hover:bg-surface",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-12 flex-none items-center justify-center rounded-sm text-token font-token",
                  selected === name ? "bg-ink text-canvas" : "bg-stage text-ink",
                )}
              >
                {DETAILS[name].tile}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-token font-token text-ink">{name}</span>
                <span className="text-ui-sm font-ui-sm text-ink-muted">{description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby={`${id}-file`}
        className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-band text-band-ink"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-band-hairline px-4 py-2">
          <span className="flex items-center gap-3">
            <h2 id={`${id}-file`} className="m-0 text-token font-token">
              {selected}
            </h2>
            <span className="rounded-full border border-band-hairline px-2 py-0.5 text-token font-token text-band-ink-muted">
              sample output
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span role="status" className="text-ui-sm font-ui-sm text-band-accent">
              {copied ? "Copied" : ""}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={`Copy ${selected}`}
              className="min-h-11 cursor-pointer rounded-full border border-band-hairline bg-band-surface px-4 text-ui-sm font-ui-sm text-band-ink"
            >
              Copy
            </button>
          </span>
        </div>

        {selected === "style-guide.html" ? (
          <iframe
            title="style-guide.html, rendered"
            sandbox=""
            srcDoc={content}
            data-testid="style-guide-frame"
            className="h-[560px] w-full border-0 bg-canvas"
          />
        ) : (
          <pre
            tabIndex={0}
            aria-label={`${selected} sample output`}
            data-testid="code"
            className="m-0 max-h-[560px] overflow-auto py-4 text-token font-token leading-[1.6]"
          >
            <code className="block">
              {content.split("\n").map((line, i) => (
                <span key={i} className="flex">
                  <span
                    aria-hidden="true"
                    className="w-12 flex-none pr-4 text-right text-band-ink-muted select-none"
                  >
                    {i + 1}
                  </span>
                  <span data-line="" className="pr-4 whitespace-pre">
                    {line}
                  </span>
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        )}

        <p className="m-0 border-t border-band-hairline px-4 py-3 text-ui-sm font-ui-sm text-band-ink-soft">
          {details.note} <span className="text-band-ink-muted">· {details.format}</span>
        </p>
      </section>
    </div>
  );
}
