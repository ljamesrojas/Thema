import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Browser tests launch Chromium; give them room on slow machines.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
