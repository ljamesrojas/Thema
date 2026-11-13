---
version: alpha
name: Thema
description: Warm editorial paper, ink-black type and one kiln-orange accent, organised around paint-chip swatches. A quiet frame so users' own colors stay the loudest thing on screen.
colors:
  primary: "#D9541E"
  primary-strong: "#B4431A"
  on-primary: "#FFFFFF"
  canvas: "#F3EEE3"
  surface: "#FBF8F2"
  hairline: "#E4DDCF"
  stage: "#F4F4F2"
  ink: "#111111"
  ink-soft: "#3A3631"
  ink-muted: "#6B655C"
  success: "#2F6B3F"
  warning: "#8A5A0B"
  danger: "#A51D3C"
  dark-canvas: "#111111"
  dark-surface: "#1A1917"
  dark-hairline: "#2E2C28"
  dark-ink: "#F3EEE3"
  dark-ink-soft: "#D8D1C4"
  dark-ink-muted: "#A39C90"
  dark-primary: "#E8673A"
  dark-primary-fill: "#D9541E"
  dark-on-primary: "#111111"
  dark-success: "#6FBF85"
  dark-warning: "#E0A94A"
  dark-danger: "#F2788F"
typography:
  display:
    fontFamily: Geist
    fontSize: 88px
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: -0.035em
  display-accent:
    fontFamily: Instrument Serif
    fontSize: 88px
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: -0.01em
  h2:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.03em
  h3:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  ui-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  token:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  eyebrow:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.04em
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  14: 56px
  18: 72px
  22: 88px
  26: 104px
components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 12px 24px
    height: 44px
  button-primary-hover:
    backgroundColor: "#8F3414"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 11px 20px
    height: 44px
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: 9px 16px
    height: 40px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 12px 18px
    height: 44px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 28px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 18px
  stage:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  chip-swatch:
    rounded: "{rounded.md}"
    padding: 12px
    height: 176px
  tag-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.full}"
    padding: 6px 10px
  tag-off:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.full}"
    padding: 6px 10px
  link:
    textColor: "{colors.primary-strong}"
---

## Overview

Thema is a design tool, so its own interface stays quiet. The look is warm editorial: cream paper, ink-black type, one kiln-orange accent and hairline borders, with almost no shadows. The signature is the **paint chip** — every color token is shown as a tall rounded chip with its name, a short rule and its hex in mono. The logo is three stacked chips (paper, ink, kiln).

The single most important rule: **users' own colors are the loudest thing on screen.** Their palettes and previews always sit on the neutral `stage` gray, never on cream, so their colors read true.

## Colors

All text pairs below pass WCAG 2.2 AA.

- **Canvas / Paper (#F3EEE3):** app background.
- **Surface / Card (#FBF8F2):** panels, cards, inputs, reference cards.
- **Hairline / Seam (#E4DDCF):** every border and divider. 1px.
- **Stage (#F4F4F2):** neutral area behind user palettes, token previews and template previews. Never used for Thema's own chrome.
- **Ink (#111111):** all primary text, the secondary button, active tags. 16.3:1 on canvas.
- **Ink soft / Graphite (#3A3631):** long-form body copy on marketing pages (hero subheads, section intros, step descriptions). 10.36:1 on canvas, 11.31:1 on surface.
- **Ink muted / Ash (#6B655C):** secondary text, captions, hints. 4.98:1 on canvas.
- **Primary / Kiln (#D9541E):** fills, underlines under the accent word, progress bars, focus rings, text 24px and up. 3.47:1 on canvas — **never** use it for body text, small labels or button labels.
- **Primary strong / Kiln Deep (#B4431A):** the primary button background (white label 5.59:1) and links on canvas (4.83:1).
- **Success / Moss (#2F6B3F), Warning / Ochre (#8A5A0B), Danger / Crimson (#A51D3C):** status only. Warnings always carry an icon, because orange is already the brand accent.

**Dark mode:** canvas #111111, surface #1A1917, hairline #2E2C28, ink #F3EEE3, soft #D8D1C4 (12.44:1 on canvas), muted #A39C90, links #E8673A. The dark primary button is a #D9541E fill with an #111111 label (4.71:1). Status: #6FBF85, #E0A94A, #F2788F.

## Typography

- **Geist** for all UI and headlines. Headlines are tight: weight 600, negative tracking.
- **Instrument Serif italic** for exactly one accent word per headline ("Taste, *exported.*"). Never for whole sentences, body text or UI.
- **Geist Mono** for every hex value, token name, file name, code, eyebrow labels and step numbers.
- Body copy is 16–19px with 1.55 line height. Nothing readable goes below 12px.

## Layout

- 4px base unit; use the spacing scale only.
- Marketing pages: 1200px max content width, 32px side padding, 104px between sections.
- App screens: fluid. References column 300–340px, stage takes the rest, controls column 280–320px; columns wrap and stack on narrow screens.
- Gaps between cards 14–20px. Card padding 18–28px.

## Elevation & Depth

Flat. Depth comes from the hairline border and the surface-on-canvas step, not from shadows. The only shadow allowed is on user content inside the stage (for example a radius sample), because it belongs to the user's system, not to Thema.

## Shapes

- Cards and panels: 12–16px radius; the stage: 20px.
- Paint chips: 12px radius, tall (about 176px), content bottom-aligned: name, an 18px × 1.5px rule, hex in mono.
- Buttons, inputs, tags and segmented controls: full pill.

## Components

- **button-primary:** Kiln Deep pill with a white label. At most one per view — it's the next step (Extract, Export system, Paste your first site).
- **button-secondary:** ink pill with a paper label for strong but non-primary actions (Start blending, Add, Preview).
- **button-ghost:** surface pill with a hairline border (Share, Sign in).
- **input:** surface pill with a hairline border; a URL input pairs with its submit button inside the same pill.
- **tag-on / tag-off:** borrow chips (Colors, Type, Spacing, Shape, Layout). On = ink fill; off = transparent with hairline border and muted text. Use `aria-pressed`.
- **chip-swatch:** the paint chip. Text color is whichever of white or the system's ink passes contrast on the chip.
- **stage:** the neutral container for anything the user made.
- **Accessibility report rows:** mono text, "before → after" ratios, Moss for passes, Crimson for failures.

## Do's and Don'ts

- Do keep orange to about 5% of any screen.
- Do show every hex and token name in Geist Mono.
- Do put user content on the stage, and keep Thema's chrome off it.
- Don't use Kiln (#D9541E) for small text or button labels — use Kiln Deep.
- Don't use more than one serif italic word per headline.
- Don't add gradients, glows, emoji or drop shadows to Thema's chrome.
- Don't use orange for warnings or errors.

## Motion

- Fast: 120ms for hover and press. Base: 200ms for panels and token updates. Easing: cubic-bezier(0.2, 0, 0, 1).
- When blend sliders move, chips cross-fade their color over 200ms; nothing slides or bounces.
- Respect `prefers-reduced-motion`: no transitions.

## Agent rules

- Read colors from CSS variables named after the tokens above (`--color-canvas`, `--color-primary-strong`, …). Never hardcode hex in components.
- Map shadcn/ui variables to these tokens once, in the theme file; components use the shadcn variables.
- One `button-primary` per view.
- Every interactive element is a real `<button>`, `<a>` or `<input>` with a visible focus ring (2px Kiln, 2px offset) and a 44px minimum touch target.
- Before adding a new color, spacing value or radius, check whether an existing token fits. If none does, add it here first.
