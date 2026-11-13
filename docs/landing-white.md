# Landing — Premium White (approved 2026-11-13)

Source: the "Landing-white" board in the mockup canvas linked in SPEC.md (Landing & Workspace mockups). This file carries every value Claude Code needs, because the canvas is private and can't be opened from the repo. Where this file and the canvas differ, the canvas wins; ask.

## Palette (replaces the cream look on marketing pages)

| Role | Hex | Use |
|---|---|---|
| canvas | #FFFFFF | page background, hero, feature 01, feature 03, CTA |
| surface-subtle | #FAFAFA | "Reads into" strip, FAQ band, card headers, mono rows |
| stage | #F5F5F4 | hero blend panel, "How it works" band, agents terminal frame, demo preview |
| hairline | #EBEBEB | section borders, card borders (#E6E6E6 / #E2E2E2 for inputs and pills) |
| divider | #EFEFEF | rows inside cards (FAQ items, demo panes) |
| ink | #0A0A0A | headings, primary text, black pills, black band, footer |
| ink-soft | #4A4A4A | hero subhead |
| ink-muted | #5E5E5E | body copy in sections (6.4:1 on white) |
| ink-subtle | #6B6B6B | eyebrows, captions, agent names at rest (5.1:1 on #FAFAFA) |
| primary | #D9541E | underline under the accent word, step 04 dot, pulse dot, focus ring |
| primary-strong | #B4431A | Extract / Paste your first site buttons, eyebrow labels on light |
| band | #0A0A0A | full-width black band; inner card #161616, border #2A2A2A |
| band-ink | #F3EEE3 | band heading; band body #BDBDBD; table muted #A3A3A3 |
| band-accent | #F08A5D | band eyebrow and the word "pass" (8.0:1 on #0A0A0A) |
| success / danger on dark | #6FBF85 / #F2788F | before → after ratios in the band |

## Section order and backgrounds

