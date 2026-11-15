import { chartColors, type ColorRole, type ThemaSystem } from "@thema/engine";
import { COLOR_ROLES, cssFontStack, em, fontStack, provenance, px, type Theme } from "./shared.js";

const header = (system: ThemaSystem, what: string): string =>
  `/* ${what}. ${provenance(system)} Edit tokens in Thema; this file is generated. */`;

const block = (selector: string, vars: readonly [string, string][]): string[] => [
  `${selector} {`,
  ...vars.map(([name, value]) => `  --${name}: ${value};`),
  "}",
];

const colorVars = (system: ThemaSystem, theme: Theme): [string, string][] =>
  COLOR_ROLES.map((role) => [`color-${role}`, system.color[theme][role]]);

/**
 * theme.css: a Tailwind v4 `@theme` block (colors in OKLCH, fonts with fallback stacks, the type
 * scale, radius, shadow, spacing unit, layout and motion), plus `.dark` color overrides.
 */
export function toTailwindCss(system: ThemaSystem): string {
  const { typography, spacing, radius, shadow, layout, motion } = system;
  const vars: [string, string][] = [...colorVars(system, "light")];

  for (const [slot, name] of Object.entries(typography.families) as [
    keyof typeof typography.families,
    string | undefined,
  ][]) {
    if (name !== undefined) vars.push([`font-${slot}`, cssFontStack(fontStack(slot, name))]);
  }
  for (const step of typography.scale) {
    vars.push(
      [`text-${step.name}`, px(step.size)],
      [`text-${step.name}--line-height`, String(step.lineHeight)],
      [`text-${step.name}--letter-spacing`, em(step.tracking)],
      [`text-${step.name}--font-weight`, String(step.weight)],
    );
  }
  vars.push(
    ["radius-sm", px(radius.sm)],
    ["radius-md", px(radius.md)],
    ["radius-lg", px(radius.lg)],
    ["radius-full", px(radius.full)],
    ["shadow-sm", shadow.sm],
    ["shadow-md", shadow.md],
    ["shadow-lg", shadow.lg],
    // Tailwind v4 multiplies its spacing utilities by this unit (p-4 = 4 × --spacing).
    ["spacing", px(spacing.base)],
    ["container-max", px(layout.containerMax)],
    ["spacing-gutter", px(layout.gutter)],
    ["spacing-section", px(layout.sectionY)],
    ["duration-fast", `${motion.durationFast}ms`],
    ["duration-base", `${motion.durationBase}ms`],
    ["ease-standard", motion.easing],
  );

  return [
    header(system, "Tailwind v4 theme"),
    "",
    ...block("@theme", vars),
    "",
    ...block(".dark", colorVars(system, "dark")),
    "",
  ].join("\n");
}

/**
 * shadcn/ui variable names → Thema roles. shadcn's `accent` is a subtle hover background, so it
 * maps to `surface`. Every foreground/background pair here is one the fixer checked (text on
 * accent isn't, so the sidebar's primary is primary). `chart-N` is the engine's chartColors[N-1]:
 * primary, then the accent when it's a real second color, then colors derived from primary (or
 * its grays), each at 3:1 on the canvas and cards; never the status colors.
 */
const SHADCN: readonly [string, ColorRole | number][] = [
  ["background", "canvas"],
  ["foreground", "ink"],
  ["card", "surface-raised"],
  ["card-foreground", "ink"],
  ["popover", "surface-raised"],
  ["popover-foreground", "ink"],
  ["primary", "primary"],
  ["primary-foreground", "primary-ink"],
  ["secondary", "surface"],
  ["secondary-foreground", "ink"],
  ["muted", "surface"],
  ["muted-foreground", "ink-muted"],
  ["accent", "surface"],
  ["accent-foreground", "ink"],
  ["destructive", "danger"],
  ["border", "hairline"],
  ["input", "hairline"],
  ["ring", "primary"],
  ["chart-1", 0],
  ["chart-2", 1],
  ["chart-3", 2],
  ["chart-4", 3],
  ["chart-5", 4],
  ["sidebar", "surface"],
  ["sidebar-foreground", "ink"],
  ["sidebar-primary", "primary"],
  ["sidebar-primary-foreground", "primary-ink"],
  ["sidebar-accent", "surface-raised"],
  ["sidebar-accent-foreground", "ink"],
  ["sidebar-border", "hairline"],
  ["sidebar-ring", "primary"],
];

/** Every variable shadcn.css defines, in order. */
export const SHADCN_VARIABLES: readonly string[] = ["radius", ...SHADCN.map(([name]) => name)];

/** shadcn.css: `:root` and `.dark` variables in shadcn/ui's naming (OKLCH, as shadcn v4 uses). */
export function toShadcnCss(system: ThemaSystem): string {
  const vars = (theme: Theme): [string, string][] => {
    const colors = system.color[theme];
    const chart = chartColors(colors);
    return SHADCN.map(([name, source]) => [
      name,
      typeof source === "number" ? (chart[source] ?? colors.primary) : colors[source],
    ]);
  };
  return [
    header(system, "shadcn/ui theme"),
    "",
    ...block(":root", [["radius", px(system.radius.md)], ...vars("light")]),
    "",
    ...block(".dark", vars("dark")),
    "",
  ].join("\n");
}
