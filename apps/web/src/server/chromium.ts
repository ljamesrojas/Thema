// The browser in serverless mode: @sparticuz/chromium, a Chromium build for AWS Lambda (which runs
// Vercel's functions), unpacked into /tmp on a function's first extraction. Its version matches
// Playwright's (both Chromium 158). The binary is Linux-only, so elsewhere (a laptop trying
// serverless mode) Playwright's own Chromium is used.
import type { Browser } from "playwright";

/** Launch Chromium with the worker's fence arguments added to the serverless build's own. */
export async function launchServerlessChromium(args: string[]): Promise<Browser> {
  const { chromium: playwright } = await import("playwright");
  if (process.platform !== "linux") return playwright.launch({ args });
  const { default: serverless } = await import("@sparticuz/chromium");
  return playwright.launch({
    args: [...serverless.args, ...args],
    executablePath: await serverless.executablePath(),
    headless: true,
  });
}
