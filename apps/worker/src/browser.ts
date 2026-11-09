import type { Frame, Page } from "playwright";

/**
 * tsx (esbuild) can wrap functions in `__name(...)` calls to keep their names. Those calls
 * break when the function is serialized into the page by evaluate, so define a no-op first.
 * This is passed as a string so it is never transformed itself.
 */
const NAME_SHIM = "globalThis.__name ??= (fn) => fn; undefined";

/** page/frame.evaluate with the __name shim installed first. */
export async function inFrame<A, R>(target: Page | Frame, fn: (arg: A) => R, arg: A): Promise<R> {
  await target.evaluate(NAME_SHIM);
  // Playwright types the in-page argument as Unboxed<A> (handles become values). Our arguments
  // are plain JSON, where Unboxed<A> is A, so widening the parameter type here is safe.
  return target.evaluate(fn as (arg: unknown) => R, arg);
}

export const SCROLL_STEP_PX = 600;
export const SCROLL_PAUSE_MS = 300;
/** 60 × 600px = 36,000px: enough for long landing pages, and a stop for infinite scroll. */
export const MAX_SCROLL_STEPS = 60;

/**
 * Scroll down gradually so scroll-triggered content (IntersectionObserver reveals, lazy
 * sections) renders: a single jump to the bottom skips everything in between. Re-checks the
 * bottom after each pause, because lazy content can make the page taller. Returns the steps taken.
 */
export async function scrollThrough(
  page: Page,
  { stepPx = SCROLL_STEP_PX, pauseMs = SCROLL_PAUSE_MS, maxSteps = MAX_SCROLL_STEPS } = {},
): Promise<number> {
  for (let step = 1; step <= maxSteps; step++) {
    await inFrame(page, (px: number) => window.scrollBy(0, px), stepPx);
    await page.waitForTimeout(pauseMs);
    const atBottom = await inFrame(
      page,
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
      undefined,
    );
    if (atBottom) return step;
  }
  return maxSteps;
}

/** Wait for network idle, but give up after `timeoutMs`: many sites never go fully idle. */
export async function settle(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // Still busy (analytics, long polling). Carry on with what has loaded.
  }
}
