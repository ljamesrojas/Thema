// A small Markdown renderer for Thema's own legal pages (docs/legal/*.md), so the files stay the
// one source of the text. It covers what those files use and nothing more: ## and ### headings,
// paragraphs, "- " lists (one nested level), tables, **bold**, `code` and [links](url). The
// file's own "# Title" and "> editor notes" aren't part of the page and are skipped.
import type { ReactNode } from "react";

/** `[LIKE THIS]` (not a link): text the owner still has to fill in. */
export const PLACEHOLDER = /\[(?![^\]]*\]\()[^\]\n]+\]/g;

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\[[^\]\n]+\])/g;

/** Bold, code, links and visible placeholders inside one line of text. */
function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="text-token font-token">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2]} className="text-primary-strong underline">
          {link[1]}
        </a>
      );
    }
    if (/^\[[^\]\n]+\]$/.test(part)) {
      return (
        <mark key={key} className="rounded-sm bg-primary-tint px-1 text-primary-deep">
          {part}
        </mark>
      );
    }
    return part;
  });
}

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: { text: string; children: string[] }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

/** Lines → blocks. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim() || line.startsWith("# ") || line.startsWith(">")) {
      i += 1;
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i += 1;
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i += 1;
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("|")) {
        const row = lines[i] ?? "";
        if (!/^\|[\s|:-]+\|?$/.test(row.trim())) rows.push(cells(row));
        i += 1;
      }
      const [head = [], ...body] = rows;
      blocks.push({ kind: "table", head, rows: body });
    } else if (/^- /.test(line)) {
      const items: { text: string; children: string[] }[] = [];
      while (i < lines.length && /^(- |\s{2,}- )/.test(lines[i] ?? "")) {
        const current = lines[i] ?? "";
        if (current.startsWith("- ")) items.push({ text: current.slice(2).trim(), children: [] });
        else items.at(-1)?.children.push(current.trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ kind: "ul", items });
    } else {
      const text: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim() && !/^(#|>|\||- )/.test(lines[i] ?? "")) {
        text.push((lines[i] ?? "").trim());
        i += 1;
      }
      blocks.push({ kind: "p", text: text.join(" ") });
    }
  }
  return blocks;
}

/** Markdown → the page's elements, in Thema's type styles. */
export function renderMarkdown(source: string): ReactNode[] {
  return parseMarkdown(source).map((block, b) => {
    const key = `b${b}`;
    switch (block.kind) {
      case "h2":
        return (
          <h2 key={key} className="m-0 mt-6 text-h3 font-h3">
            {inline(block.text, key)}
          </h2>
        );
      case "h3":
        return (
          <h3 key={key} className="m-0 mt-2 text-h4 font-h4">
            {inline(block.text, key)}
          </h3>
        );
      case "p":
        return (
          <p key={key} className="m-0 text-body-md font-body-md text-ink-soft">
            {inline(block.text, key)}
          </p>
        );
      case "ul":
        return (
          <ul
            key={key}
            className="m-0 flex list-disc flex-col gap-2 pl-6 text-body-md font-body-md text-ink-soft"
          >
            {block.items.map((item, n) => (
              <li key={n}>
                {inline(item.text, `${key}-${n}`)}
                {item.children.length > 0 && (
                  <ul className="mt-2 flex list-[circle] flex-col gap-2 pl-6">
                    {item.children.map((child, c) => (
                      <li key={c}>{inline(child, `${key}-${n}-${c}`)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      case "table":
        return (
          <div
            key={key}
            role="region"
            aria-label="Table"
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-hairline"
          >
            <table className="w-full border-collapse text-left text-body-sm font-body-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  {block.head.map((cell, c) => (
                    <th key={c} scope="col" className="px-4 py-3 font-semibold text-ink">
                      {inline(cell, `${key}-h${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-t border-divider">
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="px-4 py-3 font-medium text-ink">
                          {inline(cell, `${key}-${r}-${c}`)}
                        </th>
                      ) : (
                        <td key={c} className="px-4 py-3 text-ink-soft">
                          {inline(cell, `${key}-${r}-${c}`)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}
