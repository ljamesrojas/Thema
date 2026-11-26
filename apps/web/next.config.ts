import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: [
    "@thema/engine",
    "@thema/exporters",
    "@thema/jobs",
    "@thema/schema",
    "@thema/url-guard",
    "@thema/worker",
  ],
  // Loaded by the API at runtime from node_modules, never bundled: Playwright (the local queue runs
  // the worker's extraction in-process during development) and the Redis queue.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "bullmq",
    "ioredis",
    // Serverless mode's Chromium finds its compressed binary next to its own files, so it must
    // stay a real package. Next's tracing ships its bin/ by the real (pnpm store) path; adding
    // the node_modules link path too made Vercel refuse the functions ("symlinked directories").
    "@sparticuz/chromium",
  ],
  // Pricing became Plans when Thema turned into a free personal project (2026-11-22); old links
  // and search results keep working. Refunds left with the payments plan (docs/plans/).
  redirects: () =>
    Promise.resolve([
      { source: "/pricing", destination: "/plans", permanent: true },
      { source: "/refunds", destination: "/terms", permanent: true },
    ]),
  // They import each other's files as `./x.js` (the TypeScript/Node convention). Turbopack can't map
  // that to `x.ts`, so the app builds with webpack (`--webpack`), which can.
  webpack(webpackConfig: {
    resolve: { extensionAlias?: Record<string, string[]> };
    module: { rules: unknown[] };
  }) {
    webpackConfig.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    // `import text from "./file.md?raw"`: the file's text, bundled at build time (the legal pages
    // read docs/legal/*.md this way). Vitest understands `?raw` on its own.
    webpackConfig.module.rules.push({ resourceQuery: /raw/, type: "asset/source" });
    return webpackConfig;
  },
};

export default config;
