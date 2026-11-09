import { parseCssColor, type StyleSample } from "@thema/engine";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, collect } from "./browser-helpers.js";

afterAll(closeBrowser);

const page = (body: string, head = "") =>
  `<!doctype html><html><head><style>body{margin:0;font:16px/24px Arial,sans-serif}</style>${head}</head><body>${body}</body></html>`;

const byTag = (samples: StyleSample[], tag: string) => samples.filter((s) => s.tag === tag);
const one = (samples: StyleSample[], tag: string): StyleSample => {
  const found = byTag(samples, tag);
  if (found.length !== 1) throw new Error(`expected one <${tag}>, got ${found.length}`);
  return found[0] as StyleSample;
};

describe("collectSamples: roles", () => {
  it("guesses roles from tags and ARIA", async () => {
    const samples = await collect(
      page(`
        <h2>Title</h2>
        <p>Body text</p>
        <a href="/x">Link</a>
        <button>Go</button>
        <input type="text" value="hi">
        <span role="heading">Aria heading</span>
        <div role="button">Aria button</div>
        <section style="background:#eee;height:40px"></section>
      `),
    );
    expect(one(samples, "h2").role).toBe("heading");
    expect(one(samples, "p").role).toBe("body");
    expect(one(samples, "a").role).toBe("interactive");
    expect(one(samples, "button").role).toBe("interactive");
    expect(one(samples, "input").role).toBe("interactive");
    expect(one(samples, "span").role).toBe("heading");
    expect(one(samples, "div").role).toBe("interactive");
    expect(one(samples, "section").role).toBe("container");
  });

  it("treats a link without href as text, not interactive", async () => {
    const samples = await collect(page(`<a>Not a link</a>`));
    expect(one(samples, "a").role).toBe("body");
  });

  it("skips pure wrappers but keeps html and body", async () => {
    const samples = await collect(page(`<div><div><p>Text</p></div></div>`));
    expect(byTag(samples, "div")).toHaveLength(0);
    expect(byTag(samples, "html")).toHaveLength(1);
    expect(byTag(samples, "body")).toHaveLength(1);
  });
});

describe("collectSamples: visibility and area", () => {
  it("skips hidden, transparent, zero-size and off-screen elements", async () => {
    const samples = await collect(
      page(`
        <p id="shown">Shown</p>
        <h1 style="display:none">None</h1>
        <h2 style="visibility:hidden">Hidden</h2>
        <h3 style="opacity:0">Invisible</h3>
        <h4 style="width:0;height:0;overflow:hidden">Zero</h4>
        <h5 style="position:absolute;left:-9999px;top:0">Off-screen</h5>
      `),
    );
    expect(byTag(samples, "p")).toHaveLength(1);
    for (const tag of ["h1", "h2", "h3", "h4", "h5"]) expect(byTag(samples, tag)).toHaveLength(0);
  });

  it("measures area from the box and gives html the whole document", async () => {
    const samples = await collect(
      page(
        `<section style="width:300px;height:200px;background:#eee"></section><div style="height:2000px"></div>`,
      ),
    );
    expect(one(samples, "section").area).toBe(60_000);
    expect(one(samples, "html").area).toBeGreaterThanOrEqual(1440 * 2000);
  });

  it("keeps the largest samples, in document order, when capped", async () => {
    const box = (w: number) =>
      `<section style="width:${w}px;height:10px;background:#eee"></section>`;
    const samples = await collect(page(box(10) + box(300) + box(20) + box(200)), {}, 4);
    // html and body are largest; then the 300px and 200px boxes, kept in document order.
    expect(samples.map((s) => (s.tag === "section" ? s.area : s.tag))).toEqual([
      "html",
      "body",
      3000,
      2000,
    ]);
  });
});

