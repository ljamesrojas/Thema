# Thema — MVP Spec

Source of truth for building Thema. Exported from the "Thema — MVP Spec" doc on Nov 8, 2026. When a decision changes, update this file in the same commit.

## Overview

Thema turns a handful of reference sites into one original, accessible design system that AI coding agents can follow. The MVP ships in 6 weeks as a web app plus an MCP server.

**Pitch:** Drop in links, borrow what you like from each, get a DESIGN.md your agent actually follows.

**Problem.** AI coding agents (Claude Code, Cursor, v0) produce generic UI unless they're given design rules. Writing those rules by hand takes hours, and copying one site's look wholesale is both bland and risky for the brand.

**Target user.** Frontend and full-stack developers, often without a dedicated designer, who build with AI coding agents. Indie hackers and small product teams first. Designers come later.

**Positioning.** Single-URL to DESIGN.md extraction is already free and common (Google Stitch, getmd.art, design.md, Dembrandt). Thema doesn't compete on extraction alone. It wins on four things those tools skip:

- **Blend:** combine 2–5 references, choosing what to borrow from each (colors, type, spacing, shape, layout).
- **Fix:** auto-correct contrast to WCAG AA, generate dark mode, fill missing semantic colors.
- **Preview:** see the system applied to realistic pages before exporting.
- **Agent-native:** an MCP server, so an agent can create or update the system mid-task.

**Non-goals for the MVP.** Pixel-perfect site cloning, a Figma plugin, a full design canvas or editor, team collaboration, and native mobile tokens.

## MVP scope

The MVP covers URL input, blending, accessibility fixes, preview and five export formats. Image input waits for v2.

**In scope**

- Up to 5 public URLs per project, each tagged with what to borrow from it
- Playwright-based extraction of computed styles (desktop viewport, light theme; dark theme when the site has one)
- Blend engine with 4 global sliders: density, roundness, contrast, warmth
- Accessibility fixer: WCAG AA contrast on all text/background pairs, generated dark mode, semantic colors
- Preview on 3 template pages: landing, dashboard, settings form
- Exports: DESIGN.md, Tailwind v4 theme, shadcn theme, DTCG tokens.json, a style-guide HTML page
- Anonymous use: 1 project, saved only in the browser. Signing in unlocks saved projects
- MCP server with 3 tools: `extract`, `blend`, `get_design_md`
- Open-source CLI that wraps the same engine

**Out of scope (v2+)**

- Image or screenshot input
- UX pattern extraction (nav model, page templates, component states)
- Drift-check CLI and GitHub Action
- Figma variables export, teams, billing beyond a simple Pro flag

**Success criteria at launch + 4 weeks**

| Metric | Target |
| --- | --- |
| Extraction accuracy on the 20-site test set (primary color, fonts, base spacing correct) | ≥ 90% |
| Time from paste to first preview | < 30 s |
| Projects that reach an export | ≥ 40% |
| Weekly active users | 300 |
| GitHub stars on the CLI repo | 500 |

## User flow and screens

A new user goes from landing page to exported files in five steps, aiming for under 2 minutes.

1. **Paste.** On the landing page, paste one URL into the hero input. No sign-up.
2. **Extract.** Thema opens the Workspace with the first reference card loading. A progress line shows status (fetching, reading styles, naming roles), and a screenshot thumbnail appears when ready.
3. **Add and tag.** Add up to 4 more URLs. Each card has borrow chips (Colors, Type, Spacing, Shape, Layout); a chip can be claimed by only one reference at a time.
4. **Blend and tune.** The merged system updates live in the side panel. The user moves the sliders and can lock or swap any single token (for example, keep this exact primary blue).
5. **Preview and export.** Switch between Landing, Dashboard and Form previews in light or dark. Export a zip, copy DESIGN.md, or copy the MCP command.

