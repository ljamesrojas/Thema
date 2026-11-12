# Claude Code session prompts

Run these in order, one session each: Sessions 1–4 on branch `m1-extract`, Sessions 5–8 on `m2-blend`. Start every session in plan mode (Shift+Tab), approve the plan, then let it build. After each session: `pnpm test`, review the diff, commit.

---

## Session 1 — Scaffold + engine types + color analysis

```
Read CLAUDE.md, then SPEC.md sections "Data model", "Features in detail → 2. Extraction engine" and "Build plan → Repo layout".

Goal for this session: scaffold the monorepo and build the first piece of the pure engine — turning raw style samples into a named color palette. No browser, no web app yet.

1. Scaffold a pnpm + Turborepo monorepo matching the repo layout in SPEC.md. Create only these for now:
   - packages/engine (TypeScript, Vitest, culori)
   - fixtures/ (empty except what step 4 adds)
   - root scripts: test, typecheck, lint (ESLint + Prettier)
   Leave apps/web, apps/worker, packages/exporters, packages/mcp and packages/cli as empty folders with a README line each.
2. In packages/engine/src/types.ts, add the ThemaSystem types and the StyleSample type exactly as in SPEC.md.
3. Implement analyzeColors(samples: StyleSample[]) in packages/engine/src/colors.ts:
   - parse computed CSS colors with culori, ignore fully transparent ones
   - convert to OKLCH and cluster with ΔE (OK) under the threshold in SPEC.md
   - weight each sample by area, with interactive elements and headings counting extra (put the weights in one constants file)
   - assign roles: canvas (largest background), surface (second background close to canvas), ink (dominant text), ink-muted, hairline (borders), primary (most-weighted saturated color on interactive elements), accent (next distinct saturated color)
   - return Partial<Record<ColorRole, string>> plus a confidence 0–1 per role
4. Create 3 synthetic fixtures in fixtures/: light-saas (white canvas, blue primary), dark-dev-tool (near-black canvas, green primary), warm-editorial (cream canvas, orange primary). Each has samples.json (25–40 realistic StyleSamples) and expected.json (the roles you expect). Make them realistic, including noise like a cookie banner and an ad-colored badge that should NOT win primary.
5. Write tests: unit tests for clustering and role rules, plus one snapshot test per fixture comparing analyzeColors output with expected.json (allow ΔE < 2 tolerance).
6. Make pnpm test and pnpm typecheck pass. Add a short packages/engine/README.md.

Show me the plan first. Don't implement typography or spacing yet.
```

---

## Session 2 — Typography and spacing analysis

```
Read CLAUDE.md and SPEC.md → Extraction engine. Continue in packages/engine.

Implement analyzeTypography(samples) and analyzeSpacing(samples):
- Typography: detect sans/serif/mono/display families (normalize quoted names and fallbacks), build the scale from distinct font sizes weighted by area, name steps xs…4xl, estimate the ratio, and keep lineHeight/weight/tracking per step.
- Spacing: find the base unit (4 or 8) from common padding/margin/gap values, snap to a scale, ignore outliers.
- Also derive radius (sm/md/lg) and shadow (sm/md/lg) from samples.
Extend the 3 fixtures' expected.json and add tests the same way as session 1. Plan first.
```

---

## Session 3 — Playwright worker

```
Read CLAUDE.md and SPEC.md → Extraction engine and Architecture. Create apps/worker.

Build a CLI-runnable worker (no queue yet): `pnpm --filter @thema/worker extract <url> --out fixtures/<name>/`
- Launch Chromium at 1440×900, wait for network idle, try to dismiss common cookie banners, scroll once to trigger lazy content.
- Collect StyleSample[] from visible elements via page.evaluate (computed styles + bounding box area + role guess from tag/ARIA).
- Re-run with prefers-color-scheme: dark and keep the dark samples if the canvas lightness flips.
- Save samples.json and samples.dark.json, plus a screenshot (screenshot stays gitignored).
- Add an SSRF guard: reject localhost, private IP ranges and non-http(s) URLs.
Then wire a small script that runs the engine on the saved samples and prints the palette. Plan first.
```

---

## Session 4 — Accuracy harness (the week-2 gate)

```
Read CLAUDE.md and SPEC.md → MVP scope (success criteria) and Build plan.

Build an accuracy report: `pnpm accuracy` runs the engine on every fixture and prints a table — per fixture: primary color correct (ΔE < 5), font families correct, base spacing correct — and an overall %. Fail the command below 90%.
I'll record ~20 real sites with the worker into fixtures/ and fill expected.json by hand. Help me write a checklist for filling expected.json consistently.
```

---

# Weeks 3–4 — Blend and fix (branch `m2-blend`)

