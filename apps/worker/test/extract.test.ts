import { describe, expect, it } from "vitest";
import {
  extract,
  fetchGuarded,
  type Hop,
  type Upstream,
  type UpstreamResponse,
} from "../src/extract.js";
import { BlockedUrlError, type Lookup } from "../src/ssrf.js";

/** Fake DNS: *.internal resolves to a private address, everything else to a public one. */
const lookup: Lookup = (host) =>
  Promise.resolve(host.endsWith(".internal") ? ["10.0.0.7"] : ["93.184.215.14"]);

const html = (body: string): UpstreamResponse => ({
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
  body,
});
const redirect = (location: string, status = 302): UpstreamResponse => ({
  status,
  headers: { location },
  body: "",
});

/** An in-memory website. Records every URL it is asked for. */
function website(pages: Record<string, UpstreamResponse>): {
  upstream: Upstream;
  requested: string[];
} {
  const requested: string[] = [];
  return {
    requested,
    upstream: (hop: Hop) => {
      requested.push(hop.url);
      return Promise.resolve(pages[hop.url] ?? { status: 404, headers: {}, body: "" });
    },
  };
}

const THEMED = `<!doctype html><html><head><style>
  body { margin: 0; background: #ffffff; color: #111111; font: 16px/24px Arial, sans-serif }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #ededed } }
  button { background: #2563eb; color: #fff; padding: 8px 16px; border: 0; border-radius: 8px }
</style></head><body><h1>Hello</h1><p>Text</p><button>Start</button></body></html>`;

const PLAIN = `<!doctype html><html><body style="margin:0;background:#fff"><h1>Plain</h1><p>No dark theme</p></body></html>`;

describe("extract (in-memory site, no network)", () => {
  it("records light samples, a PNG screenshot, and dark samples when the canvas flips", async () => {
    const site = website({ "https://themed.test/": html(THEMED) });
    const result = await extract("https://themed.test/", { lookup, upstream: site.upstream });

    expect(result.url).toBe("https://themed.test/");
    expect(result.light.find((s) => s.tag === "button")?.role).toBe("interactive");
    expect(result.dark).toBeDefined();
    expect(result.screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(result.blocked).toEqual([]);
  });

  it("drops the dark pass when the site ignores the preference", async () => {
    const site = website({ "https://plain.test/": html(PLAIN) });
    const result = await extract("https://plain.test/", { lookup, upstream: site.upstream });
    expect(result.light.length).toBeGreaterThan(0);
    expect(result.dark).toBeUndefined();
  });

  it("follows a public redirect and loads the page at its final URL", async () => {
    const site = website({
      "https://plain.test/": redirect("https://www.plain.test/", 301),
      "https://www.plain.test/": html(PLAIN),
    });
    const result = await extract("https://plain.test/", { lookup, upstream: site.upstream });
    expect(result.url).toBe("https://www.plain.test/");
  });

  it("refuses a page that redirects to a private address, without requesting it", async () => {
    const site = website({ "https://evil.test/": redirect("http://metadata.internal/latest") });
    await expect(
      extract("https://evil.test/", { lookup, upstream: site.upstream }),
    ).rejects.toBeInstanceOf(BlockedUrlError);
    expect(site.requested.some((u) => u.includes(".internal"))).toBe(false);
  });

  it("blocks sub-requests and their redirect hops to private addresses", async () => {
    const page = `<!doctype html><html><body style="background:#fff">
      <img src="https://cdn.test/pixel.png"><img src="https://admin.internal/direct.png"><p>x</p></body></html>`;
    const site = website({
      "https://sneaky.test/": html(page),
      "https://cdn.test/pixel.png": redirect("http://admin.internal/secret.png"),
    });
    const result = await extract("https://sneaky.test/", { lookup, upstream: site.upstream });

    expect(result.blocked).toContain("http://admin.internal/secret.png");
    expect(result.blocked).toContain("https://admin.internal/direct.png");
    expect(site.requested.some((u) => u.includes(".internal"))).toBe(false);
  });

  it("dismisses a cookie banner before sampling", async () => {
    const page = `<!doctype html><html><body style="background:#fff"><p>Article</p>
      <div id="cookie-notice" style="background:#1e293b;color:#fff">
        <button onclick="this.parentElement.remove()">Reject all</button></div></body></html>`;
    const site = website({ "https://cookies.test/": html(page) });
    const result = await extract("https://cookies.test/", { lookup, upstream: site.upstream });
    expect(result.consent.light).toBe("Reject all");
    expect(result.light.some((s) => s.backgroundColor === "rgb(30, 41, 59)")).toBe(false);
  });

  it("rejects a non-public URL before launching a browser", async () => {
    await expect(extract("http://localhost:3000", { lookup })).rejects.toThrow(/Local host/);
    await expect(extract("http://10.1.2.3/")).rejects.toThrow(/non-public/);
  });
});

describe("fetchGuarded", () => {
  const guard = (url: string) => Promise.resolve(!url.includes(".internal"));
  const get = (url: string): Hop => ({ url, method: "GET", headers: {}, postData: null });

  it("stops after too many redirects", async () => {
    const loop = website({ "https://a.test/": redirect("https://a.test/") });
    expect(await fetchGuarded(get("https://a.test/"), loop.upstream, guard, [])).toBeNull();
    expect(loop.requested).toHaveLength(11);
  });

  it("resolves relative Location headers and switches to GET after a 303", async () => {
    const seen: Hop[] = [];
    const upstream: Upstream = (hop) => {
      seen.push(hop);
      return Promise.resolve(hop.url.endsWith("/form") ? redirect("/done", 303) : html("ok"));
    };
    const result = await fetchGuarded(
      { url: "https://a.test/form", method: "POST", headers: {}, postData: Buffer.from("x=1") },
      upstream,
      guard,
      [],
    );
    expect(result?.url).toBe("https://a.test/done");
    expect(seen[1]).toMatchObject({ method: "GET", postData: null });
  });
});

describe("extract: scroll-triggered content", () => {
  // A section 2400px down only gets its color when it scrolls into view (IntersectionObserver).
  // A single jump from top to bottom never intersects it; scrolling in steps does.
  const REVEAL = `<!doctype html><html><body style="margin:0;background:#fff">
    <p style="height:2400px">Top</p>
    <section id="reveal" style="height:300px"></section>
    <p style="height:3000px">Bottom</p>
    <script>
      new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.style.background = "rgb(37, 99, 235)";
      }).observe(document.getElementById("reveal"));
    </script></body></html>`;

  it("renders content revealed mid-page before sampling", async () => {
    const site = website({ "https://reveal.test/": html(REVEAL) });
    const result = await extract("https://reveal.test/", { lookup, upstream: site.upstream });
    expect(result.light.some((s) => s.backgroundColor === "rgb(37, 99, 235)")).toBe(true);
  });
});
