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

/** Wait for network idle, but give up after `timeoutMs`: many sites never go fully idle. */
export async function settle(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // Still busy (analytics, long polling). Carry on with what has loaded.
  }
}
