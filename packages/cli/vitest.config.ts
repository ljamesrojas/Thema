import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // One test runs the real `thema` binary in a subprocess (tsx start-up).
    testTimeout: 30_000,
  },
});
