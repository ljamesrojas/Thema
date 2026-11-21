// The site pages (docs/pages.md): How it works, Exports, For agents and Pricing, with the shared
// header and footer the Landing uses too.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { exportAll } from "@thema/exporters";
import { MAX_REFERENCES } from "@thema/engine";
import { ANONYMOUS_DAILY_EXTRACTIONS } from "@thema/jobs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUESTIONS } from "@/components/faq";
import { Landing } from "@/components/landing";
import { GITHUB_URL, SITE_PAGES } from "@/components/site/site-header";
import { EXPORT_FILES, SNIPPETS } from "@/lib/exports-meta";
import { heroBlend, sampleSystem } from "@/lib/hero-blend";
import { PLANS, PRICES } from "@/server/plans";
import { AgentsPage } from "@/site/agents-page";
import { CLI_COMMANDS, ExportsPage } from "@/site/exports-page";
import { EXCERPT_LINES } from "@/site/file-explorer";
import { HowItWorksPage } from "@/site/how-it-works";
import { PricingPage } from "@/site/pricing-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PAGES: [string, string, () => ReactElement, RegExp][] = [
  ["/how-it-works", "How it works", () => <HowItWorksPage />, /From five links to one system/],
  ["/exports", "Exports", () => <ExportsPage />, /Five files\. One system\./],
  ["/agents", "For agents", () => <AgentsPage />, /Your agent, now with taste/],
  ["/pricing", "Pricing", () => <PricingPage />, /Every feature, free to start/],
];

const mainNav = () => screen.getByRole("navigation", { name: "Main" });

