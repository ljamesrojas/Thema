# Thema — rules for Claude Code

Thema turns several reference websites into one original, accessible design system (DESIGN.md, Tailwind v4, shadcn, DTCG tokens) that AI coding agents can follow.

## Read first
- `SPEC.md` is the source of truth. Before any feature work, read the section named in the task. If the task conflicts with SPEC.md, stop and ask.
- `DESIGN.md` is Thema's own design system. All UI in `apps/web` follows it.
- `docs/prompts.md` lists the planned sessions in order.

## Stack
- pnpm workspaces + Turborepo. Node 22 LTS. TypeScript strict everywhere, no `any`, no non-null `!` without a comment.
- Vitest for tests. culori for color math. Playwright (Chromium) only in `apps/worker`.
- Next.js App Router + Tailwind v4 + shadcn/ui in `apps/web` (not before week 3).

## Architecture rules
- `packages/engine` is **pure**: no network, file system, browser, clock or randomness. Data in, data out. This is what makes it testable.
- `apps/worker` only drives the browser and returns raw `StyleSample[]` plus a screenshot. No analysis logic there.
- Colors are OKLCH strings inside the engine. Only `packages/exporters` converts to hex/rgb.
- Deterministic code decides every token value. The LLM may only name roles and write prose — never produce or change a value.
- One `ThemaSystem` type (SPEC.md → Data model) flows through everything. Change it in `packages/engine/src/types.ts` only, and update SPEC.md in the same commit.

## Testing
- Every engine change gets a unit test. Prefer small, readable fixtures.
- Recorded sample sets live in `fixtures/<name>/samples.json` with `expected.json` (the tokens a human verified). Snapshot tests must pass.
- Fixtures are synthetic or recorded from sites we test against; never commit full page HTML, images or fonts from third-party sites.
- Run `pnpm test` and `pnpm typecheck` before every commit. Don't commit with failing tests.

## Workflow
- Plan first for anything bigger than a small fix: list files to touch and the tests you'll write, then wait for approval.
- Small commits with clear messages. One milestone per branch: `m1-extract`, `m2-blend`, `m3-preview`, `m4-mcp`.
- Don't add dependencies without saying why in the plan.
- Don't build ahead of the current milestone (no web UI in weeks 1–2).
- When you make a decision SPEC.md doesn't cover, note it under "Decisions log" below.

## Commands
- `pnpm install` · `pnpm test` · `pnpm typecheck` · `pnpm lint`
- `pnpm --filter @thema/engine test` for engine-only runs

