---
version: alpha
name: Thema
description: Premium white, ink-black type and one kiln-orange accent, organised around paint-chip swatches. A quiet frame so users' own colors stay the loudest thing on screen.
colors:
  primary: "#D9541E"
  primary-strong: "#B4431A"
  primary-deep: "#8F3414"
  primary-tint: "#FFF4EE"
  on-primary: "#FFFFFF"
  canvas: "#FFFFFF"
  surface: "#FFFFFF"
  surface-subtle: "#FAFAFA"
  stage: "#F5F5F4"
  hairline: "#EBEBEB"
  divider: "#EFEFEF"
  input-border: "#E6E6E6"
  pill-border: "#E2E2E2"
  dot-grid: "#DCDCDC"
  ink: "#0A0A0A"
  ink-soft: "#4A4A4A"
  ink-muted: "#5E5E5E"
  ink-subtle: "#6B6B6B"
  ink-faint: "#8C8C8C"
  success: "#2F6B3F"
  warning: "#8A5A0B"
  danger: "#A51D3C"
  band: "#0A0A0A"
  band-surface: "#161616"
  band-hairline: "#2A2A2A"
  band-ink: "#F3EEE3"
  band-ink-soft: "#BDBDBD"
  band-ink-muted: "#A3A3A3"
  band-link: "#D4D4D4"
  band-accent: "#F08A5D"
  agent-claude: "#B4431A"
  agent-cursor: "#2546C8"
  agent-v0: "#0A0A0A"
  agent-lovable: "#B8235A"
  agent-windsurf: "#0F766E"
  agent-copilot: "#5B39E8"
  agent-stitch: "#1F6F4A"
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
    fontSize: 92px
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: -0.035em
  display-accent:
    fontFamily: Instrument Serif
    fontSize: 92px
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: -0.01em
  h2-lg:
    fontFamily: Geist
    fontSize: 60px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.035em
  h2:
    fontFamily: Geist
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.03em
  h3:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  h4:
    fontFamily: Geist
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: Geist
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  title-sm:
    fontFamily: Geist
    fontSize: 17px
    fontWeight: 500
    lineHeight: 1.4
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.4
  body-sm:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Geist
    fontSize: 14px
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
  7: 28px
  8: 32px
  9: 36px
  10: 40px
  12: 48px
  14: 56px
  16: 64px
  18: 72px
  22: 88px
  24: 96px
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
    backgroundColor: "{colors.primary-deep}"
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
  band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-ink}"
    padding: 104px 32px
  band-card:
    backgroundColor: "{colors.band-surface}"
    textColor: "{colors.band-ink}"
    rounded: "{rounded.lg}"
    padding: 24px
  row-highlight:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.token}"
---

## Overview

Thema is a design tool, so its own interface stays quiet. The look is **Premium White**: a white canvas, near-black ink type, one kiln-orange accent, hairline borders and a neutral gray stage, with soft shadows on just four marketing elements. The signature is the **paint chip**: every color token is shown as a tall rounded chip with its name, a short rule and its hex in mono. The logo is three stacked chips (paper, ink, kiln).

The single most important rule: **users' own colors are the loudest thing on screen.** Their palettes and previews always sit on the neutral `stage` gray, or on a white card inside a stage panel, so their colors read true and stay apart from Thema's chrome.

## Colors

All text pairs below pass WCAG 2.2 AA (4.5:1 for text, 3:1 for large text and UI graphics). Ratios are measured.

**Neutrals**

