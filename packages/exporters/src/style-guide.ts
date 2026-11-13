import type { ThemaSystem } from "@thema/engine";
import {
  COLOR_ROLES,
  cssFontStack,
  em,
  familyForStep,
  fontStack,
  provenance,
  px,
  toHex,
  type Theme,
} from "./shared.js";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const colorVars = (system: ThemaSystem, theme: Theme): string =>
  COLOR_ROLES.map((role) => `--${role}: ${system.color[theme][role]};`).join(" ");

/**
 * style-guide.html: a self-contained page (inline CSS and a one-line toggle script, no external
 * requests) that renders every token and a few sample components in light and dark.
 */
export function toStyleGuide(system: ThemaSystem): string {
  const { typography, spacing, radius, shadow, layout, motion } = system;
  const sans = cssFontStack(fontStack("sans", typography.families.sans));
  const mono = typography.families.mono
    ? cssFontStack(fontStack("mono", typography.families.mono))
    : "ui-monospace, monospace";

  const swatches = COLOR_ROLES.map(
    (role) => `
      <figure class="swatch">
        <div class="chip" style="background: var(--${role})"></div>
        <figcaption><strong>${role}</strong><br><code>${toHex(system.color.light[role])}</code> · <code>${toHex(system.color.dark[role])}</code></figcaption>
      </figure>`,
  ).join("");

  const type = typography.scale
    .map((step) => {
      const { slot, name } = familyForStep(typography.families, step.name);
      const style = `font-family: ${escape(cssFontStack(fontStack(slot, name)))}; font-size: ${px(step.size)}; line-height: ${step.lineHeight}; font-weight: ${step.weight}; letter-spacing: ${em(step.tracking)}`;
      return `
      <div class="type-row"><code>${step.name} · ${px(step.size)} · ${step.weight}</code><p style="${style}">The quick brown fox jumps over the lazy dog</p></div>`;
    })
    .join("");

  const spaces = spacing.scale
    .map(
      (v) => `<div class="space"><code>${px(v)}</code><span style="width: ${px(v)}"></span></div>`,
    )
    .join("");

  const corners = (["sm", "md", "lg", "full"] as const)
    .map(
      (k) =>
        `<div class="corner" style="border-radius: ${px(radius[k])}"><code>${k} ${px(radius[k])}</code></div>`,
    )
    .join("");

  const shadows = (["sm", "md", "lg"] as const)
    .map(
      (k) =>
        `<div class="elevated" style="box-shadow: ${escape(shadow[k])}"><code>${k}</code></div>`,
    )
    .join("");

  const alerts = (["success", "warning", "danger", "info"] as const)
    .map(
      (role) =>
        `<p class="alert" style="color: var(--${role}); border-color: var(--${role})">${role}: a message in the ${role} color.</p>`,
    )
    .join("");

  return `<!doctype html>
<!-- ${escape(provenance(system))} Edit tokens in Thema; this file is generated. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(system.meta.name)} style guide</title>
<style>
  :root { ${colorVars(system, "light")} color-scheme: light; }
  :root.dark { ${colorVars(system, "dark")} color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--ink); font-family: ${sans}; line-height: 1.5; }
  main { max-width: ${px(layout.containerMax)}; margin: 0 auto; padding: 0 ${px(layout.gutter)}; }
  section { padding: ${px(layout.sectionY / 2)} 0; border-top: 1px solid var(--hairline); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 24px 0; }
  h1, h2 { margin: 0 0 16px; }
  code { font-family: ${mono}; font-size: 0.85em; color: var(--ink-muted); }
  .muted { color: var(--ink-muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
  .swatch { margin: 0; }
  .chip { height: 64px; border-radius: ${px(radius.md)}; border: 1px solid var(--hairline); }
  .type-row p { margin: 4px 0 16px; }
  .space { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
  .space span { display: inline-block; height: 12px; background: var(--primary); }
  .corner, .elevated { display: inline-flex; align-items: center; justify-content: center; width: 120px; height: 80px; margin: 0 12px 12px 0; background: var(--surface-raised); border: 1px solid var(--hairline); }
  .button { background: var(--primary); color: var(--primary-ink); border: 0; border-radius: ${px(radius.md)}; padding: 10px 18px; font: inherit; cursor: pointer; transition: opacity ${motion.durationFast}ms ${motion.easing}; }
  .button:hover { opacity: 0.9; }
  .card { background: var(--surface-raised); border: 1px solid var(--hairline); border-radius: ${px(radius.lg)}; padding: 24px; max-width: 420px; box-shadow: ${shadow.md}; }
  .panel { background: var(--surface); border-radius: ${px(radius.lg)}; padding: 24px; }
  input { background: var(--canvas); color: var(--ink); border: 1px solid var(--hairline); border-radius: ${px(radius.sm)}; padding: 8px 12px; font: inherit; }
  .alert { border-left: 4px solid; padding: 4px 12px; margin: 8px 0; }
  .highlight { background: var(--accent); width: 48px; height: 6px; border-radius: 3px; }
</style>
</head>
<body>
<main>
  <header>
    <div><h1>${escape(system.meta.name)}</h1><p class="muted">${escape(provenance(system))}</p></div>
    <button class="button" type="button" onclick="document.documentElement.classList.toggle('dark')">Toggle dark</button>
  </header>
  <section><h2>Colors</h2><p class="muted">Light · dark hex for each role.</p><div class="grid">${swatches}
  </div></section>
  <section><h2>Typography</h2><p class="muted">Ratio about ${typography.ratio}.</p>${type}
  </section>
  <section><h2>Spacing</h2><p class="muted">Base ${px(spacing.base)}.</p>${spaces}</section>
  <section><h2>Radius</h2>${corners}</section>
  <section><h2>Shadows</h2>${shadows}</section>
  <section><h2>Components</h2>
    <div class="card"><div class="highlight"></div><h3>Card title</h3><p class="muted">Muted supporting text on a raised surface.</p><button class="button" type="button">Primary action</button></div>
    <p></p>
    <div class="panel"><label>Email <input type="email" placeholder="you@example.com"></label></div>
    ${alerts}
  </section>
</main>
</body>
</html>
`;
}
