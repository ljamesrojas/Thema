# @thema/web

The Thema web app: Next.js (App Router), Tailwind v4 and shadcn-style components. Its own UI follows the root `DESIGN.md`.

```sh
pnpm --filter @thema/web dev      # http://localhost:3000
pnpm --filter @thema/web build    # production build (webpack, see below)
pnpm --filter @thema/web tokens   # regenerate tokens after editing DESIGN.md
pnpm --filter @thema/web test
```

## Tokens come from DESIGN.md

No token value is typed by hand in the app:

- `src/app/tokens.generated.css` is generated from the root `DESIGN.md` by `pnpm --filter @thema/web tokens`, using `@google/design.md`'s Tailwind export (pinned at 0.4.0). The script also adds what that export drops: each text style's line height (read from DESIGN.md's front matter with `yaml`), its weight and tracking (so one `text-<style>` class sets all four), and each style's font pointed at its self-hosted `next/font` variable. A test fails if the committed file is out of date.
- `src/app/globals.css` only maps names: font roles, the `.dark` remap to DESIGN.md's `dark-*` tokens, and the shadcn variables.
- A test fails on any hex literal in `src/`.

Use the generated utilities: `bg-canvas`, `text-ink-soft`, `border-hairline`, `bg-stage`, `text-h2 font-h2`, `text-token font-token`, and so on.

## Why webpack

The workspace packages (`@thema/engine`, `@thema/exporters`, `@thema/url-guard`) ship TypeScript source and import their own files as `./x.js`. Turbopack, Next.js 16's default, can't map that to `x.ts`, so `dev` and `build` run with `--webpack` and `next.config.ts` sets `resolve.extensionAlias`.

## Landing

From the approved mockup (SPEC.md → Screens). The hero's blend is computed at build time by the real pipeline (`extractSystem → blend → fix`) from the three synthetic fixtures (`src/lib/hero-blend.ts`), so its chips, the "WCAG AA · 12/12 pairs" line and the before → after rows are real. Its references are labelled with reserved `.example` domains: no real site appears on the marketing page.

The URL input validates with `@thema/url-guard` (the worker's network-free SSRF rules) and goes to `/workspace?url=…`, a placeholder until Session 11. Nav links to sections that don't exist yet (Pricing, GitHub, Docs, Privacy, Sign in, MCP setup) are in-page anchors for now.