describe("collectSamples: field rules", () => {
  it("sends borderColor only for a drawn border, from the widest side", async () => {
    const samples = await collect(
      page(`
        <p id="a" style="border:0 solid red">No border</p>
        <h1 style="border-top:1px solid rgb(255, 0, 0);border-bottom:3px solid rgb(0, 0, 255)">Two</h1>
        <h2 style="border:2px none rgb(0, 128, 0)">Style none</h2>
      `),
    );
    expect(one(samples, "p").borderColor).toBeUndefined();
    expect(one(samples, "h1").borderColor).toBe("rgb(0, 0, 255)");
    expect(one(samples, "h2").borderColor).toBeUndefined();
  });

  it("converts normal line height and letter spacing", async () => {
    const samples = await collect(
      page(
        `<p style="font-size:20px;line-height:normal;letter-spacing:normal">x</p><h1 style="font-size:40px;line-height:48px;letter-spacing:-1px">y</h1>`,
      ),
    );
    expect(one(samples, "p")).toMatchObject({ fontSize: 20, lineHeight: 24, letterSpacing: 0 });
    expect(one(samples, "h1")).toMatchObject({ fontSize: 40, lineHeight: 48, letterSpacing: -1 });
  });

  it("reports the largest corner radius, resolving percentages", async () => {
    const samples = await collect(
      page(`
        <section style="width:100px;height:50px;background:#eee;border-radius:50%"></section>
        <aside style="width:100px;height:50px;background:#eee;border-radius:4px 12px 4px 4px"></aside>
      `),
    );
    expect(one(samples, "section").borderRadius).toBe(25);
    expect(one(samples, "aside").borderRadius).toBe(12);
  });

  it("reports gap only on flex and grid containers", async () => {
    const samples = await collect(
      page(`
        <nav style="display:flex;gap:12px;background:#eee"><span>a</span><span>b</span></nav>
        <section style="display:block;gap:20px;background:#eee"><p>c</p></section>
      `),
    );
    expect(one(samples, "nav").gap).toBe(12);
    expect(one(samples, "section").gap).toBeUndefined();
  });

  it("omits none values and reads padding, margin, shadow and max-width", async () => {
    const samples = await collect(
      page(
        `<article style="padding:8px 16px;margin:4px;max-width:600px;box-shadow:0 1px 2px rgba(0,0,0,0.1);background:#fff">t</article><p>plain</p>`,
      ),
    );
    const article = one(samples, "article");
    expect(article.padding).toEqual([8, 16, 8, 16]);
    expect(article.margin).toEqual([4, 4, 4, 4]);
    expect(article.maxWidth).toBe(600);
    expect(article.boxShadow).toContain("0px 1px 2px");
    const p = one(samples, "p");
    expect(p.boxShadow).toBeUndefined();
    expect(p.maxWidth).toBeUndefined();
  });
});

describe("collectSamples: opacity", () => {
  it("records effective opacity, multiplied through ancestors", async () => {
    const samples = await collect(
      page(
        `<div style="opacity:0.5;background:#eee"><p style="opacity:0.8">Faded</p></div><h1>Plain</h1>`,
      ),
    );
    expect(one(samples, "div").opacity).toBe(0.5);
    expect(one(samples, "p").opacity).toBe(0.4);
    expect(one(samples, "h1").opacity).toBeUndefined();
  });

  it("never records opacity on html, whose sample is the canvas", async () => {
    const samples = await collect(page(`<p>Text</p>`, `<style>html{opacity:0.9}</style>`));
    expect(one(samples, "html").opacity).toBeUndefined();
    expect(one(samples, "p").opacity).toBeUndefined();
  });
});

