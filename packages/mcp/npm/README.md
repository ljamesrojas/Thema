# thema-mcp

Thema as an MCP server, so an AI coding agent (Claude Code, Cursor and others) can build or update a design system mid-task: extract sites, blend them, and write `DESIGN.md`. Same engine, accessibility fixer and exporters as the Thema web app and `thema-cli`. MIT licensed. Node 22 or newer.

## Set up

```sh
npx thema-cli setup     # once: installs the Chromium that extract uses
```

**Claude Code**

```sh
claude mcp add thema -- npx -y thema-mcp
```

**Cursor** (`.cursor/mcp.json`) **and other MCP clients**

```json
{ "mcpServers": { "thema": { "command": "npx", "args": ["-y", "thema-mcp"] } } }
```

## Tools

| Tool            | Takes                                                                                                                                                                                                                                                                              | Returns                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract`       | `url`, optional `out_path`                                                                                                                                                                                                                                                         | A `system_id`, a short summary (palette hex, fonts, spacing base, radius, WCAG AA pass counts) and warnings in words. Local and private addresses are refused. |
| `blend`         | 1–5 `references` (`system_id` or `system_path`, plus the parts they lend: `colors`, `typography`, `spacing`, `shape`, `layout`), sliders `density`, `roundness`, `contrast`, `warmth` (-1 to 1), `locks` with `previous_system_id` or `previous_path`, optional `name`, `out_path` | A new `system_id` and summary, the number of contrast fixes, the generated theme, pairs that couldn't be fixed (and why) and locks that named no token.        |
| `get_design_md` | `system_id` or `system_path`, optional `out_path`                                                                                                                                                                                                                                  | The DESIGN.md text; with `out_path`, also written there.                                                                                                       |

Systems live in the server's memory by id for the session; `*_path` arguments read and write ThemaSystem JSON (such as `thema.json` from the web app's Export screen), relative to the folder the server started in. Set `THEMA_API_URL` to extract through a Thema server instead of a local browser.

Source and issues: https://github.com/ljamesrojas/Thema
