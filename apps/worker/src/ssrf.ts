import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Resolves a hostname to all of its IP addresses. Injected so tests need no network. */
export type Lookup = (hostname: string) => Promise<string[]>;

/** Thrown when a URL may not be fetched: wrong scheme, credentials, or a non-public address. */
export class BlockedUrlError extends Error {
  override name = "BlockedUrlError";
}

export const systemLookup: Lookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

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

function hostnameOf(url: URL): string {
  return url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Throw a BlockedUrlError unless `raw` is an http(s) URL without credentials whose host
 * resolves only to public addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(raw: string, lookup: Lookup = systemLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Only http and https URLs are allowed, got ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("URLs with credentials are not allowed");
  }

  const host = hostnameOf(url);
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new BlockedUrlError(`Local host not allowed: ${host}`);
  }

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = await lookup(host);
    } catch {
      throw new BlockedUrlError(`Could not resolve ${host}`);
    }
  }
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}`);
  const blocked = addresses.find(isPrivateAddress);
  if (blocked !== undefined) {
    throw new BlockedUrlError(
      isIP(host)
        ? `${host} is a non-public address`
        : `${host} resolves to a non-public address (${blocked})`,
    );
  }
  return url;
}

/**
 * A per-request check for the browser: allows data:/blob: URLs and public http(s) URLs.
 * Results are cached per host so each host is resolved once per extraction.
 */
export function createRequestGuard(
  lookup: Lookup = systemLookup,
): (url: string) => Promise<boolean> {
  const cache = new Map<string, Promise<boolean>>();
  return (raw) => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return Promise.resolve(false);
    }
    if (url.protocol === "data:" || url.protocol === "blob:") return Promise.resolve(true);
    const key = `${url.protocol}//${url.host}`;
    let verdict = cache.get(key);
    if (!verdict) {
      verdict = assertPublicUrl(`${key}/`, lookup).then(
        () => true,
        () => false,
      );
      cache.set(key, verdict);
    }
    return verdict;
  };
}
