# Site pages — How it works, Exports, For agents, Pricing (approved 2026-11-15)

Source: the canvas boards How-it-works, Exports, Agents and Pricing (mockup link in SPEC.md). Same look as docs/landing-white.md: same palette, type, section rhythm (white ↔ #FAFAFA bands with hairlines, one black band per page), 1200px container, 104px section padding. Every fact on these pages comes from SPEC.md; if SPEC changes (limits, prices), the pages change with it.

## Shared

- **Routes:** `/how-it-works`, `/exports`, `/agents`, `/pricing`. One shared `SiteHeader` and `SiteFooter` for these four pages and the Landing.
- **Header nav:** How it works · Exports · For agents · Pricing · GitHub ↗. The current page's link is ink, weight 500, with a 2px Kiln (#D9541E) underline and `aria-current="page"`; the others #4A4A4A, ink on hover. Logo → `/`. Right: Sign in (text link), Start blending (black pill → `/`).
- **GitHub:** a plain external link to https://github.com/ljamesrojas/Thema with an arrow-up-right icon, `target="_blank" rel="noopener"`, and visually hidden "(opens in a new tab)". No GitHub page of our own.
- **Footer:** black, the inverted logo, "© 2026 Thema · Inspired by, never cloned.", links: How it works, Exports, For agents, Pricing, GitHub, Privacy.
- **Page hero pattern:** mono eyebrow in Kiln Deep (#B4431A), 72px h1 with one Instrument Serif italic word underlined 4px Kiln, an 18px subhead (#4A4A4A).
- **Closing CTA on every page:** 56px headline with one serif italic word, one line of copy, one pill → `/`.
- One `button-primary` (Kiln Deep) per view, as DESIGN.md says.

## How it works (`/how-it-works`)

1. Hero: "From five links to one *system.*" + subhead (under two minutes). Below: a 5-column step index (01 Paste, 02 Extract, 03 Add and tag, 04 Blend and tune, 05 Preview and export), each an anchor link to its section; 05's dot is Kiln.
2. Five step sections, alternating text/visual sides and white/#FAFAFA bands, grid 5/7 (or 7/5):
   - Paste: URL pill with Extract; chips "public address ✓", "localhost:3000 · refused", "192.168.1.10 · refused" (the SSRF guard).
   - Extract: browser card "1440 × 900 · Chromium", progress rows (fetching, cookie banner + scroll, reading styles: done; naming roles: working), progress bar, 5 paint chips, chips Inter / base 8 / radius 6.
   - Add and tag: 3 reference rows with borrow chips (on = ink fill, off = hairline), dashed "Add a site · 3 of 5".
   - Blend and tune (**interactive**): Roundness and Density sliders drive a small preview card's radius and padding; Contrast and Warmth shown static; a lock toggle button on "primary #2F5BEA" (`aria-pressed`). Badge "WCAG AA · every text pair passes".
   - Preview and export: Landing/Dashboard/Form and Light/Dark segmented controls, a dark preview, the five file chips, link to `/exports`.
3. Black band "Under the hood": "Code decides every value. Always the same answer." + three dark cards: Measured, Harmonized, Accessible.
4. CTA "Try it with your *first* site."

## Exports (`/exports`)

1. Hero: "Five files. *One* system."
2. **File explorer (interactive):** left, 5 file buttons (`aria-pressed`) with an extension tile (MD, CSS, CSS, JSON, HTML), file name in mono and who it's for; right, a black code panel with the file name, a "sample output" tag, a Copy button (44px tall) and line-numbered code. Use real exporter output for a sample system (generate it from a fixture, don't hand-write it). style-guide.html shows a rendered mini style guide instead of code. Footer line: one-sentence note + format name.
3. #FAFAFA band "Built in to every file.": 4 cards: Where it came from (header comment), Dark mode included, WCAG AA colors, Spec-clean (passes Google's design.md linter).
4. "Three files, three places.": 3 cards with a black code foot: DESIGN.md in the repo root, `@import "./theme.css"` after Tailwind, shadcn.css replacing :root/.dark.
5. Black band "thema.json": "Take the whole system *with you*." + the three CLI commands from packages/cli/README.md, link to `/agents`.
6. CTA "Get your *five* files."

## For agents (`/agents`)

1. Hero, 2 columns: "Your agent, now with *taste.*", buttons "Set up the MCP server" (→ #setup, primary) and "View on GitHub ↗" (ghost). Right: a black terminal showing an agent calling `thema.extract` ×2, `thema.blend`, `thema.get_design_md`.
2. "Reads into" agents strip, identical to the Landing's (same hover spec, same generic icons).
3. "Two ways in.": two cards: Drop DESIGN.md in your repo (No setup), Let your agent call Thema (MCP).
4. #FAFAFA band "Three tools. That's the whole API.": extract, blend, get_design_md, each with takes/returns from packages/mcp/README.md.
5. Setup (**interactive tabs**: Claude Code, Cursor, CLI, `aria-pressed`): black code panel with the exact commands from the READMEs, and the note "Until the npm package ships, run it from a clone of the repo." Update the snippets the day the package is published.
6. Black band "Open source · MIT": "The engine is *yours* to read." + white pill "Star on GitHub ↗" and the repo URL in mono.
7. CTA.

## Pricing (`/pricing`)

1. Centered hero: "Every feature, *free* to start." Subhead: plans only differ in projects kept and sites read a day.
2. **Billing toggle (interactive):** Monthly / Yearly ("save 33%" chip), `aria-pressed`.
3. Three plan cards (equal height):
   - No account: $0 forever, "Paste a site" (ghost) → `/`. 1 project in this browser · 3 new extractions a day · every feature and export.
   - Free: $0 forever, "Sign in free" (black). 3 saved projects · 10 a day · every feature and export.
   - Pro (black card, soft shadow, Kiln "for regular use" chip): $12 / month or $96 / year ("That's $8 a month, billed once a year."), "Upgrade to Pro" (Kiln Deep, the page's one primary button). Unlimited projects · 50 a day · everything in Free.
   - Under the cards: "Prices in USD. Payments run through Paddle, which handles sales tax and VAT for your country."
   - **Until Paddle approves the account:** the Pro button says "Coming soon" and is not a link (keep it focusable text, not a disabled button), per SPEC (Pro is a flag on the account).
4. #FAFAFA band "Compare plans.": a real `<table>` (th scope col/row) inside a white card with overflow-x auto: Price, Saved projects, New extractions a day, Sites per blend, Blend/sliders/locks, WCAG fixes and dark mode, Preview on 3 templates, All five exports and thema.json, Sign-in.
5. Two columns: black card "Prefer your terminal? The CLI and MCP server are free." (→ `/agents`) and "Pricing questions." as 4 open Q&As in a 2-column grid (no accordion): card needed? / better exports? / what's an extraction? / how am I billed?
6. CTA "Your first blend is *free*." (black pill, since the page's primary is Upgrade to Pro).

## Landing changes that come with this

- Nav links go to the four routes; GitHub is the external link above.
- FAQ "Do I need an account?": "Your first blend works without sign-up. Sign in with GitHub or Google to keep saved projects. The CLI and MCP server run on your own machine and need no account." (the old answer wrongly said the MCP server needs sign-in).
- Footer GitHub link → the repo.
