import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ["@thema/engine", "@thema/exporters", "@thema/url-guard"],
  // They import each other's files as `./x.js` (the TypeScript/Node convention). Turbopack can't map
  // that to `x.ts`, so the app builds with webpack (`--webpack`), which can.
  webpack(webpackConfig: { resolve: { extensionAlias?: Record<string, string[]> } }) {
    webpackConfig.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return webpackConfig;
  },
};

export default config;
