# Claude Code session prompts

Run these in order, one session each, on branch `m1-extract`. Start every session in plan mode (Shift+Tab), approve the plan, then let it build. After each session: `pnpm test`, review the diff, commit.

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

Weeks 3+ (blend, fixer, exporters, web app, MCP) get their prompts after the week-2 gate passes.
