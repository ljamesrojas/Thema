# Claude Code session prompts

Run these in order, one session each: Sessions 1–4 on branch `m1-extract`, 5–8 on `m2-blend`, 9–12 on `m3-preview`, 13–15 on `m4-mcp`. Before each new branch, merge the previous one into `main` and branch from the updated `main`. Start every session in plan mode (Shift+Tab), approve the plan, then let it build. After each session: `pnpm test`, review the diff, commit.

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

# Week 5 — Web app and preview (branch `m3-preview`)

Phase 2 landed: `extractSystem → blend → fix → exporters` works end to end on 22 fixtures, and every DESIGN.md passes Google's linter. Nothing of `apps/web` exists yet, so week 5 builds the app before the preview. Thema's own UI follows the root `DESIGN.md`; user palettes and previews sit on the neutral Stage color, never on cream.

---

## Session 9 — Web app scaffold and Landing

```
Read CLAUDE.md, DESIGN.md (Thema's own design system), and SPEC.md → User flow and screens, Visual design of Thema, Architecture and stack. Open the approved Landing and Workspace mockups linked in SPEC.md.

Create apps/web: Next.js App Router, TypeScript strict, Tailwind v4, shadcn/ui.
- Implement DESIGN.md's tokens as Tailwind v4 theme variables and shadcn variables (Paper canvas, Ink text, Kiln/Kiln Deep, the Stage color for previews; Geist, Instrument Serif italic accent word, Geist Mono for hex and tokens). Don't hand-copy values DESIGN.md doesn't list; ask if something is missing.
- Build the Landing page from the mockup: hero URL input, 3 example blends (built from our recorded fixtures through the engine and exporters, not screenshots of third-party sites), how-it-works strip. The URL input validates the URL client-side and routes to the Workspace; no backend yet.
- Paint-chip motif and logo (three stacked chips) as components.
- Tests: component tests for the URL input (valid, invalid, private/localhost rejected with the same rules as the worker's SSRF guard, imported, not duplicated), and an accessibility check (axe) on Landing.
Say why for any new dependency. Plan first.
```

---

## Session 10 — API and extraction jobs

```
Read CLAUDE.md and SPEC.md → Architecture and stack (API routes), Features in detail → 1. Reference intake, MVP scope (anonymous use, limits), Risks (rate limits, cache).

Build the API as Next.js route handlers, running the engine and exporters in-process:
- POST /api/projects, POST /api/projects/:id/references (URL + borrow tags; enqueues extraction), GET /api/references/:id (status + extracted system + warnings), PATCH /api/projects/:id/blend (borrow tags, sliders, locks → blend → fix → the new ThemaSystem, under 200 ms), GET /api/projects/:id/export?format= (design-md, tailwind, shadcn, dtcg, styleguide, zip).
- Jobs behind an interface: a local runner for development (calls the worker's extract), and the BullMQ + Redis implementation (1 job per URL, 3 at a time, retries) behind the same interface. Hosting is decided later; propose the interface so either works.
- 24 h cache by URL + day; anonymous users limited to 3 extractions/day; SSRF guard before enqueueing (reuse apps/worker's).
- Anonymous projects live in the browser only (SPEC): the API is stateless for them. Say how the client sends the project.
- Surface extractSystem's warnings (no-headings, few-samples, no-dark-theme, monochrome) and fix's unresolved pairs in the responses.
Tests: route tests with the worker mocked (recorded fixtures as fake results), cache and rate-limit tests, the blend route's timing on a 5-reference project, and export formats matching packages/exporters byte for byte. Plan first.
```

---

## Session 11 — Workspace

```
Read CLAUDE.md, DESIGN.md, SPEC.md → User flow (steps 2–4), Screens (Workspace), Features in detail → 3. Blend engine, and the Workspace mockup.

Build the Workspace:
- Reference cards: URL, status line (fetching, reading styles, naming roles), screenshot thumbnail, warnings from extraction, borrow chips (Colors, Type, Spacing, Shape, Layout); a chip belongs to one reference at a time; up to 5 references.
- Token panel: palette (paint chips, hex in Geist Mono), type scale, spacing, radius, shadow; light/dark switch.
- Sliders (density, roundness, contrast, warmth) and locks: lock or swap any single token ("swap" = take that token from another reference, then lock it). The system updates live via the blend route.
- Accessibility report from a11y.fixes and the unresolved pairs, including "locked: can't fix".
Tests: chip ownership rules, lock/swap behaviour, the report rendering fixes and unresolved pairs, keyboard access for chips and sliders, axe on the Workspace. Plan first.
```

---

## Session 12 — Preview and Export

