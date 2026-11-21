# thema-cli

Blend the websites you like into one original, accessible design system, from the command line. Thema reads each site's colors, type, spacing, radius and layout in a real browser, blends the parts you pick, fixes every text pair to WCAG AA in light and dark, and writes files your AI coding agent and your code can use: `DESIGN.md`, a Tailwind v4 theme, shadcn/ui variables, W3C DTCG tokens and a style guide.

Same engine as the Thema web app. MIT licensed. Node 22 or newer.

## Start

```sh
npx thema-cli setup                                                # once: installs the Chromium Thema uses
npx thema-cli extract https://example.com --out north.json         # a site → its system
npx thema-cli blend north.json=colors,shape notes.json=typography \
  --density 0.2 --out blend.json                                   # up to 5 systems → one, fixed to WCAG AA
npx thema-cli export --in blend.json --format all --out design     # DESIGN.md, theme.css, shadcn.css, tokens.json, style-guide.html
```

Installed globally (`npm install -g thema-cli`), the command is just `thema`.

## Commands

| Command                  | Does                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract <url>`          | Loads the page in a local headless Chromium and writes its system as JSON (`--out file`, or stdout). `--screenshot file` saves a full-page PNG. Local and private addresses are refused, redirects included.                                                                                         |
| `blend <file[=tags]>...` | Blends up to five systems, then fixes contrast. Tags say what each file lends: `colors`, `typography`, `spacing`, `shape`, `layout`. Sliders `--density`, `--roundness`, `--contrast`, `--warmth` go from -1 to 1. `--lock color.light.primary` keeps a token's value from `--previous system.json`. |
| `export --in file`       | Writes `--format design-md`, `tailwind`, `shadcn`, `dtcg`, `styleguide` or `all` (default) into `--out dir`.                                                                                                                                                                                         |
| `setup`                  | Installs the Chromium that `extract` uses, matching Thema's Playwright version.                                                                                                                                                                                                                      |

Exit codes: `0` done, `1` failed, `2` bad usage or a blocked URL.

`thema.json` from the web app's Export screen works as `--in` and in `blend`. Set `THEMA_API_URL` (or `--api <url>`) to extract through a Thema server instead of a local browser. Blending and exporting never touch the network.

Thema records measurements, never a site's code, images, logos or fonts. Font names in your exports may need a license: check before you ship. Inspired by, never cloned.

Source and issues: https://github.com/ljamesrojas/Thema
