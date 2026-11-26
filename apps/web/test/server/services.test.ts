// @vitest-environment node
// Which extraction setup the environment picks: a worker server, serverless (Vercel alone) or
// in-process. Serverless mode is opt-in, so removing THEMA_EXTRACTION is the off switch.
import { describe, expect, it } from "vitest";
import { DAILY_TOTAL, extractionMode } from "@/server/services";

const DATABASE_URL = "postgres://user:password@db.example/thema";

describe("extractionMode", () => {
  it("runs in-process when nothing is set (development)", () => {
    expect(extractionMode({})).toBe("local");
    expect(extractionMode({ DATABASE_URL })).toBe("local");
  });

  it("uses serverless mode only when asked, and needs the database for it", () => {
    expect(extractionMode({ THEMA_EXTRACTION: "serverless", DATABASE_URL })).toBe("serverless");
    expect(() => extractionMode({ THEMA_EXTRACTION: "serverless" })).toThrow(/DATABASE_URL/);
    expect(extractionMode({ THEMA_EXTRACTION: "on", DATABASE_URL })).toBe("local");
  });

  it("prefers a worker server when REDIS_URL is set", () => {
    expect(
      extractionMode({ REDIS_URL: "rediss://x", THEMA_EXTRACTION: "serverless", DATABASE_URL }),
    ).toBe("redis");
  });

  it("caps serverless mode at 20 new sites a day by default", () => {
    expect(DAILY_TOTAL).toBe(20);
  });
});
