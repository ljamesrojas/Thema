# @thema/engine

The pure analysis core of Thema. It turns raw `StyleSample[]` from the worker into design tokens: one complete `ThemaSystem` per reference (`extractSystem`). Later it will also blend and fix them.

**Pure** means no network, file system, browser, clock or randomness: data in, data out. The same samples always give the same tokens, which is why the engine is testable with recorded fixtures.

## `extractSystem(input)`

```ts
import { extractSystem } from "@thema/engine";

const { system, warnings, derived } = extractSystem({
  samples,
  darkSamples,
  source,
  name: "stripe.com",
  createdAt: new Date().toISOString(),
});
```

Builds one complete `ThemaSystem` for one reference from the analyzers below. `createdAt` is passed in because the engine has no clock.

- **Colors:** `completePalette` (below), for light and, when the site has a real dark theme (`canvasFlipsInDark`), dark. Without one, `color.dark` is a copy of `color.light` until the fixer generates a dark theme.
- **Layout:** `analyzeLayout` (below). **Motion** isn't extracted: documented defaults (`MOTION_DEFAULTS`: 150 ms, 250 ms, `cubic-bezier(0.2, 0, 0, 1)`). The recorder runs with reduced motion, under which many sites switch transitions off.
- `voice` is empty (no LLM in the engine), `locks` is `[]`, and `a11y` is `{ fixes: [], passes: false }` until the fixer runs.
- **`warnings`:** `no-headings` (no h1–h6 at all: possibly a page variant), `few-samples` (< 20: a blocked or empty page), `no-dark-theme`, `monochrome` (no saturated primary).
- **`derived`:** every token path filled by a fallback or default instead of measured, e.g. `layout.gutter`, `color.light.accent`, `motion.easing`.

## `completePalette(samples)`

Every `ColorRole` for one theme. Roles that `analyzeColors` finds are kept unchanged. Two more are measured here, and the rest fall back to documented rules (listed in `derived`):

