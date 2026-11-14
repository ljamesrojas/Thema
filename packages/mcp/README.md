# @thema/mcp

Thema as an MCP server, so an AI coding agent (Claude Code, Cursor, and others) can build or update a design system mid-task. Same engine, fixer and exporters as the Thema web app and CLI. MIT licensed.

## Tools

| Tool            | Takes                                                                                                                                                                                                                                                                              | Returns                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract`       | `url`, optional `out_path`                                                                                                                                                                                                                                                         | A `system_id`, a short summary (palette hex, fonts, spacing base, radius, WCAG AA pass counts) and warnings in words. Local and private addresses are refused. |
| `blend`         | 1–5 `references` (`system_id` or `system_path`, plus the parts they lend: `colors`, `typography`, `spacing`, `shape`, `layout`), sliders `density`, `roundness`, `contrast`, `warmth` (-1 to 1), `locks` with `previous_system_id` or `previous_path`, optional `name`, `out_path` | A new `system_id` and summary, the number of contrast fixes, the generated theme, pairs that couldn't be fixed (and why) and locks that named no token.        |
| `get_design_md` | `system_id` or `system_path`, optional `out_path`                                                                                                                                                                                                                                  | The DESIGN.md text; with `out_path`, also written there.                                                                                                       |

Systems live in the server's memory by id for the session, so an agent passes a short id instead of the whole system. `*_path` arguments read and write ThemaSystem JSON, such as `thema.json` from the web app's Export screen, so work can outlive a session.

## Setup

Until the package is published, run it from a clone of the Thema repo (after `pnpm install`):

```sh
# Claude Code
claude mcp add thema -- pnpm -s --dir /path/to/thema mcp

# Cursor (.cursor/mcp.json) and other clients
{ "mcpServers": { "thema": { "command": "pnpm", "args": ["-s", "--dir", "/path/to/thema", "mcp"] } } }
```

`extract` loads pages in a local headless Chromium (install it once: `pnpm --filter @thema/worker exec playwright install chromium`), behind the same SSRF guard as the hosted worker. Set `THEMA_API_URL` to extract through a Thema API instead. Relative paths resolve against the directory the server was started from.
