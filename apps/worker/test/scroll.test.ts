import { afterAll, describe, expect, it } from "vitest";
import { scrollThrough } from "../src/browser.js";
import { closeBrowser, offlinePage } from "./browser-helpers.js";

afterAll(closeBrowser);

const fast = { stepPx: 600, pauseMs: 20 };

describe("scrollThrough", () => {
  it("stops at the bottom of a normal page", async () => {
    // 3000px page, 900px viewport: bottom reached after scrolling 2100px, i.e. 4 steps of 600.
    const page = await offlinePage(
      `<body style="margin:0"><div style="height:3000px"></div></body>`,
    );
    try {
      expect(await scrollThrough(page, fast)).toBe(4);
    } finally {
      await page.context().close();
    }
  });

  it("follows a page that grows as it scrolls (lazy sections)", async () => {
    // Grows once by 1200px when the user first nears the bottom.
    const page = await offlinePage(`<body style="margin:0"><div id="c" style="height:1800px"></div>
      <script>let grown = false; addEventListener("scroll", () => {
        if (!grown && scrollY + innerHeight > 1700) { grown = true; document.getElementById("c").style.height = "3000px"; }
      });</script></body>`);
    try {
      expect(await scrollThrough(page, fast)).toBe(4); // 1800 would take 2 steps; 3000 takes 4
    } finally {
      await page.context().close();
    }
  });

  it("gives up after maxSteps on infinite scroll", async () => {
    const page = await offlinePage(`<body style="margin:0"><div id="c" style="height:1200px"></div>
      <script>addEventListener("scroll", () => {
        const c = document.getElementById("c"); c.style.height = (c.offsetHeight + 1200) + "px";
      });</script></body>`);
    try {
      expect(await scrollThrough(page, { ...fast, maxSteps: 5 })).toBe(5);
    } finally {
      await page.context().close();
    }
  });
});