| Role                                | Measured                                                                                            | Fallback                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `surface-raised`                    | heaviest neutral background near the canvas (ΔE 4–15) other than canvas and surface, on ≥ 2 samples | one lightness step above the lighter of canvas and surface                                                   |
| `primary-ink`                       | heaviest text color on interactive samples painted in the primary                                   | canvas or ink, whichever has more contrast on primary                                                        |
| `primary` (monochrome sites)        | the heaviest neutral first-screen CTA fill (Vercel's black button)                                  | ink                                                                                                          |
| `surface`                           | (from `analyzeColors`)                                                                              | canvas one step darker (light) or lighter (dark)                                                             |
| `accent` / `ink-muted` / `hairline` | (from `analyzeColors`)                                                                              | primary / ink mixed 45% toward canvas / 85% toward canvas                                                    |
| `success` `warning` `danger` `info` | —                                                                                                   | fixed hues 145 / 75 / 25 / 250 at the primary's lightness (0.5–0.7) and chroma (0.1–0.18), clamped into sRGB |

## `analyzeLayout(samples)`

Container width, gutter and section spacing from element boxes (`x`, `width`, recorded at 1440px). Each distinct element style counts once.

- `containerMax`: the most common horizontally centered box shown at its own `max-width` (seen on ≥ 2 styles), else the most common centered box ≥ 600px wide that leaves 16px each side, else the most common `max-width`.
- `gutter`: equal side padding (≥ 8px) on those containers, else on any centered box, else on full-width boxes; ties go to the smaller value.
- `sectionY`: the most common top padding ≥ 32px on boxes at least 60% of the page wide.
- Missing evidence falls back to 1280 / 24 / 64 and is listed in `derived`.

## `analyzeColors(samples)`

```ts
import { analyzeColors } from "@thema/engine";

const { roles, confidence } = analyzeColors(samples);
// roles.primary      → "oklch(0.546 0.215 262.9)"
// confidence.primary → a number from 0 to 1
```

It returns `roles: Partial<Record<ColorRole, string>>` (OKLCH strings) and a `confidence` of 0–1 for each returned role. Confidence is `1 − runnerUp / winner` on the score that picked the role: 1 means there was no rival candidate, 0 means a tie. (For `ink` that score is contrast, not weight.) When the samples give no candidate for a role, the role is left out rather than invented.

### How it works

1. **Read colors.** Each sample gives up to three colors: background, text and border.
   - Text color on `container` samples is skipped, because it's only inherited.
   - Fully transparent and unparseable colors are dropped.
2. **Weight.** Weight is visible area × an importance weight: interactive elements ×3, headings ×2. All weights and thresholds live in [`src/constants.ts`](src/constants.ts).
3. **Flatten translucent colors.** A sample's `opacity` is folded into each of its colors' alpha first (computed colors ignore CSS opacity). The canvas is then found from opaque backgrounds, and translucent colors are composited onto it: a border of `rgba(0,0,0,.08)` becomes a light gray, and black text at `opacity: .6` becomes `#666`.
   - **Limitation:** colors are composited onto the canvas, not onto their real parent, so faded text on a dark footer is slightly off. Box shadows aren't faded.
4. **Cluster.** Colors merge greedily when ΔE OK < 4 (OKLab distance × 100). Clustering is deterministic and doesn't depend on input order.
5. **Assign roles.** A color with chroma below 0.06 counts as neutral; anything at or above it counts as saturated.

| Role        | Rule                                                                                                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvas`    | Background with the most raw area                                                                                                                                                                                                                                                               |
| `surface`   | Next neutral background within ΔE 15 of the canvas                                                                                                                                                                                                                                              |
| `ink`       | Among neutral text colors with ≥ 20% of the top one's weight, the one with the most contrast against the canvas (never the canvas or surface color). Colors on 2+ elements are preferred; card-sized interactive elements (> 480×80) don't count; neutrality is judged by the text color itself |
| `ink-muted` | Next neutral text color whose lightness sits between ink and canvas                                                                                                                                                                                                                             |
| `hairline`  | Heaviest neutral border color                                                                                                                                                                                                                                                                   |
| `primary`   | Saturated color with the most weight on interactive elements                                                                                                                                                                                                                                    |
| `accent`    | Next saturated color whose hue is at least 20° away from the primary's                                                                                                                                                                                                                          |

For `primary` and `accent`, a color seen on fewer than 3 distinct samples has its score scaled down. That keeps a one-off cookie button or ad from winning.

For `primary`, two kinds of interactive samples don't count: those set in a font the page doesn't otherwise use (an embedded demo, like Resend's Helvetica email preview), and small near-square controls of 48×48 or less (color swatches, radio dots, icon buttons: Glossier's product swatches). Opaque first-screen calls-to-action count 12×.

Each role reports the heaviest exact color among the members that count for that role. If a navy footer and the body text land in the same cluster, `ink` still reports the text color.

### Notes for the worker

- Send `borderColor` only when the border width is greater than 0. Computed `border-color` defaults to `currentColor` even when there is no border.
- Set `role` when you can. Without it, the role comes from the tag: `button`, `a`, `input`, `select`, `textarea` and `summary` are interactive, `h1`–`h6` are headings, and everything else is body.

## `analyzeTypography(samples)`

Returns `ThemaSystem["typography"]`: families, a size scale and its ratio. Only text samples count; containers only inherit their font.

- **Families.** Each `font-family` stack is reduced to its first entry. Quotes are stripped and icon fonts skipped.
  - A leading generic keyword is reported as the keyword, never as a font listed after it, so results don't depend on the recording machine's OS: `-apple-system` and `BlinkMacSystemFont` become `system-ui`, `-apple-system-ui-serif` becomes `ui-serif`, and `ui-monospace`/`ui-serif`/`ui-sans-serif` stay as they are.
  - Variable-font names merge with their family: "Mona Sans VF", "Inter Variable" and "sohne-var" count (and are reported) as "Mona Sans", "Inter", "sohne".
  - The category comes from the stack's generic fallback (`monospace`, `serif`, `sans-serif`, …), or from the family name when there is none.
  - Non-mono families under 2% of text weight are dropped (a stray serif on one widget). Mono families skip that share, since real ones are tiny (Glossier's labels are 0.05%), but need at least 3 elements or any use inside code (`inCode`), so one stray monospace element can't add a mono font.
  - Heading-like text: a heading, text inside one (`inHeading`, e.g. a styled span in an h1), or text of 20px or more that's larger than the base body size (so 21px editorial body copy stays body).
  - Non-mono families that are ≥ 80% heading-like, while another family carries the body text, are headings-only: the one with the largest heading text becomes `display`, the heaviest other one becomes `heading`. They leave their category.
  - Each category keeps its heaviest family. `sans` falls back to `system-ui`.
  - Values are family names only (`"Inter"`); exporters add the fallback stacks.
- **Scale.** Sizes are weighted by area × importance, and sizes under 1% of text weight are dropped.
  - `base` is the heaviest body-text size. The 2 heaviest smaller sizes become `xs`, `sm` and the 5 heaviest larger ones become `lg` … `4xl`.
  - Per step: `size` in px, `lineHeight` unitless, `tracking` in em, and `weight` as the most common value. These attributes use raw area, so ×3-weighted buttons don't decide what body text looks like.
- **Ratio.** The median of `(size / base)^(1/k)` over all steps, where k is the step's distance from base.

## `analyzeSpacing(samples)`

Returns `{ base: 4 | 8, scale: number[] }` in px. It reads padding, margin and gap, counting each distinct value once per sample and ignoring zeros, negatives and values over 256px.

- The base is 8 when at least 75% of the values seen on 2 or more samples are multiples of 8; otherwise it is 4.
  - For the base, each distinct element style (tag, `className`, padding, margin and gap) counts once, so 100 identical decorative dots cast one vote. Without a class (synthetic fixtures, older recordings) the key is tag plus values. The scale still counts every sample.
  - Values off the 4-grid (2, 6, 10, 14…) count against 8: on our sites they mark a non-8 system.
- Values are snapped to the base, and anything left on fewer than 2 samples is dropped as an outlier.

## `analyzeRadius(samples)` and `analyzeShadow(samples)`

Both use the same sm / md / lg rule, which never invents a value:

- `md` is the most common value.
- `sm` and `lg` are the most common values below and above it, with ties going to the value closer to md.
- A missing step falls back to md.

**Radius** skips 0 (not a box) and pills (≥ 500px, which `full: 9999` already covers). With no radii, all three steps are 0.

**Shadow:**

- Computed `box-shadow` layers are parsed with the color first or last.
- Colors are converted to OKLCH with alpha, e.g. `0px 1px 2px 0px oklch(0 0 0 / 0.3)`.
- Shadows ranked by `blur + |y|`; inset-only shadows are skipped. With none, all steps are `"none"`.

## Tests

Run `pnpm --filter @thema/engine test`. There are unit tests for color math, clustering, each color role rule, typography, spacing and shape. There is also one snapshot test per folder in `/fixtures`, which compares the output with `expected.json`. Colors must be within ΔE 2 and the type ratio within 0.01; everything else must match exactly.
