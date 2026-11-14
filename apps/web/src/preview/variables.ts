// The variables a preview applies, read from the real export files (packages/exporters), so a
// preview shows exactly what the user would ship. Pure.
import type { ThemaSystem } from "@thema/engine";
import { toShadcnCss, toTailwindCss } from "@thema/exporters";

export type Variables = Record<string, string>;

/** `--name: value;` declarations inside the first `selector {…}` block of a CSS file. */
export function declarationsIn(css: string, selector: string): Variables {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return {};
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const block = css.slice(open + 1, close);
  const vars: Variables = {};
  for (const match of block.matchAll(/^\s*(--[\w-]+):\s*(.+?);\s*$/gm)) {
    const [, name, value] = match;
    if (name && value !== undefined) vars[name] = value;
  }
  return vars;
}

/**
 * From theme.css, everything but colors (shadcn.css has those, with a dark block) and the base
 * `--spacing` unit (it would rescale every Tailwind utility inside the frame): fonts, the type
 * scale, radii, shadows and the layout widths.
 */
const FROM_THEME =
  /^--(font-|text-|radius-|shadow-|container-max$|spacing-gutter$|spacing-section$)/;

export interface PreviewVariables {
  light: Variables;
  dark: Variables;
}

/** The light and dark variable sets for a system, parsed from its shadcn.css and theme.css. */
export function previewVariables(system: ThemaSystem): PreviewVariables {
  const shadcn = toShadcnCss(system);
  const theme = Object.fromEntries(
    Object.entries(declarationsIn(toTailwindCss(system), "@theme")).filter(([name]) =>
      FROM_THEME.test(name),
    ),
  );
  const root = declarationsIn(shadcn, ":root");
  return {
    light: { ...theme, ...root },
    dark: { ...theme, ...root, ...declarationsIn(shadcn, ".dark") },
  };
}

/** A type step's font size, line height, weight and tracking; missing steps fall back to base. */
export function type(step: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl") {
  const v = (prop: string) =>
    step === "base"
      ? `var(--text-base${prop})`
      : `var(--text-${step}${prop}, var(--text-base${prop}))`;
  return {
    fontSize: v(""),
    lineHeight: v("--line-height"),
    fontWeight: v("--font-weight"),
    letterSpacing: v("--letter-spacing"),
  };
}

/** Headings use the display face, then the heading face, then sans. */
export const HEADING_FONT = "var(--font-display, var(--font-heading, var(--font-sans)))";
export const BODY_FONT = "var(--font-sans)";
