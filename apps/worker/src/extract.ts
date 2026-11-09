import { canvasFlipsInDark, type StyleSample } from "@thema/engine";
import { chromium, type APIRequestContext, type Browser, type Route } from "playwright";
import { inFrame, SCROLL_PAUSE_MS, scrollThrough, settle } from "./browser.js";
import { collectSamples } from "./collect.js";
import { dismissConsent } from "./consent.js";
import { dismissLocaleModal } from "./locale-modal.js";
import {
  assertPublicUrl,
  BlockedUrlError,
  createRequestGuard,
  systemLookup,
  type Lookup,
} from "./ssrf.js";

export const VIEWPORT = { width: 1440, height: 900 } as const;
export const MAX_SAMPLES = 2000;
/** Spacing-only layout wrappers get their own budget (see CollectOptions.maxWrappers). */
export const MAX_WRAPPERS = 2000;
export const MAX_REDIRECTS = 10;

/** One HTTP request to make, without following redirects. */
export interface Hop {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData: Buffer | null;
}

/** A response handed to the browser. */
export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
}

/**
 * Performs one hop WITHOUT following redirects. The default uses the browser context's own
 * request client (shared cookies). Tests pass an in-memory website so nothing touches the network.
 */
export type Upstream = (hop: Hop) => Promise<UpstreamResponse>;

export interface ExtractOptions {
  /** DNS lookup used by the SSRF guard. Defaults to the system resolver. */
  lookup?: Lookup;
  /** Replaces the network fetch (tests). The SSRF guard still checks every hop first. */
  upstream?: Upstream;
  /** Per-request and navigation timeout. */
  timeoutMs?: number;
}

export interface Extraction {
  /** The page URL after redirects. */
  url: string;
  light: StyleSample[];
  /** Present only when the page has a real dark theme (the canvas flips). */
  dark?: StyleSample[];
  /** Full-page PNG of the light pass. */
  screenshot: Buffer;
  /** What was clicked to dismiss a cookie banner in each pass, if anything. */
  consent: { light: string | null; dark: string | null };
  /** What closed a "where are we shipping to?" style location modal in each pass, if any. */
  localeModal: { light: string | null; dark: string | null };
  /** Request URLs (including redirect hops) that the SSRF guard blocked. */
  blocked: string[];
}

type Guard = (url: string) => Promise<boolean>;

/** Headers we don't forward: the request client sets them itself. */
const DROP_REQUEST_HEADERS = new Set(["host", "cookie", "content-length", "connection"]);
/** Headers we don't pass back: the body is already decoded and re-framed. */
const DROP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

const filterHeaders = (headers: Record<string, string>, drop: Set<string>) =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !drop.has(k.toLowerCase())));

const headerValue = (headers: Record<string, string>, name: string): string | undefined =>
  Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];

/**
 * Follow a redirect chain ourselves, checking EVERY hop with the SSRF guard before it is
 * requested. (Chromium follows redirects outside Playwright's route handler, so letting the
 * browser do it would skip the guard.) Returns null when a hop is blocked or there are too many.
 */
export async function fetchGuarded(
  first: Hop,
  upstream: Upstream,
  guard: Guard,
  blocked: string[],
): Promise<{ url: string; response: UpstreamResponse } | null> {
  let hop = first;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!(await guard(hop.url))) {
      blocked.push(hop.url);
      return null;
    }
    const response = await upstream(hop);
    const location =
      response.status >= 300 && response.status < 400
        ? headerValue(response.headers, "location")
        : undefined;
    if (location === undefined) return { url: hop.url, response };
    // 303, and 301/302 after a POST, continue as a GET without a body, as browsers do.
    const asGet =
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && hop.method === "POST");
    hop = {
      url: new URL(location, hop.url).href,
      method: asGet ? "GET" : hop.method,
      headers: hop.headers,
      postData: asGet ? null : hop.postData,
    };
  }
  return null;
}

function requestClientUpstream(client: APIRequestContext, timeoutMs: number): Upstream {
  return async (hop) => {
    const response = await client.fetch(hop.url, {
      method: hop.method,
      headers: hop.headers,
      ...(hop.postData ? { data: hop.postData } : {}),
      maxRedirects: 0,
      timeout: timeoutMs,
      failOnStatusCode: false,
    });
    return { status: response.status(), headers: response.headers(), body: await response.body() };
  };
}

