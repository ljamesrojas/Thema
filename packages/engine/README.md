# @thema/engine

The pure analysis core of Thema. It turns raw `StyleSample[]` from the worker into design tokens. Later it will also blend and fix them.

**Pure** means no network, file system, browser, clock or randomness: data in, data out. The same samples always give the same tokens, which is why the engine is testable with recorded fixtures.

## `analyzeColors(samples)`

```ts
import { analyzeColors } from "@thema/engine";

const { roles, confidence } = analyzeColors(samples);
// roles.primary      → "oklch(0.546 0.215 262.9)"
// confidence.primary → a number from 0 to 1
```

It returns `roles: Partial<Record<ColorRole, string>>` (OKLCH strings) and a `confidence` of 0–1 for each returned role. Confidence is `1 − runnerUp / winner`: 1 means there was no rival candidate, 0 means a tie. When the samples give no candidate for a role, the role is left out rather than invented.

### How it works

1. **Read colors.** Each sample gives up to three colors: background, text and border.
   - Text color on `container` samples is skipped, because it's only inherited.
   - Fully transparent and unparseable colors are dropped.
2. **Weight.** Weight is visible area × an importance weight: interactive elements ×3, headings ×2. All weights and thresholds live in [`src/constants.ts`](src/constants.ts).
3. **Flatten translucent colors.** The canvas is found first from opaque backgrounds. Translucent colors are then composited onto it, so a border of `rgba(0,0,0,.08)` becomes a light gray.
4. **Cluster.** Colors merge greedily when ΔE OK < 4 (OKLab distance × 100). Clustering is deterministic and doesn't depend on input order.
5. **Assign roles.** A color with chroma below 0.06 counts as neutral; anything at or above it counts as saturated.

| Role        | Rule                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| `canvas`    | Background with the most raw area                                      |
| `surface`   | Next neutral background within ΔE 15 of the canvas                     |
| `ink`       | Heaviest neutral text color (never the canvas or surface color)        |
| `ink-muted` | Next neutral text color whose lightness sits between ink and canvas    |
| `hairline`  | Heaviest neutral border color                                          |
| `primary`   | Saturated color with the most weight on interactive elements           |
| `accent`    | Next saturated color whose hue is at least 20° away from the primary's |

For `primary` and `accent`, a color seen on fewer than 3 distinct samples has its score scaled down. That keeps a one-off cookie button or ad from winning.

Each role reports the heaviest exact color among the members that count for that role. If a navy footer and the body text land in the same cluster, `ink` still reports the text color.

### Notes for the worker

- Send `borderColor` only when the border width is greater than 0. Computed `border-color` defaults to `currentColor` even when there is no border.
- Set `role` when you can. Without it, the role comes from the tag: `button`, `a`, `input`, `select`, `textarea` and `summary` are interactive, `h1`–`h6` are headings, and everything else is body.

## `analyzeTypography(samples)`

Returns `ThemaSystem["typography"]`: families, a size scale and its ratio. Only text samples count; containers only inherit their font.

- **Families.** Each `font-family` stack is reduced to its first real family. Quotes are stripped and icon fonts skipped.
  - The category comes from the stack's generic fallback (`monospace`, `serif`, `sans-serif`, …), or from the family name when there is none.
  - A family used ≥ 80% on headings becomes `display`, as long as another family carries the body text.
  - Each category keeps its heaviest family. `sans` falls back to `system-ui`.
  - Values are family names only (`"Inter"`); exporters add the fallback stacks.
- **Scale.** Sizes are weighted by area × importance, and sizes under 1% of text weight are dropped.
  - `base` is the heaviest body-text size. The 2 heaviest smaller sizes become `xs`, `sm` and the 5 heaviest larger ones become `lg` … `4xl`.
  - Per step: `size` in px, `lineHeight` unitless, `tracking` in em, and `weight` as the most common value. These attributes use raw area, so ×3-weighted buttons don't decide what body text looks like.
- **Ratio.** The median of `(size / base)^(1/k)` over all steps, where k is the step's distance from base.

## `analyzeSpacing(samples)`

Returns `{ base: 4 | 8, scale: number[] }` in px. It reads padding, margin and gap, counting each distinct value once per sample and ignoring zeros, negatives and values over 256px.

- The base is 8 when at least 75% of the values seen on 2 or more samples are multiples of 8; otherwise it is 4.
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