describe.each(PAGES)("%s", (path, label, page, title) => {
  it("renders its h1 in plain Geist (no accent word, no underline), and a closing call to action", () => {
    render(page());
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(title);
    // The page heroes' headings are one font throughout (user's call): no serif word, no underline.
    expect(h1.querySelectorAll("span")).toHaveLength(0);
    const cta = screen.getByRole("region", { name: "Get started" });
    expect(
      within(cta).getByRole("link", { name: "Paste your first site" }).getAttribute("href"),
    ).toBe("/");
  });

  it("marks its own link as the current page, and only that one", () => {
    render(page());
    const current = within(mainNav())
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current"));
    expect(
      current.map((a) => [a.textContent, a.getAttribute("aria-current"), a.getAttribute("href")]),
    ).toEqual([[label, "page", path]]);
  });

  it("has no axe violations (contrast is checked in Chromium: jsdom applies no CSS)", async () => {
    const { container } = render(page());
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("SiteHeader and SiteFooter", () => {
  it("link the four pages, GitHub in a new tab, Sign in and Start blending", () => {
    render(<ExportsPage />);
    const nav = within(mainNav());
    for (const [href, label] of SITE_PAGES) {
      expect(nav.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
    const github = nav.getByRole("link", { name: /GitHub/ });
    expect(github.getAttribute("href")).toBe(GITHUB_URL);
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toBe("noopener");
    expect(github.textContent).toContain("(opens in a new tab)");
    expect(nav.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(nav.getByRole("link", { name: "Start blending" }).getAttribute("href")).toBe(
      "/workspace",
    );

    const footer = within(screen.getByRole("navigation", { name: "Footer" }));
    expect(footer.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      ...SITE_PAGES.map(([href]) => href),
      GITHUB_URL,
      "/privacy",
      "/terms",
      "/refunds",
    ]);
    expect(screen.getByRole("contentinfo").textContent).toContain(
      "© 2026 Thema · Inspired by, never cloned.",
    );
  });

  it("are the Landing's too: its nav goes to the pages and marks none as current", () => {
    render(<Landing blend={heroBlend()} />);
    const nav = within(mainNav());
    for (const [href, label] of SITE_PAGES) {
      const link = nav.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toBe(href);
      expect(link.getAttribute("aria-current")).toBeNull();
    }
    expect(nav.getByRole("link", { name: /GitHub/ }).getAttribute("href")).toBe(GITHUB_URL);
  });

  it("the Landing's FAQ says the CLI and MCP server need no account", () => {
    const answer = QUESTIONS.find(([q]) => q === "Do I need an account?")?.[1];
    expect(answer).toBe(
      "Your first blend works without sign-up. Sign in with GitHub or Google to keep saved projects. The CLI and MCP server run on your own machine and need no account.",
    );
  });
});

describe("Exports: the file explorer", () => {
  const files = exportAll(sampleSystem());
  /** Each shown line's raw text, as the exporters wrote it (the colors are only spans). */
  const lines = () =>
    [...screen.getByTestId("code").querySelectorAll("[data-line]")].map((l) => {
      expect(l.textContent).toBe(l.getAttribute("data-line"));
      return l.getAttribute("data-line");
    });
  /** The excerpt: the top of the real file. */
  const top = (name: string) => (files[name] ?? "").split("\n").slice(0, EXCERPT_LINES).join("\n");

  it("shows the top of each file as the exporters write it for the sample system", () => {
    render(<ExportsPage />);
    const list = within(screen.getByRole("list", { name: "Files" }));
    expect(list.getByRole("button", { name: /^DESIGN\.md/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(lines()).toHaveLength(EXCERPT_LINES);
    expect(lines().join("\n")).toBe(top("DESIGN.md"));
    for (const [name] of EXPORT_FILES.filter(([n]) => n !== "style-guide.html")) {
      const button = list.getByRole("button", { name: new RegExp(`^${name.replace(".", "\\.")}`) });
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(
        list.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true"),
      ).toHaveLength(1);
      expect(lines().join("\n")).toBe(top(name));
    }
    // Only the .example sample sites, no real brand.
    expect(files["DESIGN.md"]).toMatch(/north\.example/);
  });

  it("lists the CLI README's three commands, word for word", () => {
    const readme = readFileSync(
      join(import.meta.dirname, "../../../../packages/cli/README.md"),
      "utf8",
    );
    const block = /```sh\n([\s\S]*?)```/.exec(readme)?.[1] ?? "";
    const commands = block
      .replace(/\\\n/g, " ")
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    expect(CLI_COMMANDS.map(([, command]) => command)).toEqual(commands);
    render(<ExportsPage />);
    const shown = screen.getByRole("region", { name: "The CLI's three commands" }).textContent;
    for (const [comment, command] of CLI_COMMANDS) {
      expect(shown).toContain(`# ${comment}`);
      expect(shown).toContain(command);
    }
  });

  it("renders style-guide.html in a sandboxed frame instead of code", () => {
    render(<ExportsPage />);
    fireEvent.click(screen.getByRole("button", { name: /^style-guide\.html/ }));
    const frame = screen.getByTestId("style-guide-frame");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe(files["style-guide.html"]);
    expect(screen.queryByTestId("code")).toBeNull();
  });

  it("copies the shown file", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ExportsPage />);
    fireEvent.click(screen.getByRole("button", { name: /^theme\.css/ }));
    fireEvent.click(screen.getByRole("button", { name: "Copy theme.css" }));
    expect(writeText).toHaveBeenCalledWith(files["theme.css"]);
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});

describe("For agents: setup tabs", () => {
  it("switch between Claude Code, Cursor and CLI, each with the Export screen's command", () => {
    render(<AgentsPage />);
    const tabs = within(screen.getByRole("group", { name: "Set up for" }));
    const code = () => screen.getByTestId("setup-code").textContent;
    expect(tabs.getByRole("button", { name: "Claude Code" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(code()).toBe(SNIPPETS[0][1]);
    for (const [i, name] of (["Claude Code", "Cursor", "CLI"] as const).entries()) {
      fireEvent.click(tabs.getByRole("button", { name }));
      expect(tabs.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
      expect(code()).toBe(SNIPPETS[i]?.[1]);
    }
    expect(
      screen.getByText(/Until the npm package ships, run it from a clone of the repo/),
    ).toBeTruthy();
  });

  it("reuses the Landing's agents strip: hover-only names, no links", () => {
    render(<AgentsPage />);
    const strip = screen.getByRole("region", { name: "Reads into" });
    expect(strip.querySelectorAll("li > span").length).toBeGreaterThanOrEqual(7);
    expect(within(strip).queryAllByRole("link")).toEqual([]);
  });

  it("'Set up the MCP server' glides to the setup section", () => {
    render(<AgentsPage />);
    const link = screen.getByRole("link", { name: "Set up the MCP server" });
    expect(link.getAttribute("href")).toBe("#setup");
    expect(document.getElementById("setup")).not.toBeNull();
    // Smooth for in-page jumps unless the reader asks for less motion; instant page changes.
    const css = readFileSync(join(import.meta.dirname, "../../src/app/globals.css"), "utf8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*html\s*\{\s*scroll-behavior: smooth;/,
    );
    const layout = readFileSync(join(import.meta.dirname, "../../src/app/layout.tsx"), "utf8");
    expect(layout).toContain('data-scroll-behavior="smooth"');
  });

  it("badges the two ways in, numbers them and links each one on", () => {
    render(<AgentsPage />);
    const ways = within(screen.getByRole("region", { name: "Two ways in" }));
    expect(ways.getByText("No setup").className).toContain("bg-ink");
    expect(ways.getByText("MCP").className).toContain("bg-primary-strong");
    expect(ways.getByText("01")).toBeTruthy();
    expect(ways.getByText("02")).toBeTruthy();
    expect(ways.getByRole("link", { name: "See the file format →" }).getAttribute("href")).toBe(
      "/exports",
    );
    expect(ways.getByRole("link", { name: "Set it up →" }).getAttribute("href")).toBe("#setup");
  });

  it("lists the three MCP tools", () => {
    render(<AgentsPage />);
    const tools = within(screen.getByRole("region", { name: "The tools" }));
    expect(tools.getByText("MCP tools")).toBeTruthy();
    expect(tools.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "takes",
      "returns",
      "takes",
      "returns",
      "takes",
      "returns",
    ]);
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
        .filter((t) => ["extract", "blend", "get_design_md"].includes(t ?? "")),
    ).toEqual(["extract", "blend", "get_design_md"]);
  });
});

describe("Pricing", () => {
  it("toggles monthly and yearly billing", () => {
    render(<PricingPage />);
    const toggle = within(screen.getByRole("group", { name: "Billing" }));
    const price = () => screen.getByTestId("pro-price").textContent;
    expect(toggle.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(price()).toBe(`$${PRICES.monthly}`);
    fireEvent.click(toggle.getByRole("button", { name: /^Yearly/ }));
    expect(toggle.getByRole("button", { name: /^Yearly/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(toggle.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(price()).toBe(`$${PRICES.yearly}`);
    expect(screen.getByText("That's $8 a month, billed once a year.")).toBeTruthy();
    // "save 33%" sits inside the Yearly button; there's no "Cancel anytime" promise.
    expect(toggle.getByRole("button", { name: /^Yearly/ }).textContent).toBe("Yearly save 33%");
    expect(screen.queryByText(/Cancel anytime/)).toBeNull();
    fireEvent.click(toggle.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("Or $96 a year, and save 33%.")).toBeTruthy();
  });

  it("states each plan's limits from the code, and Pro is 'Coming soon', focusable but not a link", () => {
    render(<PricingPage />);
    const plan = (name: string) => within(screen.getByRole("listitem", { name: `${name} plan` }));
    expect(
      plan("No account").getByText(`${ANONYMOUS_DAILY_EXTRACTIONS} new extractions a day`),
    ).toBeTruthy();
    expect(
      plan("Free").getByText(`${PLANS.free.savedProjects} saved projects in your account`),
    ).toBeTruthy();
    expect(plan("Free").getByRole("link", { name: "Sign in free" }).getAttribute("href")).toBe(
      "/sign-in",
    );
    expect(
      plan("Pro").getByText(`${PLANS.pro.dailyExtractions} new extractions a day`),
    ).toBeTruthy();
    const soon = plan("Pro").getByText("Coming soon");
    expect(soon.tagName).toBe("SPAN");
    expect(soon.getAttribute("tabindex")).toBe("0");
    expect(soon.closest("a")).toBeNull();
    expect(plan("Pro").queryByRole("button")).toBeNull();
    // A muted outlined label, not a filled primary button.
    expect(soon.className).toContain("border");
    expect(soon.className).not.toMatch(/bg-primary/);
  });

  it("compares plans in a real table", () => {
    render(<PricingPage />);
    const table = screen.getByRole("table");
    const cols = within(table).getAllByRole("columnheader");
    expect(cols.map((c) => c.getAttribute("scope"))).toEqual(["col", "col", "col", "col"]);
    const rows = within(table).getAllByRole("rowheader");
    expect(rows.every((r) => r.getAttribute("scope") === "row")).toBe(true);
    const included = within(table)
      .getAllByRole("cell")
      .filter((c) => c.textContent === "Included");
    expect(included).toHaveLength(12);
    expect(included.every((c) => c.className.includes("text-success"))).toBe(true);
    const sites = within(table).getByRole("rowheader", { name: "Sites per blend" }).parentElement;
    expect(sites?.textContent).toBe(`Sites per blend${String(MAX_REFERENCES).repeat(3)}`);
  });
});

describe("How it works", () => {
  it("links the five steps to their sections", () => {
    render(<HowItWorksPage />);
    const steps = within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole("link");
    expect(steps.map((a) => a.getAttribute("href"))).toEqual([
      "#paste",
      "#extract",
      "#tag",
      "#tune",
      "#export",
    ]);
    for (const a of steps) {
      expect(document.getElementById(a.getAttribute("href")?.slice(1) ?? "")).not.toBeNull();
    }
  });

  it("shows the guard's real verdicts on the Paste step", () => {
    render(<HowItWorksPage />);
    const guard = within(screen.getByRole("list", { name: "What the guard says" }));
    expect(guard.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "public address",
      "localhost:3000 · refused",
      "192.168.1.10 · refused",
    ]);
    expect(
      guard.getAllByRole("listitem").map((li) => li.className.includes("text-success")),
    ).toEqual([true, false, false]);
  });

  it("Roundness and Density move the card; the lock toggles", () => {
    render(<HowItWorksPage />);
    const card = screen.getByTestId("tune-card");
    fireEvent.change(screen.getByLabelText("Roundness"), { target: { value: "100" } });
    expect(card.style.borderRadius).toBe("24px");
    // Density as the engine applies it: -1 is 0.8x the spacing.
    fireEvent.change(screen.getByLabelText("Density"), { target: { value: "0" } });
    expect(card.style.padding).toBe("16px");
    expect(screen.getByText("0.80×")).toBeTruthy();
    const lock = screen.getByRole("button", { name: /^primary #/ });
    expect(lock.getAttribute("aria-pressed")).toBe("true");
    expect(lock.textContent).toContain("Locked");
    fireEvent.click(lock);
    expect(lock.getAttribute("aria-pressed")).toBe("false");
    expect(lock.textContent).toContain("Unlocked");
  });
});
