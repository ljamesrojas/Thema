import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Landing } from "@/components/landing";
import { heroBlend } from "@/lib/hero-blend";
import { toHex } from "@thema/exporters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

describe("Landing", () => {
  it("has no axe violations (contrast is checked from DESIGN.md's ratios: jsdom applies no CSS)", async () => {
    const { container } = render(<Landing blend={heroBlend()} />);
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("has one h1 and the mockup's sections", () => {
    render(<Landing blend={heroBlend()} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of [
      /Three steps from/,
      /Borrowed colors that/,
      /One system/,
      /Or let your agent/,
      /Your agent has/,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  });

  it("names no real site: the hero's references are .example domains", () => {
    const { container } = render(<Landing blend={heroBlend()} />);
    const domains = container.textContent?.match(/\b[a-z0-9-]+\.(com|io|app|dev|co)\b/g) ?? [];
    expect(domains).toEqual(["example.com"].filter((d) => container.textContent?.includes(d)));
  });
});

describe("heroBlend: computed by the real pipeline", () => {
  const blend = heroBlend();

  it("backs the 'WCAG AA · N/N pairs' claim: every checked pair passes in both themes", () => {
    expect(blend.passing.light).toBe(blend.passing.total);
    expect(blend.passing.dark).toBe(blend.passing.total);
    expect(blend.passing.total).toBe(12);
  });

  it("shows chips with the hex the exporters produce, and is the same on every call", () => {
    for (const chip of blend.chips) expect(chip.hex).toBe(toHex(chip.color));
    expect(heroBlend()).toEqual(blend);
  });
});
