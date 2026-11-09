import { afterAll, describe, expect, it } from "vitest";
import { dismissLocaleModal } from "../src/locale-modal.js";
import { closeBrowser, offlinePage } from "./browser-helpers.js";

afterAll(closeBrowser);

const OVERLAY = "position:fixed;inset:0;background:rgba(0,0,0,.5)";
const record = (choice: string) => `onclick="window.choice='${choice}'"`;

describe("dismissLocaleModal", () => {
  it("closes an Allbirds-style shipping modal with its close button, never a country", async () => {
    const page = await offlinePage(`
      <main><p>Wildly comfortable</p></main>
      <div id="geo" style="${OVERLAY}">
        <div role="dialog" style="background:#fff;width:360px;margin:100px auto;padding:24px">
          <button aria-label="Close" onclick="window.choice='close'; document.getElementById('geo').remove()">✕</button>
          <h2>Where are we shipping to?</h2>
          <button ${record("US")}>US</button>
          <button ${record("PH")}>PH</button>
        </div>
      </div>`);
    try {
      expect(await dismissLocaleModal(page)).toBe("✕");
      expect(await page.evaluate("window.choice")).toBe("close");
      expect(await page.locator("#geo").count()).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("uses a text close button such as Stay here", async () => {
    const page = await offlinePage(`
      <div id="geo" style="${OVERLAY}"><div>
        <p>Looks like you're browsing from the Philippines.</p>
        <a href="#" onclick="window.choice='switch'">Go to PH store</a>
        <button onclick="window.choice='stay'; document.getElementById('geo').remove()">Stay here</button>
      </div></div>`);
    try {
      expect(await dismissLocaleModal(page)).toBe("Stay here");
      expect(await page.evaluate("window.choice")).toBe("stay");
    } finally {
      await page.context().close();
    }
  });

  it("presses Escape when the modal has no close button", async () => {
    const page = await offlinePage(`
      <div id="geo" role="dialog" aria-modal="true" style="${OVERLAY}">
        <h2>Choose your country</h2><button ${record("US")}>United States</button>
      </div>
      <script>addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("geo").remove(); });</script>`);
    try {
      expect(await dismissLocaleModal(page)).toBe("Escape");
      expect(await page.evaluate("window.choice")).toBeUndefined();
      expect(await page.locator("#geo").count()).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("reports nothing when Escape doesn't close it either", async () => {
    const page = await offlinePage(`
      <div role="dialog" style="${OVERLAY}"><h2>Select your region</h2><button>EU</button></div>`);
    try {
      expect(await dismissLocaleModal(page)).toBeNull();
    } finally {
      await page.context().close();
    }
  });

  it("leaves other modals and inline country pickers alone", async () => {
    const page = await offlinePage(`
      <div role="dialog" style="${OVERLAY}"><h2>Subscribe to our newsletter</h2>
        <button aria-label="Close" ${record("closed-newsletter")}>×</button></div>
      <footer><span>Choose your country</span><button ${record("footer")}>Close</button></footer>`);
    try {
      expect(await dismissLocaleModal(page)).toBeNull();
      expect(await page.evaluate("window.choice")).toBeUndefined();
    } finally {
      await page.context().close();
    }
  });
});
