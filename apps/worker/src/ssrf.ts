import { lookup as dnsLookup } from "node:dns/promises";
import {
  assertPublicUrl as assertPublicUrlWith,
  BlockedUrlError,
  isPrivateAddress,
  type Lookup,
} from "@thema/url-guard";

export { BlockedUrlError, isPrivateAddress, type Lookup };

export const systemLookup: Lookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/** The shared SSRF check (@thema/url-guard) with the system resolver by default. */
export function assertPublicUrl(raw: string, lookup: Lookup = systemLookup): Promise<URL> {
  return assertPublicUrlWith(raw, lookup);
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
