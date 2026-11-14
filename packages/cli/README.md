# @thema/cli

Blend reference sites into one original, accessible design system, from the command line. It's the same engine, fixer and exporters as the Thema web app, and it reads and writes Thema systems as JSON. MIT licensed.

```sh
thema extract https://example.com --out north.json          # a site → its system
thema blend north.json=colors,shape notes.json=typography \
  --density 0.2 --out blend.json                            # up to 5 systems → one, fixed to WCAG AA
thema export --in blend.json --format all --out design      # DESIGN.md, theme.css, shadcn.css, tokens.json, style-guide.html
```

Until the package is published, run it from a clone with `pnpm -s thema …` (the repo root's script).

## Commands

| Command                  | Does                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract <url>`          | Loads the page in a browser and writes its system (`--out file`, or stdout). `--screenshot file` saves a full-page PNG. A summary and the extraction's warnings go to stderr.                                                                                                                                                                                                                                                         |
| `blend <file[=tags]>...` | Blends up to five systems, then fixes contrast. Tags say what each file lends: `colors`, `typography`, `spacing`, `shape`, `layout`, comma-separated. Tags nobody claims come from the first file. Sliders `--density`, `--roundness`, `--contrast`, `--warmth` go from -1 to 1. `--lock color.light.primary` keeps that token's value from `--previous system.json`. Fixes, a generated theme and any unresolved pairs are reported. |
| `export --in file`       | Writes `--format design-md`, `tailwind`, `shadcn`, `dtcg`, `styleguide` or `all` (default) into `--out dir`.                                                                                                                                                                                                                                                                                                                          |

Exit codes: `0` done, `1` failed (bad file, failed extraction), `2` bad usage or a blocked URL.

## Where extraction runs

- **Locally (default):** the worker's headless Chromium. Install it once: `pnpm --filter @thema/worker exec playwright install chromium`. The same SSRF guard as the hosted worker refuses local and private addresses, and checks every redirect.
- **Through a Thema API:** set `THEMA_API_URL` (or pass `--api <url>`) and extraction goes through that server's API instead, with its cache and limits.

Blending and exporting never touch the network.

## As a library

`@thema/cli/core` exports what the commands use (`localExtractor`, `apiExtractor`, `blendAndFix`, `exportFiles`, `summarize`, `readSystemFile`); the MCP server (`@thema/mcp`) is built on it.
