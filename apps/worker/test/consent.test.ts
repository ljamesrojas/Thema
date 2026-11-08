import { afterAll, describe, expect, it } from "vitest";
import { dismissConsent } from "../src/consent.js";
import { closeBrowser, offlinePage } from "./browser-helpers.js";

afterAll(closeBrowser);

const record = (choice: string) =>
  `onclick="window.choice='${choice}'; this.closest('[id]').remove()"`;

describe("dismissConsent", () => {
  it("clicks reject before accept", async () => {
    const page = await offlinePage(`
      <div id="cookie-banner"><p>We use cookies.</p>
        <button ${record("accept")}>Accept all</button>
        <button ${record("reject")}>Reject all</button>
      </div>`);
    try {
      expect(await dismissConsent(page)).toBe("Reject all");
      expect(await page.evaluate("window.choice")).toBe("reject");
      expect(await page.locator("#cookie-banner").count()).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("uses known consent-manager buttons", async () => {
    const page = await offlinePage(`
      <div id="onetrust-banner-sdk">
        <button id="onetrust-accept-btn-handler" ${record("accept")}>I'm fine with that</button>
      </div>`);
    try {
      expect(await dismissConsent(page)).toBe("#onetrust-accept-btn-handler");
      expect(await page.evaluate("window.choice")).toBe("accept");
    } finally {
      await page.context().close();
    }
  });

  it("falls back to accept when there is no reject option", async () => {
    const page = await offlinePage(`
      <section class="gdpr-consent" id="c"><button ${record("accept")}>Got it</button></section>`);
    try {
      expect(await dismissConsent(page)).toBe("Got it");
    } finally {
      await page.context().close();
    }
  });

  it("ignores matching buttons outside a consent banner", async () => {
    const page = await offlinePage(`<main id="m"><button ${record("ok")}>OK</button></main>`);
    try {
      expect(await dismissConsent(page)).toBeNull();
      expect(await page.evaluate("window.choice")).toBeUndefined();
    } finally {
      await page.context().close();
    }
  });

  it("ignores hidden banners and pages without one", async () => {
    const page = await offlinePage(`
      <div id="cookie-banner" style="display:none"><button ${record("reject")}>Reject all</button></div>
      <p>No banner here</p>`);
    try {
      expect(await dismissConsent(page)).toBeNull();
    } finally {
      await page.context().close();
    }
  });
});