- **Canvas (#FFFFFF):** app and page background: hero, features, CTA.
- **Surface (#FFFFFF):** cards, panels, inputs, reference cards. White on white, set apart by a hairline border.
- **Surface subtle (#FAFAFA):** quiet bands (the "Reads into" strip, the FAQ), card headers, mono rows.
- **Stage (#F5F5F4):** the neutral area behind user palettes, token previews and template previews. On marketing pages it may also be a full-width band (How it works) or a frame (the hero blend panel, the agents terminal). User content still always sits on stage.
- **Hairline (#EBEBEB):** section and card borders, 1px. **Divider (#EFEFEF):** rows inside a card. **Input border (#E6E6E6)** and **pill border (#E2E2E2):** inputs and white pills. Borders are decorative and never carry meaning on their own.
- **Ink (#0A0A0A):** headings, primary text, black pills, the black band and the footer. 19.80:1 on canvas, 18.97:1 on surface subtle, 18.15:1 on stage.
- **Ink soft (#4A4A4A):** the hero subhead and long-form copy. 8.86:1 on canvas, 8.12:1 on stage.
- **Ink muted (#5E5E5E):** body copy in sections. 6.48:1 on canvas, 6.21:1 on surface subtle, 5.94:1 on stage.
- **Ink subtle (#6B6B6B):** eyebrows, captions, agent names at rest, closed FAQ numbers. 5.33:1 on canvas, 5.11:1 on surface subtle, 4.89:1 on stage.
- **Ink faint (#8C8C8C):** graphics only, like the FAQ plus and minus signs (3.36:1 on white, enough for a UI graphic). Never text.
- **Dot grid (#DCDCDC):** the FAQ's dot pattern. Decorative only.

**Kiln**

- **Primary / Kiln (#D9541E):** the underline under the accent word, the step 04 dot, the pulse dot, focus rings, fills. 4.01:1 on canvas, 3.68:1 on stage: **never** body text, small labels or button labels.
- **Primary strong / Kiln Deep (#B4431A):** the primary button (white label 5.59:1), eyebrow labels and links on light backgrounds (5.59:1 on canvas, 5.35:1 on surface subtle, 5.12:1 on stage), the open FAQ number.
- **Primary deep (#8F3414):** the primary button's hover fill (white label 7.87:1) and highlighted row text. **Primary tint (#FFF4EE):** the highlighted row's background (primary deep on it: 7.28:1).

**Black band and footer**

- **Band (#0A0A0A):** the full-width black band and the footer. **Band surface (#161616)** for the card inside it, **band hairline (#2A2A2A)** for its borders.
- **Band ink (#F3EEE3):** band headings, 17.11:1 on band, 15.64:1 on band surface. **Band ink soft (#BDBDBD):** band body copy, 10.54:1 on band, 9.63:1 on band surface. **Band ink muted (#A3A3A3):** table labels and footer text, 7.17:1 on band surface, 7.85:1 on band. **Band link (#D4D4D4):** footer links, 13.36:1.
- **Band accent (#F08A5D):** the band eyebrow and the word "pass", 8.01:1 on band, 7.32:1 on band surface.
- Before and after ratios on the band use the dark status colors: success #6FBF85 (8.16:1 on band surface) and danger #F2788F (6.77:1).

**Status:** Success / Moss (#2F6B3F, 6.37:1 on canvas, 5.84:1 on stage), Warning / Ochre (#8A5A0B, 5.92:1), Danger / Crimson (#A51D3C, 7.39:1). Status only; warnings always carry an icon, because orange is already the brand accent.

**Agent accents** (the "Reads into" strip only, on hover or keyboard focus, on surface subtle): Claude Code #B4431A 5.35:1, Cursor #2546C8 7.21:1, v0 #0A0A0A 18.97:1, Lovable #B8235A 5.87:1, Windsurf #0F766E 5.24:1, GitHub Copilot #5B39E8 6.30:1, Google Stitch #1F6F4A 5.86:1. At rest the names are ink subtle and each agent shows its official logo mark in its own colors (decorative: the name beside it identifies the item); an agent without an official logo file yet shows a generic line icon in #A3A3A3 (2.42:1, also decorative). While one item is hovered or focused, the others fade to 0.35 opacity, which drops them below 4.5:1 for as long as the pointer or focus stays there.

**Dark mode** (app screens; unchanged): canvas #111111, surface #1A1917, hairline #2E2C28, ink #F3EEE3, soft #D8D1C4 (12.44:1 on canvas), muted #A39C90, links #E8673A. The dark primary button is a #D9541E fill with an #111111 label (4.71:1). Status: #6FBF85, #E0A94A, #F2788F.

## Typography

- **Geist** for all UI and headlines. Headlines are tight: weight 600, negative tracking.
- **Instrument Serif italic** for exactly one accent word per headline ("Taste, *exported.*"). Never for whole sentences, body text or UI.
- **Geist Mono** for every hex value, token name, file name, code, eyebrow labels and step numbers.
- Body copy is 15–19px with a 1.55–1.6 line height. Nothing readable goes below 12px.
- The display style (92px) scales down to 56px on narrow screens: `clamp(56px, 9vw, 92px)`. `h2` (44px) is every section heading, the black band's included; `h2-lg` (60px) is for the closing call to action; `h4` (19px / 600) for step titles; `lead` (17px) for feature body copy; `caption` (14px) for step text and captions; `title-sm` (17px / 500) for accordion questions; `label-md` (15px / 500) for nav links and pill items; `body-sm` (15px) for answers and captions.

## Layout

- 4px base unit; use the spacing scale only.
- Marketing pages: 1200px max content width, 32px side padding, 104px vertical section padding (hero 96px, the "Reads into" strip 28px).
- App screens: fluid. References column 300–340px, stage takes the rest, controls column 280–320px; columns wrap and stack on narrow screens.
- Gaps between cards 14–20px. Card padding 18–28px.

## Elevation & Depth

Mostly flat: depth comes from hairline borders and the step between white, surface subtle and stage. Soft shadows are allowed on exactly these marketing elements, and nothing else:

- the hero URL pill: `0 1px 2px rgb(0 0 0 / .04), 0 8px 24px rgb(0 0 0 / .05)`
- the Feature 01 card: `0 1px 2px rgb(0 0 0 / .04), 0 12px 32px rgb(0 0 0 / .05)`
- the FAQ accordion card: `0 1px 2px rgb(0 0 0 / .04), 0 16px 40px rgb(0 0 0 / .06)`
- the demo window: `0 24px 64px rgb(0 0 0 / .08)`

Shadows inside the stage that belong to the user's system (a radius or shadow sample) are the user's content, not Thema's chrome.

## Shapes

- Cards and panels: 12–16px radius; the stage: 20px.
- Paint chips: 12px radius, tall (about 176px), content bottom-aligned: name, an 18px × 1.5px rule, hex in mono.
- Buttons, inputs, tags and segmented controls: full pill.

## Components

- **button-primary:** Kiln Deep pill with a white label. At most one per view — it's the next step (Extract, Export system, Paste your first site).
- **button-secondary:** black ink pill with a white label for strong but non-primary actions (Start blending, Add, Preview, Read the docs).
- **button-ghost:** white pill with a pill-border (Share, Ask on GitHub).
- **input:** white pill with an input-border; a URL input pairs with its submit button inside the same pill.
- **tag-on / tag-off:** borrow chips (Colors, Type, Spacing, Shape, Layout). On = ink fill; off = transparent with hairline border and muted text. Use `aria-pressed`.
- **chip-swatch:** the paint chip. Text color is whichever of white or the system's ink passes contrast on the chip.
- **stage:** the neutral container for anything the user made.
- **Accessibility report rows:** mono text, "before → after" ratios, Moss for passes, Crimson for failures.
- **band / band-card:** the full-width black band; its card uses band surface with a band hairline border.
- **row-highlight:** the one emphasised mono row in a card: primary tint background, primary deep text.
- **Accordion (FAQ):** a white card with dividers between items; each question is a button with `aria-expanded`, all closed at first, one open at a time; on wide screens it is vertically centered on the intro beside it.
- **Agent item:** a pill link with the agent's official 18px logo mark, at least 44px tall. Logos keep their own colors, never recolored or grayed (brand guidelines); they name compatible tools and are their owners' trademarks. A generic line icon stands in only until an official file is added.

## Do's and Don'ts

- Do keep orange to about 5% of any screen.
- Do show every hex and token name in Geist Mono.
- Do put user content on the stage, and keep Thema's chrome off it.
- Don't use Kiln (#D9541E) for small text or button labels — use Kiln Deep.
- Don't use more than one serif italic word per headline.
- Do use the FAQ dot grid (dot grid color, 1px dots 22px apart, faded out behind the content) as the one decorative background.
- Don't add gradients, glows, emoji or other decorative backgrounds, and no shadows beyond the four listed under Elevation.
- Don't use orange for warnings or errors.

## Motion

- Fast: 120ms for hover and press. Base: 200ms for panels and token updates. Easing: cubic-bezier(0.2, 0, 0, 1).
- When blend sliders move, chips cross-fade their color over 200ms; nothing slides or bounces.
- Respect `prefers-reduced-motion`: no transitions.
- **Exception, the agents strip:** the hovered or keyboard-focused item's name takes its accent color and the item scales to 1.14 (the logo keeps its own colors), while the other items fade to 0.35 opacity. Color and opacity transition over 240ms, the scale over 240ms with the standard easing. The 8px Kiln dot by the "Reads into" label pulses (a ring growing from 0 to 6px, 2s, ease-in-out, infinite). Under `prefers-reduced-motion` there is no scale, no pulse and no transition; the color change still happens. On devices without hover, items stay at rest.

## Agent rules

- Read colors from CSS variables named after the tokens above (`--color-canvas`, `--color-primary-strong`, `--color-agent-cursor`, …). Never hardcode hex in components.
- Map shadcn/ui variables to these tokens once, in the theme file; components use the shadcn variables.
- One `button-primary` per view.
- Every interactive element is a real `<button>`, `<a>` or `<input>` with a visible focus ring (2px Kiln, 2px offset) and a 44px minimum touch target.
- Before adding a new color, spacing value or radius, check whether an existing token fits. If none does, add it here first.