**Screens**

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Landing | Explain and capture the first URL | Hero URL input, 3 example blends, how-it-works strip |
| Workspace | Build the system | Reference cards with borrow chips; token panel (palette, type scale, spacing, radius, shadow); sliders; accessibility report |
| Preview | Show the result | Template switcher, light/dark toggle, viewport toggle (desktop/mobile), side-by-side with sources |
| Export | Hand off | Format checklist, file preview with copy button, zip download, MCP and CLI snippet |
| Projects (signed in) | Return to past work | Grid of saved systems with their palette strips |

Approved mockups of Landing and Workspace: https://claude.ai/artifact/N6NCZ6EfxhNhTrkd7FDRJF

## Features in detail

Deterministic code decides every number. The LLM only names, describes and writes prose, so the same input always gives the same tokens.

### 1. Reference intake

- Accept a URL, normalize it, and reject non-public or localhost targets (SSRF guard).
- Borrow tags: `colors`, `typography`, `spacing`, `shape` (radius, border, shadow), `layout` (container width, grid, section rhythm). By default the first reference owns every tag.
- Cache extraction results by URL + day for 24 h so repeat pastes are instant and cheap.

### 2. Extraction engine

- Load the page in headless Chromium at 1440×900, wait for network idle, dismiss common cookie banners, scroll once to trigger lazy content.
- Sample computed styles from visible elements: color, background, border colors, font family/size/weight/line-height/letter-spacing, padding, margin, gap, border-radius, box-shadow, max-width.
- Weight each value by visible area and element importance (buttons, headings and links count more).
- Colors: convert to OKLCH, cluster with a perceptual distance (ΔE < 4), then assign roles by rules: largest background = `canvas`, highest-contrast text among the substantially used text colors = `ink` (so muted copy that outweighs the main text stays `ink-muted`), most-used saturated color on interactive elements = `primary`, ignoring browser-default link colors and counting opaque, button-sized calls-to-action in the first screen 12× (a hero button outweighs large cards further down); no `primary` when every opaque filled call-to-action in the first screen is neutral (a monochrome site).
- Type: detect families (including Google Fonts and @font-face sources), build the size scale from the distinct sizes, and estimate the ratio. A family is the first entry of its stack: a leading generic keyword is reported as the keyword (`system-ui` for the system-font aliases), never the font the machine resolves it to, and variable-font names ("X VF", "X Variable", "X-var") count as "X". Non-mono families under 2% of text weight are dropped; a mono family is kept at any share when it's on at least 3 elements or used inside code. `display` = the headings-only family with the largest heading text; `heading` = another headings-only family, reported only when it differs from `display` and `sans`.
- Spacing: find the base unit (4 or 8) from the GCD of common values, then snap to a scale.
- Capture a full-page screenshot for the reference card and preview comparison.
- Dark mode: re-run with `prefers-color-scheme: dark` and keep it if the canvas lightness flips.

**Split of responsibilities:** the worker (`apps/worker`) only drives the browser and returns raw `StyleSample[]` + a screenshot. All analysis of those samples happens in `packages/engine`, which is pure and testable with recorded samples.

### 3. Blend engine

- For each token group, take values from the reference that owns that tag.
- Harmonize across groups: if borrowed colors clash with the borrowed canvas, adjust lightness and chroma in OKLCH while keeping hue.
- Sliders map to transforms: density scales spacing (0.8–1.25×), roundness scales radius (0 to pill), contrast shifts ink/canvas lightness, warmth rotates neutral hue ±10°.
- Locks: a locked token is never changed by blending, sliders or the fixer.

### 4. Accessibility fixer and dark mode

- Check every text/background role pair against WCAG 2.2 AA (4.5:1 body text, 3:1 large text and UI components).
- When a pair fails, nudge lightness the minimum amount needed, and record the change in the report ("primary-on-canvas 3.1 → 4.6").
- Generate a dark theme when no source provides one: invert the lightness ramp, lower chroma on large surfaces, re-run the contrast check.
- Fill missing semantic colors (success, warning, danger, info) with hues tuned to the palette's lightness and chroma.

### 5. Preview

- Three built-in templates (Landing, Dashboard, Settings form) built with shadcn/ui components that read only CSS variables.
- Swapping tokens updates CSS variables live, so there's no rebuild.
- Compare view: the source screenshot next to the template with the blend applied.

