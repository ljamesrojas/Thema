// Browser-safe URL rules for Thema's SSRF guard: no Node APIs. assertPublicUrl adds a DNS check
// with the lookup passed in (the worker and the API pass node:dns; tests pass a fake).

/** Thrown when a URL may not be fetched: wrong scheme, credentials, or a non-public address. */
export class BlockedUrlError extends Error {
  override name = "BlockedUrlError";
}

// --- IP literals ----------------------------------------------------------------------------

const V4_PART = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const V4 = new RegExp(`^${V4_PART}(\\.${V4_PART}){3}$`);

/** True when `ip` is a valid IPv6 address (the URL parser validates it; a zone id is ignored). */
function isIPv6(ip: string): boolean {
  if (!ip.includes(":")) return false;
  const address = ip.split("%")[0] ?? "";
  try {
    return new URL(`http://[${address}]/`).hostname.startsWith("[");
  } catch {
    return false;
  }
}

/** 4 for an IPv4 address, 6 for IPv6, 0 otherwise: the same answers as node:net's isIP. */
export function isIP(ip: string): 0 | 4 | 6 {
  if (V4.test(ip)) return 4;
  return isIPv6(ip) ? 6 : 0;
}

// --- address ranges -------------------------------------------------------------------------

/** IPv4 ranges that are private, loopback, link-local, reserved or for documentation. */
const V4_BLOCKED: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
  });
}

/** Expand an IPv6 address (including "::" and a trailing dotted IPv4) to 8 hextets. */
function ipv6Hextets(ip: string): number[] {
  let text = ip.toLowerCase().split("%")[0] ?? ""; // drop a zone id like %eth0
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1]) {
    const v4 = ipv4ToInt(dotted[1]);
    text = `${text.slice(0, dotted.index)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const parse = (part: string) => (part === "" ? [] : part.split(":").map((h) => parseInt(h, 16)));
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  const zeros = new Array<number>(8 - left.length - right.length).fill(0);
  return [...left, ...(tail === undefined ? [] : zeros), ...right];
}

function isBlockedV6(ip: string): boolean {
  const h = ipv6Hextets(ip);
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, last = 0] = h;
  const embeddedV4 = `${g >> 8}.${g & 0xff}.${last >> 8}.${last & 0xff}`;
  const prefixZero = a === 0 && b === 0 && c === 0 && d === 0 && e === 0;

  if (prefixZero && f === 0 && g === 0 && last <= 1) return true; // :: and ::1
  if (prefixZero && f === 0xffff) return isBlockedV4(embeddedV4); // IPv4-mapped
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) {
    return isBlockedV4(embeddedV4); // NAT64
  }
  if ((a & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((a & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((a & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (a === 0x2001 && b === 0x0db8) return true; // documentation 2001:db8::/32
  return false;
}

/** True for any address that isn't publicly routable. Invalid input counts as blocked. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip);
  return true;
}

// --- URLs ---------------------------------------------------------------------------------

/** The URL's host without IPv6 brackets or a trailing dot, lowercased. */
export function hostnameOf(url: URL): string {
  return url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * What people type into a URL box, as a URL: a bare domain ("stripe.com") gets https://, input
 * with "scheme://" is kept as typed. "localhost:3000" has no "//", so it's a host and port, not a
 * "localhost:" scheme. Shared by the web form and the API, so both read input the same way.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export type UrlCheck =
  | {
      ok: true;
      url: URL;
      host: string;
      /** The host is a name, not an IP: a server must still resolve it and check the addresses. */
      needsLookup: boolean;
    }
  | { ok: false; reason: string };

/**
 * Everything about a URL that can be checked without the network: http(s) only, no credentials,
 * no localhost, and an IP-literal host must be public. A host name passes with `needsLookup`;
 * only a server can resolve it (assertPublicUrl below, with a DNS lookup passed in).
 */
export function checkUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `Not a valid URL: ${raw}` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Only http and https URLs are allowed, got ${url.protocol}` };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not allowed" };
  }
  const host = hostnameOf(url);
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: `Local host not allowed: ${host}` };
  }
  if (isIP(host)) {
    return isPrivateAddress(host)
      ? { ok: false, reason: `${host} is a non-public address` }
      : { ok: true, url, host, needsLookup: false };
  }
  return { ok: true, url, host, needsLookup: true };
}

// --- With DNS -------------------------------------------------------------------------------

/**
 * Resolves a hostname to all of its IP addresses. Passed in, so this package stays free of
 * node:dns (it also runs in the browser) and tests need no network.
 */
export type Lookup = (hostname: string) => Promise<string[]>;

/**
 * Throw a BlockedUrlError unless `raw` passes checkUrl and its host resolves only to public
 * addresses. Returns the parsed URL. Used by the worker before loading a page and by the API
 * before enqueueing an extraction.
 */
export async function assertPublicUrl(raw: string, lookup: Lookup): Promise<URL> {
  const check = checkUrl(raw);
  if (!check.ok) throw new BlockedUrlError(check.reason);
  if (!check.needsLookup) return check.url;

  const { host, url } = check;
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new BlockedUrlError(`Could not resolve ${host}`);
  }
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}`);
  const blocked = addresses.find(isPrivateAddress);
  if (blocked !== undefined) {
    throw new BlockedUrlError(`${host} resolves to a non-public address (${blocked})`);
  }
  return url;
}
