"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EXPORT_FILES, type ExportFile } from "@/lib/exports-meta";

/** Lines shown in the code panel: the top of the real file. Copy copies all of it. */
export const EXCERPT_LINES = 20;

/** Per file: the extension tile, who it's for, the line under the panel, and the format. */
const DETAILS: Record<
  ExportFile,
  { tile: string; audience: string; note: string; format: string }
> = {
  "DESIGN.md": {
    tile: "MD",
    audience: "Claude Code, Cursor, Stitch and any agent",
    note: "Tokens up top, rules in plain words below.",
    format: "YAML + Markdown · Google DESIGN.md spec",
  },
  "theme.css": {
    tile: "CSS",
    audience: "Tailwind v4 projects",
    note: "Every token as a Tailwind theme variable, dark mode included.",
    format: "CSS · Tailwind v4 @theme",
  },
  "shadcn.css": {
    tile: "CSS",
    audience: "shadcn/ui projects",
    note: "Every shadcn/ui variable, light and dark, in the names shadcn expects.",
    format: "CSS · shadcn/ui theme",
  },
  "tokens.json": {
    tile: "JSON",
    audience: "Style Dictionary, Figma plugins, your own pipeline",
    note: "Every token with its type, colors in OKLCH and hex.",
    format: "JSON · W3C DTCG",
  },
  "style-guide.html": {
    tile: "HTML",
    audience: "People: reviews, handoff, sharing",
    note: "One self-contained page: no scripts, nothing loaded from elsewhere.",
    format: "HTML",
  },
};

const KEY = "text-band-accent";
const COMMENT = "text-band-ink-muted";

/**
 * Light syntax colors for the excerpt: keys and properties in the band accent, comments muted.
 * DESIGN.md's `#` lines are comments inside the YAML front matter and headings after it.
 */
function highlight(file: ExportFile, lines: string[]): ReactNode[] {
  let inFrontMatter = false;
  return lines.map((line) => {
    const trimmed = line.trimStart();
    if (file === "DESIGN.md") {
      if (trimmed === "---") {
        inFrontMatter = !inFrontMatter;
        return <span className={COMMENT}>{line}</span>;
      }
      if (trimmed.startsWith("#")) {
        return <span className={inFrontMatter ? COMMENT : KEY}>{line}</span>;
      }
      const key = /^(\s*)([\w-]+:)(.*)$/.exec(line);
      if (inFrontMatter && key) {
        return (
          <>
            {key[1]}
            <span className={KEY}>{key[2]}</span>
            {key[3]}
          </>
        );
      }
      return line;
    }
    if (trimmed.startsWith("/*")) return <span className={COMMENT}>{line}</span>;
    const property =
      file === "tokens.json"
        ? /^(\s*)("[^"]+":)(.*)$/.exec(line)
        : /^(\s*)(--[\w-]+:)(.*)$/.exec(line);
    if (property) {
      return (
        <>
          {property[1]}
          <span className={KEY}>{property[2]}</span>
          {property[3]}
        </>
      );
    }
    return line;
  });
}

/** Two overlapping sheets: the copy icon on the panel's Copy button. */
const CopyIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
  >
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
  </svg>
);

/**
 * Exports (docs/pages.md): the five files as the exporters wrote them for the sample system.
 * `files` comes from exportAll on the server; nothing here is hand-written. The panel shows the
 * top of each file without scrolling; Copy takes the whole file.
 */
export function FileExplorer({ files }: { files: Record<string, string> }) {
  const id = useId();
  const [selected, setSelected] = useState<ExportFile>("DESIGN.md");
  const [copied, setCopied] = useState(false);
  const content = files[selected] ?? "";
  const lines = content.split("\n");
  const excerpt = lines.slice(0, EXCERPT_LINES);
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <ul aria-label="Files" className="m-0 flex list-none flex-col gap-2 p-0">
        {EXPORT_FILES.map(([name]) => (
          <li key={name}>
            <button
              type="button"
              aria-pressed={selected === name}
              onClick={() => {
                setSelected(name);
                setCopied(false);
              }}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-3 text-left",
                selected === name ? "border-ink" : "border-hairline hover:border-ink-faint",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 flex-none items-center justify-center rounded-sm text-token font-token",
                  selected === name ? "bg-ink text-canvas" : "bg-surface-subtle text-ink",
                )}
              >
                {DETAILS[name].tile}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-token font-token text-ink">{name}</span>
                <span className="text-ui-sm font-ui-sm text-ink-muted">
                  {DETAILS[name].audience}
                </span>
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
              {selected !== "style-guide.html" && ` · ${excerpt.length} of ${lines.length} lines`}
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
              className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-band-hairline bg-band-surface px-4 text-ui-sm font-ui-sm text-band-ink"
            >
              <CopyIcon />
              Copy
            </button>
          </span>
        </div>

        {selected === "style-guide.html" ? (
          <iframe
            title="style-guide.html, rendered"
            sandbox=""
            scrolling="no"
            srcDoc={content}
            data-testid="style-guide-frame"
            className="h-[520px] w-full border-0 bg-canvas"
          />
        ) : (
          <pre
            aria-label={`${selected}, the first ${excerpt.length} of ${lines.length} lines`}
            data-testid="code"
            className="m-0 flex-1 overflow-hidden py-4 text-token font-token leading-[1.75]"
          >
            <code className="block">
              {highlight(selected, excerpt).map((line, i) => (
                <span key={i} className="flex">
                  <span
                    aria-hidden="true"
                    className="w-12 flex-none pr-4 text-right text-band-ink-muted select-none"
                  >
                    {i + 1}
                  </span>
                  <span
                    data-line={excerpt[i]}
                    className="min-w-0 overflow-hidden pr-4 text-ellipsis whitespace-pre"
                  >
                    {line}
                  </span>
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        )}

        <p className="m-0 flex flex-wrap justify-between gap-2 border-t border-band-hairline px-4 py-3 text-ui-sm font-ui-sm text-band-ink-soft">
          <span>{details.note}</span>
          <span className="text-token font-token text-band-ink-muted">{details.format}</span>
        </p>
      </section>
    </div>
  );
}