1. **Nav** (white, bottom hairline): logo, links (How it works, Exports, For agents, Pricing, GitHub), Sign in (text), Start blending (black pill).
2. **Hero** `#top` (white): eyebrow mono "DESIGN.md · Tailwind v4 · shadcn · DTCG tokens"; h1 "Taste, *exported.*" (clamp 56–92px, serif italic accent word with 4px Kiln underline); subhead; URL pill input with Extract (soft shadow allowed, see Elevation); caption. Right: stage panel (#F5F5F4, radius 20) with "Blend · 3 references", WCAG AA badge (Moss), 3 reference rows with black tag pills, arrow caption, 5 paint chips on a white card.
3. **Reads into strip** (#FAFAFA, hairline top and bottom): see "Agents strip" below.
4. **Interactive demo** `#try` (white): as built in Session 9, or per canvas if not built yet.
5. **How it works** `#how` (#F5F5F4 band): h2 "From inspiration to instructions, in four steps." (no italic) + intro right; 4 white cards (radius 16, padding 24), mono step dot 26px (01–03 ink, 04 Kiln) followed by a hairline rule; Paste / Borrow / Fix / Export.
6. **Feature 01** `#exports` (white): eyebrow "01 · Extraction" (Kiln Deep), h2 "Measured, not guessed*.*" (serif italic period only); right: "reading styles…" card with mono rows on #FAFAFA, last row #FFF4EE with #8F3414 text.
7. **Black band, Feature 02** (full width #0A0A0A): **table card on the left, text on the right.** Eyebrow "02 · Not just extracted. Fixed." (#F08A5D); h2 "Borrowed colors that pass, every time." in #F3EEE3, the word "pass" same font, colored #F08A5D; body #BDBDBD.
8. **Feature 03** `#agents` (white): eyebrow "03 · Agents", h2 "Made for your agent*.*", 4 mono file pills; right: stage frame with a black terminal (you → agent, `thema.blend`, `thema.get_design_md` in #F08A5D).
9. **FAQ** `#faq` (#FAFAFA with dot grid): see "FAQ" below.
10. **CTA** `#start` (white, no card border): h2 60px "Your agent has *taste* now." (serif italic word with Kiln underline), "First blend free. No sign-up.", Kiln Deep pill "Paste your first site".
11. **Footer** (#0A0A0A, text #A3A3A3, links #D4D4D4): logo (inverted chips), "© 2026 Thema · Inspired by, never cloned.", Docs / GitHub / Privacy.

Layout: 1200px max width, 32px side padding, 104px vertical section padding (hero 96px, strip 28px).

## Agents strip (exactly as in the mockup)

- Row: label column ("READS INTO", mono 12px uppercase #6B6B6B, with an 8px Kiln dot that pulses: box-shadow ring 0 → 6px, 2s ease-in-out, infinite), then the items, `justify-content: space-between`, wrapping on narrow screens.
- 7 items, each a real `<a href="#agents">`: Claude Code, Cursor, v0, Lovable, Windsurf, GitHub Copilot, Google Stitch. Pill shape, padding 10px 16px, gap 10px, 15px / 500, **min-height 44px**.
- Each item has an 18px **generic line icon** (stroke 1.8, round caps), not a brand logo:
  - Claude Code: terminal window with a `>` prompt and an underscore line
  - Cursor: pointer arrow
  - v0: four-way spark (cross with a small diamond)
  - Lovable: heart
  - Windsurf: two wave lines
  - GitHub Copilot: paper plane
  - Google Stitch: zigzag stitch with a dashed baseline
- **At rest:** text #6B6B6B, icon stroke #A3A3A3, `filter: grayscale(1)`, scale 1, transparent background and border.
- **Hovered or keyboard-focused item:** text and icon take the item's accent color, `filter: grayscale(0)`, `transform: scale(1.14)`.
- **While one item is hovered/focused, every other item fades to opacity 0.35.**
- Transition 240ms on color, filter, opacity; transform 240ms cubic-bezier(0.2, 0, 0, 1).
- Accent colors (hover only; all ≥ 4.5:1 on #FAFAFA): claude #B4431A, cursor #2546C8, v0 #0A0A0A, lovable #B8235A, windsurf #0F766E, copilot #5B39E8, stitch #1F6F4A.
- `prefers-reduced-motion: reduce`: no scale, no pulse, no transitions (color change still happens).
- Touch devices (`hover: none`): no dimming; items stay in their rest state.

## FAQ

- Band: #FAFAFA with a dot grid: dots #DCDCDC, 1px, 22px apart, faded out behind the content with a radial overlay (ellipse 70% × 85% at 55% 50%, solid #FAFAFA to 40%, transparent at 85%). Hairline top and bottom.
- Two columns (wrap on narrow screens, gap 48 × 64):
  - **Left (≈340px):** eyebrow "FAQ" (Kiln Deep), h2 "Questions, answered*.*" (left-aligned, serif italic period), intro "The short version of how Thema reads sites, what it exports, and what it never copies." (#5E5E5E), then a white card (radius 16, padding 20, max 380px, no icon): "Still curious?" / "Read the docs or ask us on GitHub." with two pills: Read the docs (black) and Ask on GitHub (white, hairline border).
  - **Right (≈560px):** white accordion card (radius 16, padding 4 × 24, soft shadow). Items separated by #EFEFEF lines (no line above the first or below the last). Each question: mono number 01–05 (12px), question 17px / 500, `+` / `−` on the right; the open item's number and sign are #B4431A, closed ones #8C8C8C. Answer 15px #5E5E5E, indented 36px to line up with the question text. One item open at a time; first open by default. Real `<button aria-expanded>`.
- Questions: Is Thema a site cloner? · Which formats can I export? · What about paid fonts? · Do I need an account? · Which agents can read it? (answers in the canvas / current landing copy).

## Elevation (change from "flat")

Soft shadows are allowed on exactly three marketing elements: the hero URL pill (`0 1px 2px rgb(0 0 0 / .04), 0 8px 24px rgb(0 0 0 / .05)`), the Feature 01 card (`… 0 12px 32px rgb(0 0 0 / .05)`) and the FAQ accordion card (`… 0 16px 40px rgb(0 0 0 / .06)`). The demo window may use `0 24px 64px rgb(0 0 0 / .08)`. Nothing else gets a shadow.