describe("collectSamples: canvas", () => {
  const lightness = (css: string) => parseCssColor(css)?.l ?? Number.NaN;

  it("reports the browser's white canvas when html and body are transparent", async () => {
    const samples = await collect(page(`<p>Text</p>`));
    expect(one(samples, "html").backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("reports a dark canvas under color-scheme: dark", async () => {
    const samples = await collect(
      page(`<p>Text</p>`, `<meta name="color-scheme" content="dark">`),
      {
        colorScheme: "dark",
      },
    );
    expect(lightness(one(samples, "html").backgroundColor)).toBeLessThan(0.3);
  });

  it("propagates the body background to the canvas, as CSS does", async () => {
    const samples = await collect(
      page(`<p>Text</p>`, `<style>body{background:rgb(250, 246, 238)}</style>`),
    );
    expect(one(samples, "html").backgroundColor).toBe("rgb(250, 246, 238)");
  });
});

describe("collectSamples: visually hidden elements", () => {
  const SR_ONLY =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

  it("skips sr-only skip links and clip-path-hidden wrappers, keeps normal links", async () => {
    const samples = await collect(
      page(`
        <a href="#main" style="${SR_ONLY};color:rgb(94, 106, 210)">Skip to content</a>
        <div style="position:absolute;clip-path:inset(50%)"><button>Hidden action</button></div>
        <section style="clip:rect(0 0 0 0);position:absolute"><h2>Clipped heading</h2></section>
        <a href="/pricing">Pricing</a>
      `),
    );
    const links = byTag(samples, "a");
    expect(links).toHaveLength(1);
    expect(links[0]?.color).not.toBe("rgb(94, 106, 210)");
    expect(byTag(samples, "button")).toHaveLength(0);
    expect(byTag(samples, "h2")).toHaveLength(0);
  });

  it("skips boxes 1px or smaller in either dimension", async () => {
    const samples = await collect(
      page(
        `<button style="width:200px;height:1px;padding:0;border:0;overflow:hidden;background:red">x</button>`,
      ),
    );
    expect(byTag(samples, "button")).toHaveLength(0);
  });
});

describe("collectSamples: fill behind transparent buttons", () => {
  const CTA =
    "position:relative;display:inline-block;width:180px;height:48px;background:transparent;color:#fff";

  it("reads a ::before that covers the button (Duolingo)", async () => {
    const samples = await collect(
      page(
        `<a href="/start" class="cta">Get started</a>`,
        `<style>.cta{${CTA}} .cta::before{content:"";position:absolute;inset:0;background:rgb(88, 204, 2);z-index:-1}</style>`,
      ),
    );
    expect(one(samples, "a")).toMatchObject({
      backgroundColor: "rgba(0, 0, 0, 0)",
      fill: "rgb(88, 204, 2)",
    });
  });

  it("reads a covering ::after", async () => {
    const samples = await collect(
      page(
        `<button class="cta">Sign up</button>`,
        `<style>.cta{${CTA};border:0} .cta::after{content:"";position:absolute;inset:0;background:rgb(255, 224, 27);z-index:-1}</style>`,
      ),
    );
    expect(one(samples, "button").fill).toBe("rgb(255, 224, 27)");
  });

  it("ignores a small decorative ::before dot", async () => {
    const samples = await collect(
      page(
        `<a href="/inbox" class="cta">Inbox</a>`,
        `<style>.cta{${CTA}} .cta::before{content:"";position:absolute;top:4px;right:4px;width:8px;height:8px;background:rgb(239, 68, 68)}</style>`,
      ),
    );
    expect(one(samples, "a").fill).toBeUndefined();
  });

  it("reads the first stop of a gradient background (Resend's glass button)", async () => {
    const samples = await collect(
      page(
        `<a href="/signup" style="${CTA};background-image:linear-gradient(rgb(15, 15, 15), rgb(24, 24, 24))">Get started</a>`,
      ),
    );
    expect(one(samples, "a").fill).toBe("rgb(15, 15, 15)");
  });

  it("reads a child that covers the button", async () => {
    const samples = await collect(
      page(
        `<a href="/go" style="${CTA}"><span style="display:block;width:100%;height:100%;background:rgb(0, 97, 239)">Go</span></a>`,
      ),
    );
    expect(one(samples, "a").fill).toBe("rgb(0, 97, 239)");
  });

  it("records no fill when the button has its own background, or isn't interactive", async () => {
    const samples = await collect(
      page(
        `<button class="solid" style="background:rgb(37, 99, 235)">Buy</button><div class="card">Card</div>`,
        `<style>.solid{width:120px;height:40px;position:relative} .solid::before{content:"";position:absolute;inset:0;background:red}
         .card{position:relative;width:200px;height:80px} .card::before{content:"";position:absolute;inset:0;background:rgb(1, 2, 3)}</style>`,
      ),
    );
    expect(one(samples, "button").fill).toBeUndefined();
    expect(byTag(samples, "div").every((s) => s.fill === undefined)).toBe(true);
  });
});

describe("collectSamples: position", () => {
  it("records y as the top of the box in the document", async () => {
    const samples = await collect(
      page(`<div style="height:1200px"></div><h2 style="margin:0">Below</h2>`),
    );
    expect(one(samples, "h2").y).toBe(1200);
    expect(one(samples, "html").y).toBe(0);
  });
});

describe("collectSamples: heading and code ancestry", () => {
  it("marks headings and text nested inside them, however deep", async () => {
    const samples = await collect(
      page(`
        <h1>Plain <span class="a">styled <em>deep</em></span></h1>
        <div role="heading" aria-level="2"><b>Aria</b></div>
        <p>Body <span>text</span></p>
      `),
    );
    expect(one(samples, "h1").inHeading).toBe(true);
    expect(one(samples, "em").inHeading).toBe(true);
    expect(one(samples, "b").inHeading).toBe(true);
    const spans = byTag(samples, "span");
    expect(spans.map((s) => s.inHeading)).toEqual([true, undefined]);
    expect(one(samples, "p")).not.toHaveProperty("inHeading");
  });

  it("marks pre/code/kbd/samp and the highlight spans inside them", async () => {
    const samples = await collect(
      page(`
        <pre style="background:#f4f4f4"><code><span style="color:#c00">const</span> x = 1;</code></pre>
        <p>Press <kbd>K</kbd> or see <samp>output</samp></p>
        <p>Plain <span>text</span></p>
      `),
    );
    expect(one(samples, "pre").inCode).toBe(true);
    expect(one(samples, "code").inCode).toBe(true);
    expect(one(samples, "kbd").inCode).toBe(true);
    expect(one(samples, "samp").inCode).toBe(true);
    expect(byTag(samples, "span").map((s) => s.inCode)).toEqual([true, undefined]);
    expect(byTag(samples, "p").every((s) => !("inCode" in s))).toBe(true);
  });
});

describe("collectSamples: fill only on button-sized elements", () => {
  const before = (selector: string, color: string) =>
    `<style>${selector}{position:relative;display:block;background:transparent} ${selector}::before{content:"";position:absolute;inset:0;background:${color};z-index:-1}</style>`;

  it("records fill up to 480×80 (the largest real CTAs are 435×78)", async () => {
    const samples = await collect(
      page(
        `<a href="/x" class="b" style="width:480px;height:80px">Big button</a>`,
        before(".b", "rgb(0, 97, 239)"),
      ),
    );
    expect(one(samples, "a").fill).toBe("rgb(0, 97, 239)");
  });

  it("records no fill on a tall card link (Supabase's testimonial card)", async () => {
    const samples = await collect(
      page(
        `<div role="link" class="card" style="width:940px;height:384px;background-image:linear-gradient(90deg, rgb(253, 73, 168), rgb(249, 115, 22))">Lovable</div>`,
      ),
    );
    expect(one(samples, "div").fill).toBeUndefined();
  });

  it("records no fill on a wide row link (Mozilla's 1440×76 product rows)", async () => {
    const samples = await collect(
      page(
        `<a href="/firefox" class="row" style="width:1440px;height:76px">Firefox</a>`,
        before(".row", "rgb(0, 0, 0)"),
      ),
    );
    expect(one(samples, "a").fill).toBeUndefined();
  });

  it("records no fill just over the height limit", async () => {
    const samples = await collect(
      page(
        `<a href="/x" class="b" style="width:200px;height:81px">Tall</a>`,
        before(".b", "rgb(0, 97, 239)"),
      ),
    );
    expect(one(samples, "a").fill).toBeUndefined();
  });
});
