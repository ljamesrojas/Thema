import { isIP as nodeIsIP } from "node:net";
import { describe, expect, it } from "vitest";
import { checkUrl, isIP, isPrivateAddress } from "../src/index.js";

describe("isIP", () => {
  it("matches node:net's isIP on a varied list, without needing Node", () => {
    const inputs = [
      "1.2.3.4",
      "255.255.255.255",
      "0.0.0.0",
      "256.1.1.1",
      "01.2.3.4",
      "1.2.3",
      "1.2.3.4.5",
      "a.b.c.d",
      "::",
      "::1",
      "2001:db8::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "64:ff9b::192.0.2.1",
      "1:2:3:4:5:6:7:8",
      "1:2:3:4:5:6:7:8:9",
      "gggg::1",
      ":::",
      "example.com",
      "",
    ];
    for (const ip of inputs) expect(isIP(ip), ip).toBe(nodeIsIP(ip));
  });
});

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local, metadata and mapped addresses", () => {
    for (const ip of [
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "::1",
      "fc00::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses and blocks invalid input", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
    expect(isPrivateAddress("not an ip")).toBe(true);
  });
});

describe("checkUrl (no network: what a browser can check)", () => {
  it("accepts a public http(s) URL and says whether the host still needs resolving", () => {
    expect(checkUrl("https://stripe.com/")).toMatchObject({
      ok: true,
      host: "stripe.com",
      needsLookup: true,
    });
    expect(checkUrl("http://93.184.216.34/")).toMatchObject({ ok: true, needsLookup: false });
  });

  it.each([
    ["not a url", "Not a valid URL"],
    ["ftp://example.com/", "Only http and https"],
    ["javascript:alert(1)", "Only http and https"],
    ["https://user:pass@example.com/", "credentials"],
    ["http://localhost:3000/", "Local host"],
    ["http://app.localhost/", "Local host"],
    ["http://127.0.0.1/", "non-public address"],
    ["http://[::1]/", "non-public address"],
    ["http://169.254.169.254/latest/meta-data/", "non-public address"],
    ["http://0x7f.1/", "non-public address"], // the URL parser normalizes this to 127.0.0.1
  ])("rejects %s", (raw, reason) => {
    const result = checkUrl(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });
});
