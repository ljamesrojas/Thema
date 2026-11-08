import type { Frame, Page } from "playwright";
import { inFrame } from "./browser.js";

/** Known consent-manager buttons. Reject/necessary-only is tried before accept. */
export const REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  "[data-testid='uc-deny-all-button']",
  "#didomi-notice-disagree-button",
  ".fc-cta-do-not-consent",
  ".qc-cmp2-summary-buttons button[mode='secondary']",
];
export const ACCEPT_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "[data-testid='uc-accept-all-button']",
  "#didomi-notice-agree-button",
  ".fc-cta-consent",
  ".qc-cmp2-summary-buttons button[mode='primary']",
];

/** Exact button labels (case-insensitive) that dismiss a banner. */
export const REJECT_TEXT =
  "^(reject( all)?( cookies)?|decline( all)?|deny( all)?|refuse( all)?|necessary only|only necessary|essential only|(use )?(only )?necessary cookies( only)?|alle ablehnen|tout refuser|rechazar( todo)?)$";
export const ACCEPT_TEXT =
  "^(accept( all)?( cookies)?|allow( all)?( cookies)?|i agree|agree|i accept|got it|ok|okay|alle akzeptieren|tout accepter|aceptar( todo)?)$";

/** Elements that look like a consent banner; text matching only happens inside these. */
const CONSENT_CONTAINERS = [
  "[id*=cookie i]",
  "[class*=cookie i]",
  "[id*=consent i]",
  "[class*=consent i]",
  "[id*=gdpr i]",
  "[class*=gdpr i]",
  "[aria-label*=cookie i]",
  "[aria-label*=consent i]",
].join(",");

/** Iframes from consent vendors, where the whole document is the banner. */
const CONSENT_FRAME_URL = /consent|cookie|cmp|privacy-mgmt|sourcepoint|didomi|usercentrics/i;

interface ClickArgs {
  selectors: string[];
  text: string;
  containers: string;
  anywhere: boolean;
}

/** Runs in the page: clicks the first visible matching button. Self-contained. */
function clickConsent(args: ClickArgs): string | null {
  const visible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    const shown =
      typeof el.checkVisibility === "function"
        ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        : true;
    return shown && rect.width > 0 && rect.height > 0;
  };
  for (const selector of args.selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && visible(el)) {
      el.click();
      return selector;
    }
  }
  const pattern = new RegExp(args.text, "i");
  const buttons = "button,[role=button],input[type=button],input[type=submit]";
  const scope = args.anywhere ? buttons : `:is(${args.containers}) :is(${buttons})`;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(scope))) {
    const label = (el.innerText || (el as HTMLInputElement).value || "")
      .trim()
      .replace(/\s+/g, " ");
    if (pattern.test(label) && visible(el)) {
      el.click();
      return label;
    }
  }
  return null;
}

async function tryFrames(
  frames: Frame[],
  selectors: string[],
  text: string,
): Promise<string | null> {
  for (const frame of frames) {
    const anywhere = frame !== frame.page().mainFrame() && CONSENT_FRAME_URL.test(frame.url());
    try {
      const clicked = await inFrame(frame, clickConsent, {
        selectors,
        text,
        containers: CONSENT_CONTAINERS,
        anywhere,
      });
      if (clicked) return clicked;
    } catch {
      // Detached or cross-origin-restricted frame: ignore and keep going.
    }
  }
  return null;
}

/**
 * Try to dismiss a cookie banner: reject/necessary-only first (in every frame), then accept.
 * Returns what was clicked, or null when nothing matched. Never throws.
 */
export async function dismissConsent(page: Page): Promise<string | null> {
  const frames = page.frames();
  const clicked =
    (await tryFrames(frames, REJECT_SELECTORS, REJECT_TEXT)) ??
    (await tryFrames(frames, ACCEPT_SELECTORS, ACCEPT_TEXT));
  if (clicked) await page.waitForTimeout(500); // let the banner animate away
  return clicked;
}
