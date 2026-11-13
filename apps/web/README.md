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

## API

Route handlers in `src/app/api`, running the engine and exporters in-process (Node runtime). Errors are `{ error: { code, message } }`.

| Route                                   | Body                         | Returns                                                                                                                                          |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/projects`                    | none                         | 201 `{ project }`: a new id, no references, sliders at 0. Nothing is stored.                                                                     |
| `POST /api/projects/:id/references`     | `{ url, borrowed }`          | 202 `{ reference, cached, limit }` while running, 200 when today's result is cached. 400 `blocked-url`, 429 `rate-limited` (with `Retry-After`). |
| `GET /api/references/:id`               |                              | `{ reference: { id, url, status, system?, warnings, derived, screenshot, error? } }`, or 404 after 24 h                                          |
| `GET /api/references/:id/screenshot`    |                              | The PNG                                                                                                                                          |
| `PATCH /api/projects/:id/blend`         | `{ project, locks?, name? }` | `{ system, generated, unresolved, adjustments, lockedClashes, ignoredLocks }`                                                                    |
| `POST /api/projects/:id/export?format=` | `{ system }`                 | One file (`design-md`, `tailwind`, `shadcn`, `dtcg`, `styleguide`) or `zip`, as a download                                                       |

**How the client sends an anonymous project.** Anonymous projects live in the browser only (SPEC), so the API is stateless for them. The browser keeps the whole `Project` (types.ts) and sends it with each blend: every reference with its `extracted` system (from `GET /api/references/:id`) and borrow tags, the sliders as `blend`, and the last blend as `result`, which is where locked values come from. Export takes the system to export, which is why it's a POST, not SPEC's original GET. Every body is checked against `src/server/schemas.ts` before it reaches the engine, and a test fails if that schema and `ThemaSystem` drift apart.

**Order in add-reference.** Validate the body, then run the SSRF guard with DNS (`@thema/url-guard`, the same rules as the worker), check today's cache for the URL (a hit is free), apply the anonymous daily limit (3 new extractions per client per UTC day, counted by a hash of the IP), and only then enqueue.

**Jobs** (`src/server/services.ts`):

- **Without `REDIS_URL`:** an in-memory queue runs the worker's extraction in this process. That's for development, and needs Chromium (`pnpm --filter @thema/worker exec playwright install chromium`).
- **With `REDIS_URL`:** jobs go to BullMQ, and `pnpm --filter @thema/worker queue` runs them.
- **Daily limit:** `THEMA_DAILY_EXTRACTIONS` overrides the anonymous limit, which is handy while developing.

Playwright, BullMQ and ioredis are dependencies of this app too: Next.js only keeps a package out of the bundle (`serverExternalPackages`) when the app can resolve it itself.

## Workspace

`/workspace` (`src/workspace/`): reference cards, the system on the stage, sliders and the accessibility report. `?url=` (from the Landing) adds that site once and is then dropped from the address.

- **The project lives in the browser** (`project.ts`, `localStorage` key `thema.project.v1`, read and written defensively). It holds each reference with its extracted system, the sliders, the locks and the last result, and is sent with every blend, since the API is stateless. When storage is blocked, the top bar says the project isn't saved.
- **Borrow tags:** every tag has exactly one owner. The first reference starts with all five; pressing a chip on another card moves that tag there; removing a reference gives its tags to the first remaining one.
- **Lock and swap:** a lock keeps a token's value from the last result through every blend and the fixer. Swap ("Use x's value") writes another reference's value into the last result and locks it, so it goes through the same blend route. Lockable: each color role (in the theme shown), font families, radius sm/md/lg, shadow sm/md/lg.
- **Live updates:** references still extracting are polled every second (their card shows the real stage). A blend runs when an input changes, debounced 150ms; a newer blend cancels the one in flight. Only finished references are blended.
- **Fonts** are shown by name with fallback stacks; web fonts aren't loaded (no runtime requests), so a sample renders exactly only where the font is installed.

`/preview` and `/export` are placeholders until Session 12.
