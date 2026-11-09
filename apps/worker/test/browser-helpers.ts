import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { inFrame } from "../src/browser.js";
import { collectSamples } from "../src/collect.js";
import type { StyleSample } from "@thema/engine";

let browser: Browser | undefined;

export async function launch(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
}

/** A page with all network requests aborted, loaded with the given HTML. */
export async function offlinePage(
  html: string,
  options: BrowserContextOptions = {},
): Promise<Page> {
  const context = await (
    await launch()
  ).newContext({
    viewport: { width: 1440, height: 900 },
    ...options,
  });
  await context.route("**/*", (route) => route.abort());
  const page = await context.newPage();
  await page.setContent(html);
  return page;
}

export async function collect(
  html: string,
  options: BrowserContextOptions = {},
  maxSamples = 2000,
  maxWrappers = 2000,
): Promise<StyleSample[]> {
  const page = await offlinePage(html, options);
  try {
    return await inFrame(page, collectSamples, { maxSamples, maxWrappers });
  } finally {
    await page.context().close();
  }
}
