# Thema

**Blend the websites you admire into one original, accessible design system that AI coding agents can follow.**

Paste up to five sites, choose what each one lends (colors, type, spacing, shape, layout), tune the result, and export it as `DESIGN.md`, a Tailwind v4 theme, a shadcn/ui theme, DTCG tokens and a style guide. Every color pair meets WCAG AA in light and dark mode.

**Live:** https://thema-ten.vercel.app · A personal project by [Lawrenze James Rojas](https://ljrojas.vercel.app)

## How it works

1. **Extract.** A headless Chromium loads each site, scrolls through it and records the computed styles of its visible elements (`apps/worker`). No HTML, images or fonts are kept, only measurements.
2. **Analyze.** A pure engine (`packages/engine`) turns those samples into a design system: color roles in OKLCH, font families and a type scale, the spacing base, radii, shadows and layout widths. It needs no network, clock or randomness, which makes every rule testable.
3. **Blend.** Each reference lends the parts you assign to it, and four sliders (density, roundness, contrast, warmth) adjust the result. Locks keep values you like.
4. **Fix.** An accessibility pass moves foreground colors until every checked pair reaches WCAG AA, and generates the missing light or dark theme.
5. **Export.** `packages/exporters` writes the files. The DESIGN.md output passes Google's DESIGN.md linter for every test fixture.

Deterministic code decides every token value.

Extraction accuracy is gated by `pnpm accuracy` over 19 recorded real sites: primary color, font families and spacing base are right in 56 of 57 checks (98.2%).

## Repository

| Path                           | What it is                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `apps/web`                     | The site, Workspace and API: Next.js (App Router), Tailwind v4, shadcn/ui, Better Auth, Postgres |
| `apps/worker`                  | The browser side: Playwright, the request fence, the extraction job                              |
| `packages/engine`              | Samples → design system, blending and the accessibility fixer (pure TypeScript)                  |
| `packages/exporters`           | DESIGN.md, Tailwind, shadcn, DTCG tokens, style guide                                            |
| `packages/url-guard`           | The SSRF rules shared by the web app, worker, CLI and MCP server                                 |
| `packages/jobs`                | The extraction queue (in-process, or BullMQ on Redis) and daily limits                           |
| `packages/cli`, `packages/mcp` | `thema` CLI and an MCP server with `extract`, `blend` and `get_design_md` tools                  |
| `fixtures`                     | Recorded style samples with human-verified expected values                                       |
| `deploy`                       | The deployment runbook and a worker-server kit                                                   |
| `SPEC.md`, `DESIGN.md`         | The product spec and Thema's own design system                                                   |

## Run it locally

You need Node 22 and pnpm (corepack picks the right version).

```bash
corepack enable
pnpm install
pnpm --filter @thema/worker exec playwright install chromium
pnpm --filter @thema/web dev        # http://localhost:3000
```

It runs without any configuration: extraction happens in-process and projects stay in the browser. `apps/web/.env.example` lists the optional settings: accounts (Postgres and GitHub or Google sign-in), screenshot storage, and the hosted modes.

Before committing, run:

```bash
pnpm test && pnpm typecheck && pnpm lint
```

## Hosting

The live site runs entirely on Vercel's free plan in **serverless mode** (`THEMA_EXTRACTION=serverless`):

- **Extraction:** runs in Vercel functions with a Lambda build of Chromium, one at a time, with a daily cap.
- **Data:** jobs, limits and totals live in Neon Postgres, and screenshots of saved projects in Cloudflare R2.

`deploy/README.md` has the full runbook, including a worker-server setup for later.

## Security

See [SECURITY.md](SECURITY.md) for how to report a problem and how the browser is fenced.

## License

- **MIT**, each with its own `LICENSE` file: the CLI, the MCP server, and every package they use (`packages/*` and `apps/worker`).
- **Not open-source licensed:** the web app in `apps/web` (the site, its design and its copy). It's published so you can read it.
