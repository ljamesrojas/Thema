# @thema/exporters

Turns one `ThemaSystem` into the five files Thema ships. Every exporter is a pure function `ThemaSystem → string`; this is the only package that converts OKLCH to hex.

```ts
import { extractSystem, fix } from "@thema/engine";
import { exportAll } from "@thema/exporters";

const files = exportAll(fix(extractSystem(input).system).system);
// { "DESIGN.md", "theme.css", "shadcn.css", "tokens.json", "style-guide.html" }
```

From the command line, on a recorded fixture: `pnpm export stripe --out <dir>` (a relative `--out` resolves against the repo root; keep outputs out of the repo).

| File               | Function        | Format                                                                                                                                                                                                                                    |
| ------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN.md`        | `toDesignMd`    | Google's DESIGN.md (version alpha): YAML token front matter (hex colors, typography styles `xs`…`4xl` and `code`, `rounded`, `spacing` keyed by px value, components) and prose sections in the spec's order, then Motion and Agent rules |
| `theme.css`        | `toTailwindCss` | Tailwind v4 `@theme`: `--color-*` (OKLCH), `--font-*` with fallback stacks, `--text-*` with line height, tracking and weight, `--radius-*`, `--shadow-*`, `--spacing` (the base unit), layout and motion; dark colors in `.dark`          |
| `shadcn.css`       | `toShadcnCss`   | `:root` and `.dark` in shadcn/ui's variable names (`SHADCN_VARIABLES`)                                                                                                                                                                    |
| `tokens.json`      | `toDtcg`        | W3C DTCG: colors as OKLCH components with a hex fallback, dimensions in px, shadows, durations, a cubic-Bézier easing                                                                                                                     |
| `style-guide.html` | `toStyleGuide`  | One self-contained page (no external requests) with every token, sample components and a light/dark toggle                                                                                                                                |

**Details**

- **Provenance:** every file names the Thema version and the source URLs: a YAML comment in DESIGN.md (its linter parses MDX, which rejects HTML comments), a CSS comment, `$extensions["dev.thema"]` in tokens.json, an HTML comment in the style guide.
- **Dark mode in DESIGN.md** (the format has none): `dark-<role>` color tokens and a `-dark` variant of every component, so no token is orphaned.
- **Components in DESIGN.md** pair each text color only with backgrounds the fixer checked (page, section, card, caption, button-primary, input, alerts), so the linter's contrast rule passes; divider and highlight use hairline and accent without text.
- **shadcn mapping:** shadcn's `accent` is a subtle hover background, so it maps to Thema's `surface`; Thema's saturated accent goes to `chart-2`. Every foreground/background pair is one the fixer checked.
- **Fonts:** family names get fallback stacks here (sans, serif or mono; display and heading faces by name). Generic keywords such as `system-ui` stay unquoted.
- **Hex:** 8 bits per channel, the nearest value to the OKLCH color (translucent colors get `#rrggbbaa`). Near black one hex step is a large OKLCH lightness jump, so `oklch(0.05 0 0)` exports as `#000000`.

**Tests:** every fixture's DESIGN.md passes Google's linter (`@google/design.md` 0.4.0, pinned) with no errors or warnings, plus snapshots of each format, shadcn variable completeness, DTCG `$type`/`$value` and alias checks, hex rounding, and a self-contained style guide.
