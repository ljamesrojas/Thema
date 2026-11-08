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
