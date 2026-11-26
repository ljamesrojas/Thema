// The browser in serverless mode: @sparticuz/chromium, a Chromium build for AWS Lambda (which runs
// Vercel's functions), unpacked into /tmp on a function's first extraction. Its version matches
// Playwright's (both Chromium 158). The binary is Linux-only, so elsewhere (a laptop trying
// serverless mode) Playwright's own Chromium is used.
import type { Browser } from "playwright";

/**
 * Flags the package adds by default that Thema doesn't need and won't run with: they switch off
 * the same-origin policy, allow insecure subresources on HTTPS pages, and weaken site isolation.
 * Every request is fenced by the worker's guard anyway; these would only widen what a page can do.
 */
export const UNSAFE_ARGS = new Set([
  "--disable-web-security",
  "--allow-running-insecure-content",
  "--disable-site-isolation-trials",
]);

/** The package's arguments without UNSAFE_ARGS, plus the worker's fence arguments. */
export function serverlessArgs(packageArgs: string[], fenceArgs: string[]): string[] {
  return [...packageArgs.filter((arg) => !UNSAFE_ARGS.has(arg)), ...fenceArgs];
}

/** Launch Chromium with the worker's fence arguments added to the serverless build's own. */
export async function launchServerlessChromium(args: string[]): Promise<Browser> {
  const { chromium: playwright } = await import("playwright");
  if (process.platform !== "linux") return playwright.launch({ args });
  const { default: serverless } = await import("@sparticuz/chromium");
  // No WebGL: on a function it's drawn by the CPU (SwiftShader), costing the free plan's CPU time
  // for nothing Thema reads. This also skips unpacking SwiftShader.
  serverless.setGraphicsMode = false;
  return playwright.launch({
    args: serverlessArgs(serverless.args, args),
    executablePath: await serverless.executablePath(),
    headless: true,
  });
}
