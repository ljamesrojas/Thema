# Recording real sites for the accuracy gate

The week-2 gate: across about 20 real sites, at least 90% of checks pass. Each site has 3 checks: primary color, font families and spacing base. Blending doesn't start until it passes (SPEC → Build plan).

## 1. Pick the sites

Aim for about 20, varied on purpose:

- **Theme:** at least 4 dark-first sites, and at least 3 that have a real dark mode.
- **Type:** SaaS landing pages, editorial and news, e-commerce, docs, a portfolio or agency site, and a government or institutional site.
- **Primary color:** at least 2 with a non-blue primary, and 1 that's nearly monochrome.
- **Cookie banners:** at least 4 with one (EU sites are a reliable source).
- **Avoid:** pages behind a login, and pages whose look changes on every load (A/B tests, rotating heroes).

## 2. Record

```sh
pnpm extract https://site.example --out fixtures/<name>/
```

- **Folder name:** lowercase-with-dashes, e.g. `fixtures/stripe-home`.
- **Check the screenshot:** open `fixtures/<name>/screenshot.png` and make sure the page actually rendered. A cookie wall, bot check or blank page means you should drop the site or try again.
- **Committed vs local:** commit `samples.json` (and `samples.dark.json` if written). The screenshot is gitignored and must stay local, because it's a third-party image.

## 3. Fill in `expected.json` from the live site

Open the site in a normal browser at roughly desktop width, with devtools open. **Decide every value from the live page, never from `pnpm palette`.** Otherwise the report only measures the engine against itself.

Copy this template:

```json
{
  "source": "recorded",
  "url": "https://site.example/",
  "recordedAt": "2026-11-08",
  "roles": { "primary": "#635bff" },
  "typography": { "families": { "sans": "Inter" } },
  "spacing": { "base": 8 }
}
```

### Primary color

1. Find the **main call to action**, usually the most prominent button in the hero or the header's "Sign up" / "Get started". Inspect it.
2. Use its computed `background-color` (or its text color, for outlined or text-only CTAs). Paste it as hex, like `"#635bff"`. `rgb()` works too.
3. Check that it's also the color of the other buttons and links. If several buttons disagree, choose the color most buttons and links use, not the biggest single button.
4. **Never** use the color of a cookie-banner button, an ad, a "Sale" or "New" badge, or a gradient's end color.
5. If the site's CTAs are all black, white or gray, it's a **monochrome** site: add `"monochrome": true` at the top level of `expected.json`. Still write the CTA's actual color under `roles.primary` (e.g. `"#141414"`) for reference, since it isn't scored.

The check passes when the engine's primary is within ΔE 5 of yours.

**Monochrome sites** are scored differently: primary passes when the engine finds no primary, or one with OKLCH chroma below 0.03 (a neutral). It fails when the engine returns any saturated color. A monochrome page usually still has some color somewhere, like a blue button inside an embedded demo email, a colored illustration, or a badge, and none of those is the site's primary. The report shows the engine's color and its chroma, e.g. `✗ C 0.180 (saturated)`.

`"primary": null` (no monochrome flag) still works and is stricter: it passes only when the engine finds no primary at all. Prefer `"monochrome": true` for new sites.

### Font families

1. Inspect the **body text** (a paragraph). In Computed → `font-family`, take the **first name** in the list without quotes, e.g. `Inter` from `"Inter", system-ui, sans-serif`. That's `sans`, or `serif` if it's a serif face.
2. Inspect a **heading**. If it uses a different family:
   - and the family is used only on headings, add it as `display`;
   - otherwise add it under `sans` or `serif`, whichever applies.
3. Inspect any **code** (in docs and dev tools). If it uses a monospace family, add it as `mono`.
4. If the first name is a generic one like `system-ui` or `-apple-system`, write exactly that (e.g. `"system-ui"`).
5. Ignore icon fonts (Font Awesome, Material Symbols).

The check passes when the categories and names match exactly. Case and quotes don't matter. List every category the page visibly uses, and nothing it doesn't.

### Spacing base

1. Inspect 5–8 typical elements: buttons, cards, nav items, section padding and list gaps. In Computed, note `padding`, `margin` and `gap`.
2. If at least 3 out of 4 of those values are multiples of 8 (8, 16, 24, 32 …), write `8`. Otherwise (12, 20, 14 … are common), write `4`.
3. Ignore one-off values and huge layout values (over 256px).

The check passes when the base matches exactly.

## 4. Run the report

```sh
pnpm accuracy              # table + overall %, fails below 90% or if anything isn't filled in
pnpm accuracy --save       # record what passes now in fixtures/accuracy-baseline.json
```

Once the baseline is saved, `pnpm test` fails if any of those checks stops passing. The baseline can only go up: `--save` refuses if it would lose a passing check. Commit the baseline along with the fixtures.

When a site fails, don't edit `expected.json` to make it pass unless you got the value wrong. A real miss is the engine's to fix, and it's exactly what the test set is for.

## 5. Before committing

- `screenshot.png` is not staged (it's gitignored, but check).
- Every new site has `"source": "recorded"` and all three checks filled in.
- `pnpm test` and `pnpm accuracy` have been run.
