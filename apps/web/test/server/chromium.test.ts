// @vitest-environment node
// Serverless mode's Chromium flags: the package's own, minus the ones that weaken the browser's
// protections, plus the worker's fence.
import chromium from "@sparticuz/chromium";
import { describe, expect, it } from "vitest";
import { serverlessArgs, UNSAFE_ARGS } from "@/server/chromium";

describe("serverlessArgs", () => {
  it("drops the package's unsafe defaults and adds the fence's", () => {
    chromium.setGraphicsMode = false;
    const packageArgs = chromium.args;
    // The package really does ship these (if a release stops, this test says so).
    for (const flag of UNSAFE_ARGS) expect(packageArgs).toContain(flag);
    expect(packageArgs).toContain("--disable-webgl");

    const args = serverlessArgs(packageArgs, ["--force-webrtc-ip-handling-policy=x"]);
    for (const flag of UNSAFE_ARGS) expect(args).not.toContain(flag);
    expect(args).toContain("--no-sandbox");
    expect(args).toContain("--disable-webgl");
    expect(args.at(-1)).toBe("--force-webrtc-ip-handling-policy=x");
  });
});
