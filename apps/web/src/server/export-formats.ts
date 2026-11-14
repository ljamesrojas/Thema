// The export route's formats (route files may only export handlers, so they live here).

/** Each single-file format: its file in exportAll and its media type. */
export const FORMATS = {
  "design-md": { file: "DESIGN.md", type: "text/markdown; charset=utf-8" },
  tailwind: { file: "theme.css", type: "text/css; charset=utf-8" },
  shadcn: { file: "shadcn.css", type: "text/css; charset=utf-8" },
  dtcg: { file: "tokens.json", type: "application/json; charset=utf-8" },
  styleguide: { file: "style-guide.html", type: "text/html; charset=utf-8" },
} as const;

export type Format = keyof typeof FORMATS | "zip";

export const isFormat = (value: string | null): value is Format =>
  value === "zip" || (value !== null && Object.hasOwn(FORMATS, value));

/** Downloads are served from our origin, so an HTML file must never run as our page. */
export const DOWNLOAD_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "sandbox",
};
