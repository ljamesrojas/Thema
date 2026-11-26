// The network side of the browser's requests: every request Chromium makes is routed here (see
// extract.ts), and the SSRF guard has already checked its URL. This fetch checks again at the
// moment it connects: the DNS answer it actually connects to must be public. A second lookup can
// answer differently from the guard's (DNS rebinding: public first, then 127.0.0.1), so checking
// only before the request isn't enough, least of all on a serverless host, where the platform's
// own services listen on localhost next to the browser.
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { BlockedUrlError, isPrivateAddress, systemLookup, type Lookup } from "./ssrf.js";
import type { Upstream, UpstreamResponse } from "./extract.js";

/** The largest response body passed to the browser. */
export const MAX_BODY_BYTES = 25 * 1024 * 1024;

const decoders: Record<string, (body: Buffer) => Promise<Buffer>> = {
  gzip: promisify(zlib.gunzip),
  "x-gzip": promisify(zlib.gunzip),
  br: promisify(zlib.brotliDecompress),
  deflate: (body) => promisify(zlib.inflate)(body).catch(() => promisify(zlib.inflateRaw)(body)),
};

/**
 * Node's `lookup` for a socket, refusing every name that resolves to a non-public address. The
 * socket connects to the address checked here, so nothing can change between check and connect.
 */
export function guardedLookup(
  lookup: Lookup = systemLookup,
  allowed: (address: string) => boolean = (address) => !isPrivateAddress(address),
): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname)
      .then((addresses) => {
        const blocked = addresses.find((address) => !allowed(address));
        if (addresses.length === 0 || blocked !== undefined) {
          throw new BlockedUrlError(`${hostname} resolves to a non-public address`);
        }
        const all = addresses.map((address) => ({ address, family: isIP(address) || 4 }));
        if (options.all) callback(null, all);
        else callback(null, all[0]?.address ?? "", all[0]?.family ?? 4);
      })
      .catch((error: unknown) => {
        callback(error instanceof Error ? error : new Error(String(error)), "", 4);
      });
  };
}

function flatHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    // Several Set-Cookie headers travel as lines, the way Playwright's fulfill reads them.
    headers[name] = Array.isArray(value) ? value.join(name === "set-cookie" ? "\n" : ", ") : value;
  }
  return headers;
}

/**
 * One HTTP(S) request with Node, without following redirects (fetchGuarded follows them, checking
 * each hop), connecting only to public addresses. Compressed bodies are decoded, since the browser
 * gets the body as it is.
 */
export function nodeUpstream(
  options: {
    lookup?: Lookup;
    timeoutMs?: number;
    /** Tests only: which resolved addresses may be connected to. */
    allowed?: (address: string) => boolean;
  } = {},
): Upstream {
  const { timeoutMs = 30_000 } = options;
  const lookup = guardedLookup(options.lookup, options.allowed);
  return (hop) =>
    new Promise<UpstreamResponse>((resolve, reject) => {
      const url = new URL(hop.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        reject(new Error(`Not fetched: ${url.protocol} URL`));
        return;
      }
      const client = url.protocol === "https:" ? https : http;
      const headers: Record<string, string> = {
        ...hop.headers,
        "accept-encoding": "gzip, deflate, br",
      };
      if (hop.postData) headers["content-length"] = String(hop.postData.length);
      const request = client.request(url, {
        method: hop.method,
        headers,
        lookup,
        timeout: timeoutMs,
        agent: false,
      });
      request.on("timeout", () => request.destroy(new Error(`Timed out after ${timeoutMs} ms`)));
      request.on("error", reject);
      request.on("response", (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            request.destroy(new Error(`Response over ${MAX_BODY_BYTES} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          const body = Buffer.concat(chunks);
          const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
          const decode = decoders[encoding];
          (decode && body.length > 0 ? decode(body) : Promise.resolve(body))
            .then((decoded) =>
              resolve({
                status: response.statusCode ?? 502,
                headers: flatHeaders(response.headers),
                body: decoded,
              }),
            )
            .catch(reject);
        });
      });
      request.end(hop.postData ?? undefined);
    });
}