### 6. Exports

- One internal token object feeds every generator (see Output formats).
- Download as a zip, or copy any single file. Each file carries a header comment with the Thema version and source URLs.

## Data model

Everything flows through one `ThemaSystem` object. Extraction produces one per reference, blending merges them into one, and generators only read it.

```ts
// Colors stored as OKLCH strings, e.g. "oklch(0.62 0.19 259)"
type ColorRole =
  | "canvas" | "surface" | "surface-raised" | "ink" | "ink-muted"
  | "hairline" | "primary" | "primary-ink" | "accent"
  | "success" | "warning" | "danger" | "info";

interface ThemaSystem {
  meta: { name: string; version: string; sources: SourceRef[]; createdAt: string };
  color: { light: Record<ColorRole, string>; dark: Record<ColorRole, string> };
  typography: {
    families: { sans: string; serif?: string; mono?: string; display?: string; heading?: string }; // heading: a second headings-only face
    scale: { name: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
             size: number; lineHeight: number; weight: number; tracking: number }[];
    ratio: number; // e.g. 1.25
  };
  spacing: { base: 4 | 8; scale: number[] };   // px
  radius: { sm: number; md: number; lg: number; full: 9999 };
  shadow: { sm: string; md: string; lg: string };
  layout: { containerMax: number; gutter: number; sectionY: number };
  motion: { durationFast: number; durationBase: number; easing: string };
  voice: { mood: string[]; summary: string };  // LLM-written, e.g. ["calm", "technical"]
  a11y: { fixes: ContrastFix[]; passes: boolean };
  locks: string[];                              // token paths, e.g. "color.light.primary"
}

interface SourceRef { url: string; borrowed: BorrowTag[]; screenshot: string }
type BorrowTag = "colors" | "typography" | "spacing" | "shape" | "layout";
interface ContrastFix { pair: [ColorRole, ColorRole]; before: number; after: number }

interface Project {
  id: string; ownerId?: string;           // anonymous projects have none
  references: Reference[];
  blend: BlendSettings;
  result: ThemaSystem;
  updatedAt: string;
}
interface Reference { id: string; url: string; status: "queued" | "running" | "done" | "failed";
                      borrowed: BorrowTag[]; extracted?: ThemaSystem; error?: string }
interface BlendSettings { density: number; roundness: number; contrast: number; warmth: number } // each -1..1
```

**Raw input from the worker** (defined in week 1, refine as needed):

```ts
interface StyleSample {
  tag: string;                       // "button", "h1", "a", "div", ...
  role?: "interactive" | "heading" | "body" | "container";
  area: number;                      // visible px²
  color: string; backgroundColor: string; borderColor?: string;   // computed CSS values
  fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing: number;
  padding: [number, number, number, number]; margin: [number, number, number, number]; gap?: number;
  borderRadius: number; boxShadow?: string; maxWidth?: number;
  opacity?: number;                  // effective opacity incl. ancestors, 0–1; omitted when 1
  fill?: string;                     // transparent buttons/links: color painted by ::before/::after, gradient or covering child
  y?: number;                        // top of the box from the top of the document, px
  inHeading?: boolean;               // is or is inside h1–h6 / role=heading; omitted otherwise
  inCode?: boolean;                  // is or is inside pre, code, kbd, samp; omitted otherwise
}
```

## Architecture and stack

One Next.js app serves the UI and API. A separate worker runs the browser, because it's the only slow and memory-heavy step.

```
 Web app (Next.js)      MCP server            CLI (open source)
        │                    │                       │
        └────────────────────┼───────────────────────┘
                             ▼
              API (Next.js route handlers)
   projects, references, blend, export — runs engine blend/fix
   and exporters in-process
        │                    │                       │
        ▼                    ▼                       ▼
   Job queue            LLM API              Postgres + file storage
 (Redis + BullMQ,   (names roles, writes     (projects, users, 24 h
  1 job per URL,     DESIGN.md prose —        cache, screenshots)
  3 at a time)       never token values)              ▲
        │                                             │
        ▼                                             │
  Playwright worker  ── saves extracted system + screenshot ──┘
  (headless Chromium 1440×900, samples styles,
   screenshot; engine parses into ThemaSystem)
```

