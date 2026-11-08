import { describe, expect, it } from "vitest";
import { canvasFlipsInDark } from "../src/dark.js";
import { sample } from "./helpers.js";

const page = (backgroundColor: string) => [
  sample({ tag: "html", role: "container", area: 1_000_000, backgroundColor }),
  sample({ tag: "p", area: 10_000, color: "#777777" }),
];

describe("canvasFlipsInDark", () => {
  it("is true when a light canvas turns dark", () => {
    expect(canvasFlipsInDark(page("#ffffff"), page("#0a0a0a"))).toBe(true);
    expect(canvasFlipsInDark(page("#faf6ee"), page("#1c1917"))).toBe(true);
  });

  it("is false when the site ignores the dark preference", () => {
    expect(canvasFlipsInDark(page("#ffffff"), page("#ffffff"))).toBe(false);
  });

  it("is false for a site that is dark in both passes", () => {
    expect(canvasFlipsInDark(page("#0a0a0a"), page("#0a0a0a"))).toBe(false);
  });

  it("is false when either pass has no canvas", () => {
    expect(canvasFlipsInDark([], page("#0a0a0a"))).toBe(false);
    expect(canvasFlipsInDark(page("#ffffff"), [])).toBe(false);
  });
});
