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
  serverExternalPackages: ["playwright", "playwright-core", "bullmq", "ioredis"],
  // They import each other's files as `./x.js` (the TypeScript/Node convention). Turbopack can't map
  // that to `x.ts`, so the app builds with webpack (`--webpack`), which can.
  webpack(webpackConfig: { resolve: { extensionAlias?: Record<string, string[]> } }) {
    webpackConfig.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return webpackConfig;
  },
};

export default config;
