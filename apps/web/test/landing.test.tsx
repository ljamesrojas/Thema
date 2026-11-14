import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENTS } from "@/components/agents-strip";
import { QUESTIONS } from "@/components/faq";
import { Landing } from "@/components/landing";
import { heroBlend } from "@/lib/hero-blend";
import type { StyleSample } from "@thema/engine";
import { toHex } from "@thema/exporters";
import lightSaas from "../../../fixtures/light-saas/samples.json";

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
    expect(sections).toEqual([
      "top",
      "Reads into",
      "try",
      "how",
      "exports",
      "fixed",
      "agents",
      "faq",
      "start",
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of [
      "Borrow it. Blend it. Ship it.",
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
      "Google Antigravity",
    ]);
    links.forEach((link, index) => {
      expect(link.getAttribute("href")).toBe("#agents");
      expect(link.tagName).toBe("A");
      expect(link.style.getPropertyValue("--agent-color")).toBe(
        `var(--color-${AGENTS[index]?.color ?? ""})`,
      );
      // The official logo (decorative: the name labels the link), or a hidden generic icon.
      const logo = link.querySelector("img");
      if (AGENTS[index]?.logo) {
        expect(logo?.getAttribute("src")).toBe(AGENTS[index]?.logo);
        expect(logo?.getAttribute("alt")).toBe("");
      } else {
        expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      }
    });
  });

  it("serves each official logo from public/agents, unscripted, and never grays or recolors it", () => {
    const withLogos = AGENTS.filter((agent) => agent.logo);
    expect(withLogos.map((a) => a.name)).toEqual([
      "Claude Code",
      "Cursor",
      "v0",
      "Lovable",
      "Windsurf",
      "GitHub Copilot",
      "Google Stitch",
      "Google Antigravity",
    ]);
    for (const { logo } of withLogos) {
      const svg = readFileSync(join(import.meta.dirname, "../public", logo ?? ""), "utf8");
      expect(svg).toMatch(/^<svg [^>]*viewBox="[\d. ]+"/);
      // Safe as an <img>: no script, no event handlers, no links or external references.
      expect(svg).not.toMatch(/<script|<foreignObject|href|\son\w+=|url\((?!#)/i);
    }
    const css = readFileSync(
      join(import.meta.dirname, "../src/components/agents-strip.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/grayscale|filter/);
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

  it("has 5 questions as real buttons, numbered 01–05, all closed at first", () => {
    renderLanding();
    const buttons = faqButtons();
    expect(buttons.map((b) => b.tagName)).toEqual(Array(5).fill("BUTTON"));
    expect(buttons.map((b) => b.textContent?.slice(0, 2))).toEqual(["01", "02", "03", "04", "05"]);
    expect(buttons.map((b) => b.textContent)).toEqual(QUESTIONS.map(([q], i) => `0${i + 1}${q}+`));
    expect(expanded()).toEqual([false, false, false, false, false]);
    expect(buttons.map((b) => panelOf(b).hidden)).toEqual(Array(5).fill(true));
    const [first] = buttons;
    if (!first) throw new Error("missing buttons");
    expect(panelOf(first).getAttribute("aria-labelledby")).toBe(first.id);
    fireEvent.click(first);
    expect(expanded()).toEqual([true, false, false, false, false]);
    expect(panelOf(first).hidden).toBe(false);
  });

  it("lays out as docs/landing-white.md says: 5/7 grid, 'Still curious?' with no card", () => {
    renderLanding();
    const grid = document.querySelector("#faq > div");
    expect(grid?.className).toContain("min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]");
    expect(grid?.className).toContain("min-[900px]:gap-16");
    const curious = screen.getByTestId("faq-still-curious");
    expect(curious.textContent).toContain("Still curious?");
    expect(curious.className).toContain("border-t");
    // Not inside a card: the accordion is the section's only card.
    expect(curious.closest(".rounded-lg")).toBeNull();
    expect(
      within(curious)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Read the docs", "Ask on GitHub"]);
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
    expect(blend.passing.total).toBe(13);
  });

  it("shows chips with the hex the exporters produce, and is the same on every call", () => {
    for (const chip of blend.chips) expect(chip.hex).toBe(toHex(chip.color));
    expect(heroBlend()).toEqual(blend);
  });

  it("feeds Feature 01 with what the browser recorded on the first sample site", () => {
    const samples = lightSaas as StyleSample[];
    const button = samples.find(
      (s) => s.tag === "button" && s.backgroundColor !== "rgba(0, 0, 0, 0)",
    );
    const h1 = samples.find((s) => s.tag === "h1");
    const section = samples.find((s) => s.tag === "section" && s.padding[0] > 0);
    if (!button || !h1 || !section) throw new Error("fixture changed");
    expect(blend.read.source).toBe("north.example");
    expect(blend.read.rows).toEqual([
      ["button", `background ${toHex(button.backgroundColor)}`],
      ["h1", `Inter · ${h1.fontSize}px · ${h1.fontWeight}`],
      ["section", `padding ${section.padding[0]}px ${section.padding[1]}px`],
    ]);
    const north = blend.sites[0]?.system;
    expect(blend.read.result).toBe(
      `primary ${toHex(north?.color.light.primary ?? "")} · base ${north?.spacing.base}`,
    );
  });
});
