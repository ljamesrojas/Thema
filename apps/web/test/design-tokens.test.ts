import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chipTextColor } from "@/components/paint-chip";
import { generateTokensCss, TOKENS_CSS } from "../scripts/tokens";

const SRC = join(import.meta.dirname, "../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("tokens from DESIGN.md", () => {
  it("tokens.generated.css is up to date (run `pnpm --filter @thema/web tokens`)", () => {
    expect(readFileSync(TOKENS_CSS, "utf8")).toBe(generateTokensCss());
  });

  it("has every DESIGN.md color, including the ink-soft tokens, and per-style line heights", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    for (const name of [
      "canvas",
      "surface",
      "hairline",
      "stage",
      "ink",
      "ink-soft",
      "ink-muted",
      "primary",
      "primary-strong",
      "dark-ink-soft",
    ]) {
      expect(css, name).toMatch(new RegExp(`--color-${name}: #[0-9a-f]{6};`));
    }
    expect(css).toContain("--text-display--line-height: 0.98;");
    expect(css).not.toMatch(/--font-weight-/);
  });

  it("no hex literal anywhere in the app's source (DESIGN.md: never hardcode hex)", () => {
    const offenders = files(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("tokens.generated.css"))
      .flatMap((f) =>
        (readFileSync(f, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((hex) => `${f}: ${hex}`),
      );
    expect(offenders).toEqual([]);
  });
});

describe("chipTextColor", () => {
  it("picks whichever of white or the system's ink reads better on the chip", () => {
    expect(chipTextColor("oklch(0.3 0.1 260)", "oklch(0.2 0 0)")).toBe("white");
    expect(chipTextColor("oklch(0.97 0.01 90)", "oklch(0.2 0 0)")).toBe("oklch(0.2 0 0)");
  });
});
