// The fence around the browser, beyond the per-request URL guard (ssrf.test.ts): the fetch that
// checks the address it connects to (DNS rebinding), and the context's WebSocket and WebRTC
// blocks. Local servers only; nothing here leaves the machine.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fenceContext, FENCE_ARGS } from "../src/extract.js";
import { BlockedUrlError, type Lookup } from "../src/ssrf.js";
import { nodeUpstream } from "../src/upstream.js";

let server: Server;
let port = 0;
let upgrades = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/gzip") {
      response.writeHead(200, { "content-type": "text/css", "content-encoding": "gzip" });
      response.end(gzipSync("body { color: red }"));
      return;
    }
    if (request.url === "/redirect") {
      response.writeHead(302, { location: "http://127.0.0.1/" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html",
      "set-cookie": ["a=1; Path=/", "b=2; Path=/"],
    });
    response.end(`<p>cookie:${request.headers.cookie ?? ""}</p>`);
  });
  // Any WebSocket that gets past the fence shows up here.
  server.on("upgrade", (_request, socket) => {
    upgrades += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** site.test resolves to the local server. */
const lookup: Lookup = (host) =>
  host === "site.test" ? Promise.resolve(["127.0.0.1"]) : Promise.reject(new Error("ENOTFOUND"));
const hop = (path: string) => ({
  url: `http://site.test:${port}${path}`,
  method: "GET",
  headers: { cookie: "theme=dark" },
  postData: null,
});

describe("nodeUpstream", () => {
  it("refuses to connect when the name resolves to a private address (DNS rebinding)", async () => {
    // The URL guard checked this name earlier and saw a public address; now it answers 127.0.0.1.
    const upstream = nodeUpstream({ lookup });
    await expect(upstream(hop("/"))).rejects.toThrow(BlockedUrlError);
    await expect(upstream(hop("/"))).rejects.toThrow(/non-public/);
  });

  it("refuses a name that resolves to public and private addresses alike", async () => {
    const mixed: Lookup = () => Promise.resolve(["93.184.215.14", "169.254.169.254"]);
    await expect(nodeUpstream({ lookup: mixed })(hop("/"))).rejects.toThrow(BlockedUrlError);
  });

  it("fetches, forwards the browser's cookies, keeps every Set-Cookie and decodes gzip", async () => {
    const upstream = nodeUpstream({ lookup, allowed: () => true });
    const page = await upstream(hop("/"));
    expect(page.status).toBe(200);
    expect(String(page.body)).toBe("<p>cookie:theme=dark</p>");
    expect(page.headers["set-cookie"]).toBe("a=1; Path=/\nb=2; Path=/");

    const css = await upstream(hop("/gzip"));
    expect(String(css.body)).toBe("body { color: red }");
  });

  it("doesn't follow redirects (fetchGuarded checks each hop itself)", async () => {
    const response = await nodeUpstream({ lookup, allowed: () => true })(hop("/redirect"));
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://127.0.0.1/");
  });

  it("only fetches http and https", async () => {
    const upstream = nodeUpstream({ lookup, allowed: () => true });
    await expect(upstream({ ...hop("/"), url: "file:///etc/passwd" })).rejects.toThrow(/file:/);
  });
});

describe("fenceContext", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ args: FENCE_ARGS });
  });
  afterAll(() => browser.close());

  it("closes WebSockets before they connect and removes WebRTC from the page", async () => {
    const context = await browser.newContext();
    await fenceContext(context);
    const page = await context.newPage();
    await page.setContent("<p>fenced</p>");
    const result = await page.evaluate(
      (wsPort) =>
        new Promise<{ ws: string; rtc: string[] }>((resolve) => {
          const rtc = ["RTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel"].map(
            (name) => typeof (window as unknown as Record<string, unknown>)[name],
          );
          const socket = new WebSocket(`ws://127.0.0.1:${wsPort}/`);
          socket.onopen = () => resolve({ ws: "open", rtc });
          socket.onclose = (event) => resolve({ ws: `closed ${event.code}`, rtc });
        }),
      port,
    );
    await context.close();
    expect(result.rtc).toEqual(["undefined", "undefined", "undefined"]);
    expect(result.ws).not.toBe("open");
    expect(upgrades).toBe(0);
  });
});