interface Pass {
  url: string;
  samples: StyleSample[];
  screenshot?: Buffer;
  consent: string | null;
  localeModal: string | null;
}

async function capture(
  browser: Browser,
  url: string,
  colorScheme: "light" | "dark",
  deps: { guard: Guard; blocked: string[]; timeoutMs: number; upstream: Upstream | undefined },
  withScreenshot: boolean,
): Promise<Pass> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme,
    reducedMotion: "reduce",
  });
  try {
    const upstream = deps.upstream ?? requestClientUpstream(context.request, deps.timeoutMs);

    // Resolve the page's own redirects first (guarded), so it loads at its final URL and
    // relative links resolve correctly.
    const start = await fetchGuarded(
      { url, method: "GET", headers: {}, postData: null },
      upstream,
      deps.guard,
      deps.blocked,
    );
    if (!start) throw new BlockedUrlError(`Blocked a redirect from ${url} to a non-public address`);

    await context.route("**/*", (route) => handle(route, upstream, deps));

    const page = await context.newPage();
    await page.goto(start.url, { waitUntil: "load", timeout: deps.timeoutMs });
    await settle(page, 10_000);
    const consent = await dismissConsent(page);
    const localeModal = await dismissLocaleModal(page);

    // Scroll down gradually so scroll-triggered and lazy content renders, then return to the
    // top and wait for network idle (the lazy content's requests) before sampling.
    await scrollThrough(page);
    await inFrame(page, () => window.scrollTo(0, 0), undefined);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
    await settle(page, 10_000);

    const samples = await inFrame(page, collectSamples, {
      maxSamples: MAX_SAMPLES,
      maxWrappers: MAX_WRAPPERS,
    });
    const screenshot = withScreenshot ? await page.screenshot({ fullPage: true }) : undefined;
    return {
      url: page.url(),
      samples,
      consent,
      localeModal,
      ...(screenshot ? { screenshot } : {}),
    };
  } finally {
    await context.close();
  }
}

async function handle(
  route: Route,
  upstream: Upstream,
  deps: { guard: Guard; blocked: string[] },
): Promise<void> {
  const request = route.request();
  if (request.resourceType() === "media") {
    await route.abort("aborted"); // video/audio: large, and irrelevant to styles
    return;
  }
  try {
    const result = await fetchGuarded(
      {
        url: request.url(),
        method: request.method(),
        headers: filterHeaders(request.headers(), DROP_REQUEST_HEADERS),
        postData: request.postDataBuffer(),
      },
      upstream,
      deps.guard,
      deps.blocked,
    );
    if (!result) {
      await route.abort("blockedbyclient");
      return;
    }
    const { status, headers, body } = result.response;
    await route.fulfill({ status, headers: filterHeaders(headers, DROP_RESPONSE_HEADERS), body });
  } catch {
    await route.abort("failed").catch(() => undefined);
  }
}

/**
 * Load a public page in headless Chromium and record raw StyleSamples: one light pass (with a
 * screenshot) and one `prefers-color-scheme: dark` pass, kept only if the canvas flips.
 * Throws BlockedUrlError before launching anything if the URL isn't public.
 */
export async function extract(rawUrl: string, options: ExtractOptions = {}): Promise<Extraction> {
  const lookup = options.lookup ?? systemLookup;
  const url = await assertPublicUrl(rawUrl, lookup);
  const deps = {
    guard: createRequestGuard(lookup),
    blocked: [] as string[],
    timeoutMs: options.timeoutMs ?? 30_000,
    upstream: options.upstream,
  };

  const browser = await chromium.launch();
  try {
    const light = await capture(browser, url.href, "light", deps, true);
    const dark = await capture(browser, url.href, "dark", deps, false);
    if (!light.screenshot) throw new Error("light pass produced no screenshot"); // unreachable
    return {
      url: light.url,
      light: light.samples,
      ...(canvasFlipsInDark(light.samples, dark.samples) ? { dark: dark.samples } : {}),
      screenshot: light.screenshot,
      consent: { light: light.consent, dark: dark.consent },
      localeModal: { light: light.localeModal, dark: dark.localeModal },
      blocked: deps.blocked,
    };
  } finally {
    await browser.close();
  }
}
