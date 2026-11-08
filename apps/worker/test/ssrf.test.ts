import { describe, expect, it } from "vitest";
import {
  assertPublicUrl,
  BlockedUrlError,
  createRequestGuard,
  isPrivateAddress,
  type Lookup,
} from "../src/ssrf.js";

/** A fake DNS: known hosts resolve to the given addresses, others fail. */
const fakeDns =
  (table: Record<string, string[]>): Lookup =>
  (host) => {
    const found = table[host];
    return found ? Promise.resolve(found) : Promise.reject(new Error("ENOTFOUND"));
  };

describe("isPrivateAddress: IPv4", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.5",
    "100.64.1.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "93.184.215.14",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "1.1.1.1",
  ])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("isPrivateAddress: IPv6", () => {
  it.each([
    "::",
    "::1",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::10.0.0.1",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["2606:4700:4700::1111", "2a00:1450:4001:82a::200e", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it("treats invalid input as blocked", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  const dns = fakeDns({
    "example.com": ["93.184.215.14"],
    "internal.corp": ["10.0.0.5"],
    "mixed.example": ["93.184.215.14", "192.168.0.10"],
    "rebind.example": ["127.0.0.1"],
  });

  it("allows a public http(s) URL", async () => {
    await expect(assertPublicUrl("https://example.com/pricing", dns)).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("http://example.com", dns)).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ["file:///C:/Windows/win.ini", /Only http and https/],
    ["ftp://example.com", /Only http and https/],
    ["javascript:alert(1)", /Only http and https/],
    ["not a url", /Not a valid URL/],
    ["https://user:pass@example.com", /credentials/],
    ["http://localhost:3000", /Local host/],
    ["http://LOCALHOST.", /Local host/],
    ["http://app.localhost", /Local host/],
    ["http://127.0.0.1:8080", /non-public/],
    ["http://[::1]/", /non-public/],
    ["http://169.254.169.254/latest/meta-data", /non-public/],
    ["http://internal.corp", /non-public.*10\.0\.0\.5/],
    ["http://mixed.example", /non-public.*192\.168\.0\.10/],
    ["http://unknown.example", /Could not resolve/],
  ])("blocks %s", async (url, message) => {
    const result = assertPublicUrl(url, dns);
    await expect(result).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(result).rejects.toThrow(message);
  });
});

describe("createRequestGuard", () => {
  it("allows public hosts and data URLs, blocks private ones", async () => {
    const guard = createRequestGuard(
      fakeDns({ "cdn.example": ["93.184.215.14"], "evil.example": ["10.1.2.3"] }),
    );
    expect(await guard("https://cdn.example/app.css")).toBe(true);
    expect(await guard("data:image/png;base64,AAAA")).toBe(true);
    expect(await guard("http://evil.example/admin")).toBe(false);
    expect(await guard("http://127.0.0.1/")).toBe(false);
    expect(await guard("::garbage::")).toBe(false);
  });

  it("resolves each host once", async () => {
    let calls = 0;
    const guard = createRequestGuard((host) => {
      calls++;
      return host === "cdn.example"
        ? Promise.resolve(["93.184.215.14"])
        : Promise.reject(new Error("x"));
    });
    await Promise.all([guard("https://cdn.example/a.js"), guard("https://cdn.example/b.js")]);
    await guard("https://cdn.example/c.png");
    expect(calls).toBe(1);
  });
});