Extraction is asynchronous: the client polls (or listens over SSE) while the job runs. Blending, fixing and exporting are synchronous and should take under 200 ms.

| Layer | Choice | Why |
| --- | --- | --- |
| Monorepo | pnpm + Turborepo | Shares engine and exporters across web, worker, MCP and CLI |
| Web + API | Next.js (App Router), TypeScript | One deploy for UI and routes; Vercel-friendly |
| UI kit | Tailwind v4 + shadcn/ui | Previews read the same CSS variables Thema exports |
| Color math | culori | OKLCH conversion, ΔE, contrast |
| Browser | Playwright (Chromium) on Fly.io or Railway | Needs a long-running container, not serverless |
| Queue | Redis (Upstash) + BullMQ | Retries, concurrency limits |
| Database + auth | Supabase (Postgres, Auth, Storage) | Projects, users, cache and screenshots in one service |
| LLM | Claude API (Haiku-class for naming, Sonnet-class for DESIGN.md prose) | Low cost per run; output is prose only |
| MCP | Official TypeScript MCP SDK | Standard server for Claude Code and Cursor |
| Tests | Vitest + fixture snapshots | Fast engine tests; accuracy tracked over time |

**API routes**

| Route | Does |
| --- | --- |
| `POST /api/projects` | Create a project (anonymous or owned) |
| `POST /api/projects/:id/references` | Add a URL with borrow tags; enqueues extraction |
| `GET /api/references/:id` | Poll status and extracted tokens |
| `PATCH /api/projects/:id/blend` | Update borrow tags, sliders, locks; returns the new `ThemaSystem` |
| `GET /api/projects/:id/export?format=` | One file: `design-md`, `tailwind`, `shadcn`, `dtcg`, `styleguide`, or `zip` |

## Output formats

Each export is a pure function of `ThemaSystem`. DESIGN.md follows Google's open spec so it works in Stitch and any agent that reads AGENTS.md or CLAUDE.md.

| File | Format | Consumer |
| --- | --- | --- |
| `DESIGN.md` | YAML token front matter + prose sections (Google DESIGN.md spec, `version: alpha`) | Claude Code, Cursor, Stitch, any agent |
| `theme.css` | Tailwind v4 `@theme` block with CSS variables | Tailwind v4 projects |
| `shadcn.css` | `:root` and `.dark` variables in shadcn's naming | shadcn/ui projects |
| `tokens.json` | W3C DTCG design tokens | Style Dictionary, Figma plugins, custom pipelines |
| `style-guide.html` | Self-contained page that renders every token and sample component | Humans, reviews, sharing |

