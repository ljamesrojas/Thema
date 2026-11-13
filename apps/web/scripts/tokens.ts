// pnpm --filter @thema/web tokens
// Generates src/app/tokens.generated.css from the root DESIGN.md (Thema's own design system) with
// Google's pinned exporter, so no token value is ever retyped in the app. Run it after editing
// DESIGN.md; a test fails if the committed file is out of date.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
export const DESIGN_MD = resolve(here, "../../../DESIGN.md");
export const TOKENS_CSS = join(here, "../src/app/tokens.generated.css");

const HEADER =
  "/* Generated from the root DESIGN.md by `pnpm --filter @thema/web tokens`. Don't edit: change DESIGN.md and regenerate. */";

/**
 * The CSS variable next/font sets for each family DESIGN.md names (see src/app/fonts.ts). This
 * maps names only: fonts are self-hosted at build time, so the family name alone wouldn't match.
 */
export const FONT_VARIABLES: Record<string, string> = {
  Geist: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
  "Geist Mono": "var(--font-geist-mono), ui-monospace, monospace",
  "Instrument Serif": "var(--font-instrument-serif), ui-serif, Georgia, serif",
};

interface TypographyStyle {
  fontFamily?: string;
  fontWeight?: number;
  lineHeight?: number | string;
  letterSpacing?: string;
}

/** DESIGN.md's front matter: the fields Google's exporter drops are read from here. */
function frontMatter(): { typography?: Record<string, TypographyStyle> } {
  const text = readFileSync(DESIGN_MD, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match?.[1]) throw new Error("DESIGN.md has no front matter");
  return parse(match[1]) as { typography?: Record<string, TypographyStyle> };
}

/**
 * The @theme CSS for DESIGN.md: @google/design.md's css-tailwind export, plus what it drops
 * (unitless line heights, read from the front matter), weight and tracking attached to each
 * `text-<style>`, and each style's font pointed at its self-hosted next/font variable.
 */
export function generateTokensCss(): string {
  const cli = fileURLToPath(import.meta.resolve("@google/design.md"));
  const css = execFileSync(
    process.execPath,
    [cli, "export", "--format", "css-tailwind", DESIGN_MD],
    {
      encoding: "utf8",
    },
  );
  // `--font-weight-<style>` would compete with `--font-<style>` (the family) for the same
  // `font-<style>` class; the weight is attached to `text-<style>` below instead.
  // `@theme static`: emit every token as a CSS variable even when no utility class uses it, since
  // components may read tokens directly (DESIGN.md → Agent rules), e.g. the agents strip's
  // `var(--color-agent-cursor)`, whose name is built at runtime where Tailwind can't see it.
  const exported = css
    .split("\n")
    .filter((line) => !/^\s*--font-weight-/.test(line))
    .map((line) => (line === "@theme {" ? "@theme static {" : line))
    .join("\n");
  const extra: string[] = [];
  for (const [name, style] of Object.entries(frontMatter().typography ?? {})) {
    // One `text-<style>` utility then sets size, line height, weight and tracking together.
    if (style.lineHeight !== undefined)
      extra.push(`  --text-${name}--line-height: ${style.lineHeight};`);
    if (style.fontWeight !== undefined)
      extra.push(`  --text-${name}--font-weight: ${style.fontWeight};`);
    if (style.letterSpacing !== undefined) {
      extra.push(`  --text-${name}--letter-spacing: ${style.letterSpacing};`);
    }
    const font = style.fontFamily === undefined ? undefined : FONT_VARIABLES[style.fontFamily];
    if (style.fontFamily !== undefined && font === undefined) {
      throw new Error(
        `DESIGN.md uses font "${style.fontFamily}": add it to FONT_VARIABLES and fonts.ts`,
      );
    }
    if (font !== undefined) extra.push(`  --font-${name}: ${font};`);
  }
  return [
    HEADER,
    exported.trimEnd(),
    "",
    "/* From DESIGN.md's front matter: line height, weight and tracking per text style, and fonts mapped to next/font. */",
    "@theme {",
    ...extra,
    "}",
    "",
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(TOKENS_CSS, generateTokensCss());
  console.log(`Wrote ${TOKENS_CSS}`);
}
