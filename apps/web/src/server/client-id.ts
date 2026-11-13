import { createHash } from "node:crypto";

/**
 * Who an anonymous request counts against for the daily limit: a hash of the client's IP, so the
 * address itself is never stored. The IP comes from `x-forwarded-for` (first entry), which Vercel
 * sets; behind another host, make sure its proxy overwrites that header, or clients can pick
 * their own bucket.
 */
export function clientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`thema-anonymous:${ip}`).digest("hex").slice(0, 32);
}
