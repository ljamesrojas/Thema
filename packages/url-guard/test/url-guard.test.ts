import { isIP as nodeIsIP } from "node:net";
import { describe, expect, it } from "vitest";
import {
  assertPublicUrl,
  BlockedUrlError,
  checkUrl,
  isIP,
  isPrivateAddress,
  normalizeUrl,
  type Lookup,
} from "../src/index.js";

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

describe("normalizeUrl", () => {
  it("adds https:// to a bare domain and keeps scheme:// input as typed", () => {
    expect(normalizeUrl("  stripe.com/pricing ")).toBe("https://stripe.com/pricing");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("ftp://example.com")).toBe("ftp://example.com");
    // A host and port, not a "localhost:" scheme, so checkUrl reports it as a local host.
    expect(normalizeUrl("localhost:3000")).toBe("https://localhost:3000");
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

describe("assertPublicUrl", () => {
  const dns: Lookup = (host) => {
    const table: Record<string, string[]> = {
      "example.com": ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"],
      "sneaky.example": ["93.184.215.14", "10.0.0.7"],
      "empty.example": [],
    };
    const found = table[host];
    return found ? Promise.resolve(found) : Promise.reject(new Error("ENOTFOUND"));
  };

  it("passes a host that resolves only to public addresses", async () => {
    const url = await assertPublicUrl("https://example.com/pricing", dns);
    expect(url.href).toBe("https://example.com/pricing");
  });

  it("blocks a host with any private address", async () => {
    await expect(assertPublicUrl("https://sneaky.example/", dns)).rejects.toThrow(
      /non-public address \(10\.0\.0\.7\)/,
    );
  });

  it("blocks hosts that don't resolve or resolve to nothing", async () => {
    await expect(assertPublicUrl("https://nowhere.example/", dns)).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    await expect(assertPublicUrl("https://empty.example/", dns)).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("applies the network-free rules first, without a lookup", async () => {
    const never: Lookup = () => Promise.reject(new Error("should not be called"));
    await expect(assertPublicUrl("http://localhost:3000", never)).rejects.toThrow(/Local host/);
    await expect(assertPublicUrl("http://10.0.0.1/", never)).rejects.toThrow(/non-public/);
    await expect(assertPublicUrl("http://8.8.8.8/", never)).resolves.toBeInstanceOf(URL);
  });
});
