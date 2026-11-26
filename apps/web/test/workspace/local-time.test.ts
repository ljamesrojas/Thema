import { describe, expect, it } from "vitest";
import { localTime, withLocalTimes } from "@/lib/local-time";

const manila = { locale: "en-US", timeZone: "Asia/Manila" };

describe("withLocalTimes", () => {
  it("shows the daily limit's reset in the reader's own time", () => {
    const message =
      "Without an account you get 3; sign in for more new extractions a day. Sites already extracted today still work. The limit resets at 2026-11-27T00:00:00.000Z.";
    // 11 PM on Nov 26 in Manila: UTC midnight is 8 AM there the next day.
    expect(withLocalTimes(message, new Date("2026-11-26T15:00:00.000Z"), manila)).toBe(
      "Without an account you get 3; sign in for more new extractions a day. Sites already extracted today still work. The limit resets at 8:00 AM tomorrow (your time).",
    );
  });

  it("says today, tomorrow, or the date", () => {
    const reset = new Date("2026-11-27T00:00:00.000Z");
    // 4 AM on Nov 27 in Manila: the reset is later the same day.
    expect(localTime(reset, new Date("2026-11-26T20:00:00.000Z"), manila)).toBe("8:00 AM today");
    expect(localTime(reset, new Date("2026-11-26T10:00:00.000Z"), manila)).toBe("8:00 AM tomorrow");
    expect(
      localTime(reset, new Date("2026-11-26T10:00:00.000Z"), { locale: "en-US", timeZone: "UTC" }),
    ).toBe("12:00 AM tomorrow");
    expect(
      localTime(new Date("2026-11-30T00:00:00.000Z"), new Date("2026-11-26T10:00:00.000Z"), manila),
    ).toBe("8:00 AM on Nov 30");
  });

  it("leaves messages without a timestamp alone", () => {
    expect(withLocalTimes("Can't reach Thema. Check your connection and try again.")).toBe(
      "Can't reach Thema. Check your connection and try again.",
    );
  });
});
