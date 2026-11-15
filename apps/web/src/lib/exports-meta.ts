// What the Export screen and the site pages (/exports, /agents) say about the files and the
// agent setup: one list, so the app and the marketing pages can't drift apart.

/** The five files, in exportAll's order, with what each is for (SPEC → Output formats). */
export const EXPORT_FILES = [
  ["DESIGN.md", "Tokens plus plain-language rules your agent reads", "text/markdown"],
  ["theme.css", "Tailwind v4 @theme block", "text/css"],
  ["shadcn.css", "shadcn/ui variables, light and dark", "text/css"],
  ["tokens.json", "W3C DTCG tokens for Style Dictionary and Figma", "application/json"],
  ["style-guide.html", "A page to share with your team", "text/html"],
] as const;
export type ExportFile = (typeof EXPORT_FILES)[number][0];

/**
 * Setup for agents and the terminal. The packages aren't published until launch, so these run
 * from a clone of the Thema repo; `npx` commands replace them then.
 */
export const SNIPPETS = [
  ["Claude Code", "claude mcp add thema -- pnpm -s --dir /path/to/thema mcp"],
  [
    "Cursor and other MCP clients",
    '{ "mcpServers": { "thema": { "command": "pnpm", "args": ["-s", "--dir", "/path/to/thema", "mcp"] } } }',
  ],
  ["CLI", "pnpm -s thema export --in thema.json --format all --out design"],
] as const;
