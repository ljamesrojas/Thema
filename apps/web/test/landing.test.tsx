import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENTS } from "@/components/agents-strip";
import { QUESTIONS } from "@/components/faq";
import { Landing } from "@/components/landing";
import { heroBlend } from "@/lib/hero-blend";
import { toHex } from "@thema/exporters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const renderLanding = () => render(<Landing blend={heroBlend()} />);

describe("Landing (docs/landing-white.md)", () => {
  it("has no axe violations (contrast is checked from DESIGN.md's ratios: jsdom applies no CSS)", async () => {
    const { container } = renderLanding();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("has the sections in the approved order", () => {
    const { container } = renderLanding();
    const sections = [...container.querySelectorAll("main > section")].map(
      (section) => section.id || section.getAttribute("aria-label"),
    );
    // #try (the interactive demo) is left out until its section is specified.
    expect(sections).toEqual([
      "top",
      "Reads into",
      "how",
      "exports",
      "fixed",
      "agents",
      "faq",
      "start",
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of [
      "From inspiration to instructions, in four steps.",
      "Measured, not guessed.",
      "Borrowed colors that pass, every time.",
      "Made for your agent.",
      "Questions, answered.",
      "Your agent has taste now.",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(container.querySelector("footer")?.textContent).toContain("Inspired by, never cloned.");
  });

  it("has four steps: Paste, Borrow, Fix, Export", () => {
    const { container } = renderLanding();
    const how = container.querySelector("#how");
    if (!(how instanceof HTMLElement)) throw new Error("no #how");
    const steps = within(how)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(steps).toEqual(["Step 01: Paste", "Step 02: Borrow", "Step 03: Fix", "Step 04: Export"]);
  });

  it("names no real site: the hero's references are .example domains", () => {
    const { container } = renderLanding();
    const domains = container.textContent?.match(/\b[a-z0-9-]+\.(com|io|app|dev|co)\b/g) ?? [];
    expect(domains).toEqual([]);
  });
});

describe("Agents strip", () => {
  it("is 7 real links to #agents with accessible names, an accent each, and hidden icons", () => {
    renderLanding();
    const strip = screen.getByRole("region", { name: "Reads into" });
    const links = within(strip).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Claude Code",
      "Cursor",
      "v0",
      "Lovable",
      "Windsurf",
      "GitHub Copilot",
      "Google Stitch",
    ]);
    links.forEach((link, index) => {
      expect(link.getAttribute("href")).toBe("#agents");
      expect(link.tagName).toBe("A");
      expect(link.style.getPropertyValue("--agent-color")).toBe(
        `var(--color-${AGENTS[index]?.color ?? ""})`,
      );
      expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("uses only DESIGN.md's agent tokens", () => {
    const design = readFileSync(join(import.meta.dirname, "../../../DESIGN.md"), "utf8");
    for (const { color } of AGENTS) expect(design).toMatch(new RegExp(`\\n  ${color}: "#`));
  });

  it("does it in CSS only: hover behind (hover: hover), reduced motion, 44px targets, no hex", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../src/components/agents-strip.module.css"),
      "utf8",
    );
    expect(css).toMatch(/@media \(hover: hover\)\s*\{[^@]*\.item:hover[^@]*:has\(\.item:hover\)/);
    expect(css).toMatch(
      /:has\(\.item:focus-visible\) \.item:not\(:focus-visible\)\s*\{\s*opacity: 0\.35/,
    );
    expect(css).toMatch(/transform: scale\(1\.14\)/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: none[\s\S]*animation: none/,
    );
    expect(css).toMatch(/min-height: 44px/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("FAQ", () => {
  const questions = () => {
    const faq = document.querySelector("#faq");
    if (!(faq instanceof HTMLElement)) throw new Error("no #faq");
    return within(faq).getAllByRole("button", { expanded: undefined });
  };
  const expanded = () =>
    questions()
      .filter((b) => b.hasAttribute("aria-expanded"))
      .map((b) => b.getAttribute("aria-expanded") === "true");
  const faqButtons = () => questions().filter((b) => b.hasAttribute("aria-expanded"));
  const panelOf = (button: HTMLElement) => {
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    if (!panel) throw new Error("no panel");
    return panel;
  };

  it("has 5 questions as real buttons, numbered 01–05, the first open by default", () => {
    renderLanding();
    const buttons = faqButtons();
    expect(buttons.map((b) => b.tagName)).toEqual(Array(5).fill("BUTTON"));
    expect(buttons.map((b) => b.textContent?.slice(0, 2))).toEqual(["01", "02", "03", "04", "05"]);
    expect(buttons.map((b) => b.textContent)).toEqual(
      QUESTIONS.map(([q], i) => `0${i + 1}${q}${i === 0 ? "−" : "+"}`),
    );
    expect(expanded()).toEqual([true, false, false, false, false]);
    const [first, second] = buttons;
    if (!first || !second) throw new Error("missing buttons");
    expect(panelOf(first).hidden).toBe(false);
    expect(panelOf(second).hidden).toBe(true);
    expect(panelOf(first).getAttribute("aria-labelledby")).toBe(first.id);
  });

  it("keeps one item open at a time, and the open number turns Kiln Deep", () => {
    renderLanding();
    const third = faqButtons()[2];
    if (!third) throw new Error("no third question");
    fireEvent.click(third);
    expect(expanded()).toEqual([false, false, true, false, false]);
    expect(faqButtons().map((b) => panelOf(b).hidden)).toEqual([true, true, false, true, true]);
    const number = (button: HTMLElement | undefined) => button?.querySelector("span");
    expect(number(faqButtons()[2])?.className).toContain("text-primary-strong");
    expect(number(faqButtons()[0])?.className).toContain("text-ink-subtle");

    const fifth = faqButtons()[4];
    if (!fifth) throw new Error("no fifth question");
    fireEvent.click(fifth);
    expect(expanded()).toEqual([false, false, false, false, true]);

    // Clicking the open question closes it; never more than one open.
    fireEvent.click(fifth);
    expect(expanded()).toEqual([false, false, false, false, false]);
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

  it("feeds Feature 01 with values measured on the first reference", () => {
    expect(blend.measured.source).toBe("north.example");
    expect(blend.measured.rows.map(([key]) => key)).toEqual([
      "color.canvas",
      "color.ink",
      "color.primary",
      "font.sans",
      "spacing.base",
      "radius.md",
      "contrast",
    ]);
    expect(blend.measured.rows.at(-1)?.[1]).toBe(`${blend.fixes.length} pairs fixed → AA`);
  });
});
