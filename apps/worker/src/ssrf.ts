import { lookup as dnsLookup } from "node:dns/promises";
import { BlockedUrlError, checkUrl, isPrivateAddress } from "@thema/url-guard";

/** Resolves a hostname to all of its IP addresses. Injected so tests need no network. */
export type Lookup = (hostname: string) => Promise<string[]>;

export { BlockedUrlError, isPrivateAddress };

export const systemLookup: Lookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Throw a BlockedUrlError unless `raw` is an http(s) URL without credentials whose host
 * resolves only to public addresses. Returns the parsed URL. The network-free rules live in
 * @thema/url-guard (shared with the browser); this adds the DNS lookup.
 */
export async function assertPublicUrl(raw: string, lookup: Lookup = systemLookup): Promise<URL> {
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