**DESIGN.md format (Google spec, alpha).** Front matter keys: `version`, `name`, `description`, `colors` (hex strings), `typography` (named styles with `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`), `rounded`, `spacing`, `components` (properties: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`; token references like `{colors.primary}`; variants are separate entries such as `button-primary-hover`). Body sections, in this order when present: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. Extra sections are allowed after these (Thema adds Motion and Agent rules).

**Validation:** every generated DESIGN.md must pass `npx -y @google/design.md lint` with no errors. Add this as a test in `packages/exporters`.

The LLM writes the prose sections from the token object and never invents values.

## Visual design of Thema

Thema keeps a cream, ink and burnt-orange palette, with two contrast fixes. Its originality comes from a paint-chip motif, a neutral preview stage and its type, not from new hues. Full tokens and rules live in `DESIGN.md` at the repo root — that file is the source of truth for Thema's own UI.

- Paper #F3EEE3 canvas, Ink #111111 text, Kiln #D9541E for fills and large type only, Kiln Deep #B4431A for buttons and links.
- User palettes and previews always sit on the neutral Stage #F4F4F2, never on cream.
- Paint-chip motif for every token; logo = three stacked chips.
- Type: Geist (UI), Instrument Serif italic (one accent word per headline), Geist Mono (every hex and token).

## Build plan

Six weeks, four phases. Blending doesn't start until extraction scores ≥ 90% on the test set, because everything later depends on it.

| Weeks | Phase | Work | Gate |
| --- | --- | --- | --- |
| 1–2 | Extraction engine | Playwright worker; color, type, spacing analysis; 20-site test set | ≥ 90% accuracy on the 20-site test set |
| 3–4 | Blend and fix | Borrow tags, sliders, locks; WCAG fixer, dark mode; DESIGN.md and other exporters | — |
| 5 | Preview | 3 template pages; light/dark; compare view; anonymous projects | — |
| 6 | Agents and launch | MCP server, CLI; auth, saved projects; launch on GitHub and Product Hunt | Public launch; metrics check 4 weeks later |

If the gate slips, week 5 (Preview) shrinks to one template page and the rest of the plan holds.

### Repo layout

```
thema/
  apps/web/            Next.js app: landing, workspace, preview, export
  apps/worker/         Playwright extraction worker (queue consumer)
  packages/engine/     analyze samples → blend → fix (pure TS, unit-tested)
  packages/exporters/  DESIGN.md, Tailwind v4, shadcn, DTCG, style guide
  packages/mcp/        MCP server (extract, blend, get_design_md)
  packages/cli/        CLI wrapper around engine + worker
  fixtures/            recorded StyleSample sets + expected tokens (snapshot tests)
  docs/prompts.md      Claude Code session prompts, in order
  SPEC.md              this file
  CLAUDE.md            rules for Claude Code
  DESIGN.md            Thema's own design system
```

### Working with Claude Code

1. Start each feature in plan mode: "Read SPEC.md → <section>. Propose a plan and the tests first."
2. Approve the plan, let it write tests, then the implementation. Run `pnpm test` before every commit.
3. Add each newly failing real site to `fixtures/` so accuracy only goes up.
4. Update SPEC.md when a decision changes, so the next session starts from the truth.

## Risks, open questions and roadmap

The biggest risk is extraction accuracy. If the first paste looks wrong, users leave, so weeks 1–2 go entirely to that.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sites block headless browsers (Cloudflare, bot checks) | Extraction fails | Retry; clear error message; v2 browser extension that extracts from the user's own tab |
| Wrong role naming (picks an ad color as primary) | Bad first impression | Weight by interactive elements; let users swap any role in one click; test set of 20 sites in CI |
| Seen as a brand-cloning tool | Reputation and legal complaints | Market blending and "inspired by"; no logos or images exported; show source attribution in files |
| Playwright costs at scale | Hosting bills | 24 h URL cache; queue with concurrency limit; rate-limit anonymous users to 3 extractions/day |
| DESIGN.md spec changes (it's alpha) | Exports break | Pin the spec version; one generator module; lint test |
| Free competitors (Stitch, getmd.art) | Low conversion | Compete on blend + fix + preview + MCP, not on extraction |

**Open questions**

- [ ] Hosting for the Playwright worker: Fly.io, Railway, or a serverless browser service (Browserless)?
- [ ] Which LLM and what monthly budget for the prose and naming steps?
- [ ] Pro price: test $8 vs $12/month
- [ ] License for the CLI: MIT or AGPL?

**Roadmap after MVP**

- **v2:** image/screenshot input with pixel clustering for exact colors; UX pattern extraction (nav, templates, component states); browser extension
- **v3:** drift-check CLI and GitHub Action; Figma variables export; saved team libraries
- **Later:** community gallery of blends; versioned systems with diff; brand kit import (logo-to-palette)

## Sources

- Google: Stitch's DESIGN.md format is now open-source (Apr 21, 2026) — https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/
- DESIGN.md spec repo — https://github.com/google-labs-code/design.md
- Competitors: getmd.art (https://github.com/temaprint/getmd.art), design.md (https://github.com/sunil-dsb/design.md), Dembrandt (https://github.com/dembrandt/dembrandt)