```
Read CLAUDE.md, DESIGN.md, SPEC.md → Features in detail → 5. Preview and 6. Exports, Screens (Preview, Export).

- Preview: three templates (Landing, Dashboard, Settings form) built only from shadcn/ui components that read CSS variables, so applying a system means swapping variables (no rebuild). Template switcher, light/dark toggle, desktop/mobile viewport, and the compare view (source screenshot next to the template). Previews sit on the Stage color.
- Export: format checklist, file preview with a copy button per file, zip download, and the MCP and CLI snippets (placeholders until week 6 names the commands).
- Anonymous projects: saved in the browser only, one project (SPEC).
Tests: every template renders with each of the 22 fixtures' exported shadcn.css without missing variables; the light/dark toggle swaps only variables; the zip contains the five files; axe on Preview and Export. Plan first.
```

---

# Week 6 — Agents and launch (branch `m4-mcp`)

Open questions in SPEC.md to answer before these sessions: worker hosting (Fly.io, Railway or a browser service), the LLM and its monthly budget, the CLI license, and the Pro price.

---

## Session 13 — Names and prose from the LLM (deferred)

Deferred on 2026-11-14: no LLM and no budget for now (see SPEC → Open questions). DESIGN.md prose stays deterministic; pick this session up after launch if the writing needs it. Week 6 continues with Session 14.


```
Read CLAUDE.md (deterministic code decides every value; the LLM only names roles and writes prose) and SPEC.md → Architecture and stack (LLM), Output formats (DESIGN.md prose).

Add the LLM step behind an interface in a new package (not in packages/engine, which stays pure):
- voice: mood words and a summary for ThemaSystem.voice, from the tokens and source URLs.
- DESIGN.md prose: the Overview, Do's and Don'ts and Agent rules sections, written from the token object. The exporters keep the deterministic template as the fallback when the LLM is off or fails.
- Use the Claude API (look up the current model IDs; a small model for naming, a larger one for prose). The model never sets token values: validate that every hex, size and name in its output exists in the system, and reject the output otherwise.
- Cache by system hash; log cost per run.
Tests: the validator rejects invented values; the fallback path; DESIGN.md with LLM prose still passes Google's linter (mocked LLM responses, no network in tests). Say why for any new dependency. Plan first.
```

---

## Session 14 — MCP server and CLI (done 2026-11-14)

```
Read CLAUDE.md and SPEC.md → MVP scope (MCP tools, CLI), Architecture and stack (MCP).

- packages/mcp: an MCP server (official TypeScript SDK) with 3 tools: extract (URL → system + warnings), blend (references, borrow tags, sliders, locks → system), get_design_md (system or project → DESIGN.md). Tools call the same engine, exporters and API as the web app.
- packages/cli: an open-source CLI wrapping the engine and worker: thema extract <url>, thema blend <files…>, thema export --format …, reading and writing ThemaSystem JSON. Same SSRF guard; no web app needed.
- Fill in the Export screen's MCP and CLI snippets.
Tests: each MCP tool against recorded fixtures (worker mocked), CLI commands end to end on fixtures, and the CLI's DESIGN.md passing the linter. Plan first.
```

---

## Session 15 — Accounts, saved projects and launch

Split in two (2026-11-15). **15a, accounts and saved projects: done 2026-11-15** (Neon Postgres + Better Auth with GitHub and Google + Cloudflare R2 instead of Supabase, whose free projects pause; Projects screen; claiming the browser project; autosave with stale-save protection; Free/Pro limits). **15b, launch, is next:** deploy the web app (Vercel), the worker and Redis on an Oracle Cloud Always Free VM behind a firewall that blocks private ranges, publish `@thema/cli` and `@thema/mcp` to npm (Export screen snippets switch to `npx`), Terms, Privacy and Refund pages (Paddle needs them), and the launch checklist below. Paddle billing follows once Paddle approves the account. The original prompt:

```
Read CLAUDE.md and SPEC.md → MVP scope (anonymous vs signed-in), Screens (Projects), Architecture and stack (Supabase, queue, worker hosting), Risks.

- Supabase: auth, Postgres (projects, references, cached extractions), Storage (screenshots). Signing in unlocks saved projects; the anonymous browser project can be claimed on sign-in.
- Projects screen: grid of saved systems with their palette strips.
- Deploy: the web app, the worker in a long-running container behind an egress firewall that blocks private ranges (the SSRF guard is defence in depth), Redis + BullMQ for jobs.
- Launch checklist: rate limits, error messages for blocked sites, source attribution in every file, "inspired by" wording (no brand cloning), and a metrics plan for the 4-week check.
Tests: auth-gated routes, claiming an anonymous project, the worker's firewall assumptions documented, and the SSRF tests still passing in the container. Plan first.
```
