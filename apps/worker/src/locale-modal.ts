import type { Frame, Page } from "playwright";
import { inFrame } from "./browser.js";

/**
 * Text that identifies a location/locale picker shown as a modal, e.g. Allbirds'
 * "Where are we shipping to?" (US / PH) shown to visitors outside the US.
 */
export const LOCALE_TEXT =
  "(where are (we|you) shipping( to)?|shipping to\\b|choose (your )?(country|region|location|store)|select (your )?(country|region|location|store)|(you('re| are)|looks like you('re| are)) (visiting|browsing|shopping) from|change (your )?(country|region|location)|go to (the )?(\\w+ )?(site|store)|visit (the|our) (\\w+ )?(site|store))";

/**
 * Buttons that close the modal without choosing a country. Picking a country would redirect to
 * another storefront, so flags and country names are never clicked.
 */
export const CLOSE_LABEL =
  "^(×|✕|✖|x|close|dismiss|no,? thanks|not now|stay( here| on (this|the current) (site|store))?|continue (shopping|browsing)( here)?|keep browsing)$";

interface Args {
  text: string;
  close: string;
}

type Found = { action: "clicked"; label: string } | { action: "escape" } | { action: "none" };

/** Runs in the page: finds a locale modal and clicks its close button. Self-contained. */
function closeLocaleModal(args: Args): Found {
  const textPattern = new RegExp(args.text, "i");
  const closePattern = new RegExp(args.close, "i");
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const shown =
      typeof el.checkVisibility === "function"
        ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        : true;
    return shown && r.width > 0 && r.height > 0;
  };
  const isOverlay = (el: Element): boolean => {
    const role = el.getAttribute("role");
    if (role === "dialog" || role === "alertdialog" || el.getAttribute("aria-modal") === "true") {
      return true;
    }
    if (el.tagName === "DIALOG" && (el as HTMLDialogElement).open) return true;
    return getComputedStyle(el).position === "fixed";
  };

  // Find the modal: short text matching a locale prompt, inside an overlay ancestor.
  let modal: Element | null = null;
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div,span,legend"))) {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join(" ")
      .trim();
    if (own.length === 0 || own.length > 120 || !textPattern.test(own) || !visible(el)) continue;
    for (let up: Element | null = el; up && up !== document.body; up = up.parentElement) {
      if (isOverlay(up)) {
        modal = up;
        break;
      }
    }
    if (modal) break;
  }
  if (!modal) return { action: "none" };

  const buttons = Array.from(
    modal.querySelectorAll<HTMLElement>("button,[role=button],a,input[type=button]"),
  ).filter(visible);
  for (const el of buttons) {
    const label = (el.innerText || (el as HTMLInputElement).value || "")
      .trim()
      .replace(/\s+/g, " ");
    const aria = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`;
    const hint = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
    if (closePattern.test(label) || /\b(close|dismiss)\b/i.test(aria) || /close/i.test(hint)) {
      el.click();
      return { action: "clicked", label: label || aria.trim() || "close" };
    }
  }
  return { action: "escape" };
}

async function stillOpen(frame: Frame, args: Args): Promise<boolean> {
  const found = await inFrame(frame, closeLocaleModal, { ...args, close: "(?!)" }); // detect only
  return found.action !== "none";
}

/**
 * Dismiss a "where are we shipping to?" style location modal, the same way cookie banners are
 * handled: click its close button, or press Escape when it has none. Never picks a country.
 * Returns what dismissed it, or null when there was no such modal. Never throws.
 */
export async function dismissLocaleModal(page: Page): Promise<string | null> {
  const args: Args = { text: LOCALE_TEXT, close: CLOSE_LABEL };
  try {
    const frame = page.mainFrame();
    const found = await inFrame(frame, closeLocaleModal, args);
    if (found.action === "none") return null;
    if (found.action === "clicked") {
      await page.waitForTimeout(500);
      return found.label;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    return (await stillOpen(frame, args)) ? null : "Escape";
  } catch {
    return null;
  }
}