## Decisions log
- 2026-11-08: Project started. Palette and look approved (see DESIGN.md).
- 2026-11-08: ΔE in SPEC means ΔE OK: OKLab Euclidean distance × 100 (white↔black ≈ 100). Clustering uses < 4, fixture tolerance < 2.
- 2026-11-08: Translucent colors are composited (sRGB) onto the canvas, which is found first from opaque backgrounds only.
- 2026-11-08: Clustering is greedy, heaviest color first; a cluster's representative is a real member color, not an average. Each role reports the heaviest exact color among the members that count for it (text for ink, borders for hairline…), since one cluster can mix e.g. a navy footer background and body text.
- 2026-11-08: Primary/accent scores are scaled by min(1, distinct samples / 3) so one-off cookie buttons and ads can't win.
- 2026-11-08: Accent must differ from primary by ≥ 20° hue, not by ΔE: hover shades sit 6–10 ΔE away at the same hue, while blue→violet is only ~12 ΔE apart.
- 2026-11-08: Confidence per role = 1 − runnerUp / winner (1 = no rival, 0 = tie).
- 2026-11-08: TypeScript pinned to ~6.0 because typescript-eslint 8 supports only < 6.1.
- 2026-11-08: Prettier ignores the hand-written root docs (CLAUDE.md, DESIGN.md, SPEC.md, docs/).
- 2026-11-08: Typography units: `size` px, `lineHeight` unitless (px ÷ size), `tracking` em (px ÷ size). `families.*` are family names only ("Inter"); exporters add fallback stacks. `sans` falls back to "system-ui".
- 2026-11-08: Type scale: sizes weighted by area × role weight, < 1% of text weight dropped; base = heaviest body size; keep the 2 heaviest below (xs, sm) and 5 heaviest above (lg…4xl). Per-step lineHeight/weight/tracking use raw area, so ×3 buttons or a bold ad don't set the body weight. Ratio = median of (size/base)^(1/k).
- 2026-11-08: Display family = used ≥ 80% on headings while another family carries body text.
- 2026-11-08: Spacing base = 8 when ≥ 75% of values seen on ≥ 2 samples are multiples of 8, else 4 (robust form of SPEC's GCD rule). Values counted once per sample, > 256px ignored, snapped to base, one-offs dropped.
- 2026-11-08: Radius and shadow sm/md/lg: md = most common, sm/lg = most common below/above (ties → closer to md), missing → md. Radius skips 0 and pills (≥ 500px). Shadow colors stay OKLCH with alpha (`formatOklch` now emits `/ a` below 1); inset-only shadows skipped.
- 2026-11-08: Worker CLIs run with tsx (Node's type stripping can't follow the engine's `.js` → `.ts` imports). esbuild may inject `__name(...)` into functions passed to `page.evaluate`, so `inFrame` defines a no-op `__name` in the page first.
- 2026-11-08: Collector keeps visible elements with a style signal (background, drawn border, text, interactive/heading role, shadow, radius), max 2000 by area. `borderColor` only for drawn borders (widest side); `line-height: normal` = 1.2 × font size; radius = largest corner (% → px); gap only on flex/grid. The `html` sample reports the color that paints the canvas: html, else body (CSS propagation), else the UA `Canvas` color.
- 2026-11-08: Cookie banners: reject/necessary-only before accept; vendor selectors first, then exact labels only inside consent-looking containers (or consent-vendor iframes), so random "OK" buttons are never clicked.
- 2026-11-08: SSRF: Playwright's route sees only the first request of a redirect chain, and Chromium follows redirects (even fulfilled 3xx) outside the route, verified with a probe. So the worker follows redirects itself (`fetchGuarded`, ≤ 10 hops) and checks every hop before requesting it; the page's own redirects are resolved before `goto`. Remaining gaps: DNS rebinding and WebSocket/WebRTC. A hosted worker needs an egress firewall as the real boundary.
- 2026-11-08: Dark samples are kept when `canvasFlipsInDark` (engine): light-pass canvas L > 0.5 and dark-pass canvas L < 0.5.
- 2026-11-08: `--out` resolves against the repo root. Recorded `samples*.json` are skipped by Prettier (machine data); fixtures without `expected.json` are skipped by tests until verified.
- 2026-11-08: `StyleSample.opacity` (SPEC updated) is the effective opacity including ancestors, sent only below 1, never on `html` (its sample is the canvas, so a whole-page `html { opacity }` is ignored). The engine multiplies it into each color's alpha before compositing onto the canvas (not the real parent: faded text on a dark footer is slightly off). Box shadows aren't faded. Found via example.com, whose `p+p { opacity: .6 }` paragraphs were recorded as black.
- 2026-11-08: Ink rule changed (SPEC updated): among neutral text colors with ≥ 15% (`INK_MIN_SHARE`) of the heaviest one's weight, ink is the one with the most contrast against the canvas; confidence is on contrast. Replaces "dominant text = ink", which made example.com's four faded gray paragraphs ink and left no ink-muted. ink-muted is unchanged (next neutral text between ink and canvas, by weight). 15% because example.com's black paragraph is 21% of its gray text; tuned on one site, so recheck against the 20-site set.
- 2026-11-08: Accuracy gate (`pnpm accuracy`): score = share of individual checks passed (primary within ΔE 5, font families exact set (case/quote-insensitive), spacing base equal), counted over recorded real sites only (`"source": "recorded"`); synthetic fixtures keep exact snapshot tests. A check not filled in counts as not passed and fails the command. `"primary": null` = site has no primary. Hex allowed in expected.json.
- 2026-11-08: Accuracy ratchet: `pnpm accuracy --save` writes `fixtures/accuracy-baseline.json` (passing checks per real site) and refuses if a previously passing check would be lost; `accuracy-ratchet.test.ts` fails `pnpm test` on any regression or a baselined site disappearing.
- 2026-11-09: PENDING ink rule (from Stripe review; engine unchanged for now, handle it when we fix rules after the first accuracy report): ink should be the darkest text color used widely across headings and body, not the color covering the most area. On Stripe the most-used text color (#50617a, body copy) is the muted one; ink is #061b31 (headings), ink-muted #50617a. Compare against the current `INK_MIN_SHARE` rule (highest contrast among text colors with ≥ 15% of the top weight): "used widely" likely means counting heading and body use together rather than a share of the top color.
- 2026-11-09: Monochrome fixtures (`"monochrome": true` in expected.json, e.g. Resend): primary passes when the engine returns no primary or one with OKLCH chroma < 0.03 (`MONOCHROME_MAX_CHROMA`), and fails on any saturated color (e.g. the demo email's #00a3ff / #3b9eff). The expected `roles.primary` is then informational. "None" counts as a pass because the engine's primary rule only considers saturated colors (chroma ≥ 0.06), so it never returns a neutral primary.
- 2026-11-09: PENDING (Resend lessons; engine/worker unchanged for now, handle after the first accuracy report):
  1. Exclude text inside `pre`/`code` from ink and color clustering: 553 of Resend's 905 samples were code-highlight spans.
  2. Ignore embedded demo content whose fonts differ from the page's main fonts (Resend's ACME email preview).
  3. The recorder misses button fills drawn by child elements, `::before`/`::after` or `background-image` (Resend's glass CTA, Duolingo's green `::before`); capture those.
  4. Consider a "heading" font slot: Resend uses ABC Favorit for h2/h3 and Domaine for the hero, but there's only one `display` slot.
- 2026-11-09: Recorder scrolls gradually (`scrollThrough`: 600px steps, 300ms pause, re-checking the bottom as lazy content grows the page, capped at 60 steps for infinite scroll), then returns to the top and waits for network idle before sampling. A single jump to the bottom skipped IntersectionObserver reveals in between (covered by a test). Re-recording vercel.com gave identical samples (193): its blank middle is fixed/sticky scroll-driven layers (incl. a full-viewport fixed layer), which a full-page screenshot shows only once. The DOM content there was already sampled; canvas/WebGL drawing can't be read from computed styles.
- 2026-11-09: PENDING spacing lesson (from Vercel review; engine unchanged for now, handle after the first accuracy report): spacing counts get skewed by many repeated identical decorative elements (Vercel had 488 instances of 2px). When finding the spacing base, count each distinct element style once (dedupe by tag + class + value), or weight by element area, instead of counting every element. Today the engine counts each distinct value once per sample, so 100 identical decorative dots still cast 100 votes. Deduping by class needs the class (or a style signature) in `StyleSample`, which it doesn't carry yet: that's a data-model change (types.ts + SPEC.md). Area weighting works with today's data.
- 2026-11-09: Recorder dismisses location/locale modals (`dismissLocaleModal`, after the cookie banner, same approach): find a short "where are we shipping to? / choose your country" text inside an overlay (dialog, aria-modal or fixed layer), then click its close button (×, Close, No thanks, Stay here…) or press Escape. It never picks a country (that redirects to another storefront), and leaves non-locale modals and inline footer pickers alone. Allbirds re-recorded: modal closed, US site, 133 samples (was 97 with the modal and a blank middle).
- 2026-11-09: PENDING (from the first accuracy report, 68.4%; don't fix until planned):
  1. Spacing: live pages often disagree with the recorded samples (GitHub, Glossier, Medium, Supabase, Allbirds read as 8 in samples but are 40–64% multiples of 8 live). Likely cause: the 2000-element cap by area drops small elements, whose padding/gaps (4, 6, 10, 12, 20) break the 8-grid. Check whether samples under-represent small elements.
  2. Hidden skip links (Linear's "Skip to content" #5e6ad2) must not count for primary: ignore visually-hidden / off-screen elements.
  3. Display detection: count h4–h6 and large text (≥ 20px) as heading-like. Supabase's Manrope is a display face, but only ~70% of its uses are h1–h4 (the rest are footer h6s and 22px quotes).
  4. Mailchimp has 7 more yellow CTAs painted by `::before` (adds to the `::before` recorder lesson above).
- 2026-11-09: DONE primary fixes (SPEC updated): (a) text/border colors within ΔE 1 of browser-default link colors (#0000ee, #551a8b, #ee0000 and dark-scheme #9e9eff, #d0adf0, #ff9e9e) are ignored; Stripe/Headspace lost to large unstyled card links. (b) Recorder skips visually hidden elements (zero `clip`/`clip-path` on self or ancestor, boxes ≤ 1px). (c) `StyleSample.fill` (types.ts + SPEC): fill behind a transparent button from its gradient, a covering `::before`/`::after` (≥ half its width and height) or a child covering ≥ half its area; the engine uses it when `backgroundColor` is transparent. (d) `StyleSample.y` + monochrome rule: first-screen CTAs = interactive, y < 900, ≥ 1000 px², fill ΔE ≥ 10 from the canvas (excludes React's light search bar 5.7, Notion's light demo button 4.7); if there are any and all have chroma < 0.03, no primary. Uses all CTAs, not the most prominent, because Headspace's largest hero buttons are dark gray while its header CTA is the blue primary. Inactive with no first-screen CTAs (GOV.UK) or no `y` (older recordings, synthetic fixtures). Resolves PENDING items 2 (skip links) and 4 (Mailchimp ::before) above, and Resend lesson 3 (fills).
- 2026-11-09: Recorder `fill` limited to button-sized elements (≤ 480×80): 39 of 70 fills came from cards/sections, and Supabase's 940×384 gradient card stole primary. Tallest real CTA on our sites 78px (Headspace tiles), widest 435px; Mozilla's 1440px rows and React's 777px search bar are outside on purpose.
- 2026-11-09: PENDING primary lessons (from the 75.4% run):
  1. Resend: a decorative gradient glow counts as a CTA fill. A first-screen hero link (likely the announcement pill) records `fill: rgba(2, 252, 239, 0.44)` from its gradient's first stop, so one first-screen CTA reads as saturated and the monochrome rule stays off. Translucent or decorative gradient fills shouldn't count as a CTA's color.
  2. Duolingo: the green `::before` fill is now recorded (7 × #58cc02), but a lighter green rgb(165, 237, 110) on 67 small interactive samples outweighs it (ΔE 13.6 apart, separate clusters).
- 2026-11-09: DONE font fixes (SPEC updated; `families.heading` and `StyleSample.inHeading`/`inCode` added to types.ts): (a) a leading generic keyword is reported as the keyword, never the font the machine resolves it to: `-apple-system`/`BlinkMacSystemFont` → `system-ui`, `-apple-system-ui-serif` → `ui-serif` (Substack), `ui-*` kept (cal-com's `ui-monospace`); results no longer depend on the recording OS. (b) "X VF", "X Variable", "X-var" merge with "X" (weights summed); the accuracy comparison strips these suffixes on both sides. (c) Non-mono families under 2% of text weight are dropped (`FAMILY_MIN_SHARE`; Notion's Lyon Text 1.3%, smallest real non-mono family Allbirds' Self Modern 4.1%). Mono families skip the share (Glossier's Apercu Mono is 0.05%, Vercel's Geist Mono 0.18%, neither in code) but need ≥ 3 elements (`MONO_MIN_ELEMENTS`) or any use inside code, so one stray monospace element can't add a mono font. On all 19 sites every mono family found is an expected one. (d) Heading-like text = heading role, `inHeading` (spans nested in h1–h6, recorded by the worker), or ≥ 20px and larger than the base body size (so 21px editorial body copy stays body); text inside headings no longer counts toward the base body size. (e) Non-mono families ≥ 80% heading-like (while another family carries the body) are headings-only: the one with the largest heading text is `display` (Resend's 96px Domaine, not its heavier ABC Favorit), the heaviest other one is `heading`. Mono is never display (GitHub's 64px Mona Sans Mono). Resolves Resend lesson 4 and first-accuracy-report item 3. Fonts 11/19 → 18/19.
- 2026-11-09: PENDING (page variants): some sites serve a different page per load. Substack's homepage alternated between a version with Cahuenga h3/h4 headings, versions with no headings at all (330–540 samples), and a near-empty bot-check page (3 samples). A recording can then be unrepresentative without any error. For users: if a recording has no h1–h6 at all, flag the result as low confidence instead of trusting it (and consider recording more than once).