The week-2 gate passed: 56/57 checks (98.2%) on 19 real sites. Every session below keeps `pnpm test` green, including the accuracy ratchet. No web UI yet (that's week 5).

---

## Session 5 — One complete ThemaSystem per reference

```
Read CLAUDE.md (including the Decisions log) and SPEC.md → Data model, Features in detail → 1. Reference intake and 2. Extraction engine.

Today the engine has separate analyzers (colors, typography, spacing, radius, shadow, dark), but nothing builds the full ThemaSystem that blending needs. Build extractSystem() in packages/engine:
- Input: light samples, optional dark samples, the SourceRef, and createdAt passed in (the engine stays pure: no clock).
- Output: a complete ThemaSystem for one reference. color.light/dark must have every ColorRole.
- Missing pieces to design (list each in the plan with the rule and the fixtures that check it):
  - layout: containerMax (from maxWidth), gutter (side padding of page containers), sectionY (vertical padding of sections). The recorder now keeps spacing wrappers, so this data exists.
  - motion: not recorded today. Propose either recording transition-duration/timing-function (a StyleSample change: types.ts + SPEC.md) or documented defaults.
  - surface-raised and primary-ink: derive deterministically (primary-ink = whichever of ink/canvas reads best on primary).
  - success/warning/danger/info: leave to Session 7's fixer, or propose a placeholder rule here; say which.
  - dark colors when the site has no dark theme: leave to Session 7; say what extractSystem returns until then.
  - voice stays empty ({ mood: [], summary: "" }): no LLM calls in the engine.
- Before the fixer depends on ink, recheck the PENDING ink rule (Stripe: ink #061b31, ink-muted #50617a) on the 19 recorded sites and report what changes.
- Also propose how to flag a low-confidence extraction (the PENDING page-variant lesson: a recording with no h1–h6 at all).
Tests: unit tests per new rule, plus a snapshot of extractSystem on the 3 synthetic fixtures. Don't change expected.json files. Plan first.
```

---

## Session 6 — Blend engine

```
Read CLAUDE.md and SPEC.md → Features in detail → 3. Blend engine, 1. Reference intake (borrow tags), and Data model (BlendSettings, locks).

Implement blend() in packages/engine: 2–5 extracted ThemaSystems plus borrow tags, BlendSettings and locks in, one ThemaSystem out. Pure and deterministic.
- Ownership: each tag (colors, typography, spacing, shape, layout) comes from the reference that owns it; by default the first reference owns every tag.
- Harmonize: when borrowed colors clash with the borrowed canvas, adjust lightness and chroma in OKLCH, keeping hue. Define "clash" with a number and justify it.
- Sliders (each -1..1, 0 = no change): density scales spacing 0.8–1.25×, roundness scales radius from 0 to pill, contrast shifts ink/canvas lightness, warmth rotates neutral hues ±10°.
- Locks: a locked token path (e.g. "color.light.primary") is never changed by ownership, harmonizing or sliders.
- meta.sources lists every reference with what it lent.
Tests: ownership defaults, every slider at -1/0/1, locks surviving every step, determinism (same input, same output), and a blend of two recorded fixtures (e.g. Stripe colors + Linear typography). Plan first.
```

---

## Session 7 — Accessibility fixer, dark mode, semantic colors

```
Read CLAUDE.md and SPEC.md → Features in detail → 4. Accessibility fixer and dark mode.

Implement fix() in packages/engine: ThemaSystem in, ThemaSystem out, with a11y.fixes and a11y.passes filled.
- Check every text/background role pair against WCAG 2.2 AA (4.5:1 body text, 3:1 large text and UI components). List the pairs in the plan.
- When a pair fails, nudge lightness the minimum amount needed (OKLCH, hue and chroma kept) and record "pair before → after". Locked tokens are never changed; if a lock makes a pair impossible, report it instead of passing.
- Generate a dark theme when no source provides one: invert the lightness ramp, lower chroma on large surfaces, then re-run the contrast check.
- Fill missing success/warning/danger/info with hues tuned to the palette's lightness and chroma.
Tests: each failing-pair case, minimal nudges (no overshoot), locks, the generated dark theme passing AA, and fix() on all 19 recorded fixtures' extracted systems (report how many pairs needed fixing). Plan first.
```

---

## Session 8 — Exporters

```
Read CLAUDE.md and SPEC.md → Output formats and Features in detail → 6. Exports.

Create packages/exporters. Each export is a pure function of ThemaSystem; this is the only package that converts OKLCH to hex/rgb.
- DESIGN.md (Google spec, version alpha): front matter tokens and the body sections in SPEC's order. No LLM yet: generate the prose sections from a deterministic template that only restates token values. Every file must pass `npx -y @google/design.md lint` with no errors (add it as a test; say in the plan how it runs offline in CI).
- theme.css (Tailwind v4 @theme), shadcn.css (:root and .dark in shadcn naming), tokens.json (W3C DTCG), style-guide.html (self-contained page rendering every token).
- Each file carries a header comment with the Thema version and source URLs. Family names get fallback stacks here.
- Add `pnpm export <fixture> --out <dir>` to run extractSystem → fix → every exporter on a recorded fixture.
Tests: one snapshot per format for a synthetic fixture, the DESIGN.md lint test, and round-trip checks (hex back to OKLCH within ΔE 1). Say why for any new dependency. Plan first.
```

---

Weeks 5+ (preview, web app, MCP, CLI) get their prompts after Phase 2 lands.
