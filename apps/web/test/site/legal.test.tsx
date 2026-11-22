// The legal pages: docs/legal/*.md rendered by lib/markdown, in the site's header and footer.
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { parseMarkdown, renderMarkdown } from "@/lib/markdown";
import privacy from "../../../../docs/legal/privacy.md?raw";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const SAMPLE = `# Title (skipped)

> An editor's note, skipped.

**Last updated:** [DATE]

## The short version

- One
- Two, with **bold** and \`code\`
  - Nested under two
- Three, a [link](/refunds)

| Service | Where |
| --- | --- |
| Neon | [REGION] |

A paragraph
over two lines.

### Small heading
`;

describe("the Markdown renderer", () => {
  it("parses headings, lists with one nested level, tables and paragraphs; skips the title and notes", () => {
    expect(parseMarkdown(SAMPLE).map((block) => block.kind)).toEqual([
      "p",
      "h2",
      "ul",
      "table",
      "p",
      "h3",
    ]);
    const list = parseMarkdown(SAMPLE)[2];
    expect(list?.kind === "ul" && list.items.map((item) => item.children)).toEqual([
      [],
      ["Nested under two"],
      [],
    ]);
    const table = parseMarkdown(SAMPLE)[3];
    expect(table?.kind === "table" && [table.head, table.rows]).toEqual([
      ["Service", "Where"],
      [["Neon", "[REGION]"]],
    ]);
  });

  it("renders bold, code, links, marked placeholders and a scoped table", () => {
    const html = renderToStaticMarkup(<>{renderMarkdown(SAMPLE)}</>);
    expect(html).not.toContain("Title (skipped)");
    expect(html).not.toContain("editor");
    expect(html).toContain('<strong class="font-semibold text-ink">bold</strong>');
    expect(html).toContain(">code</code>");
    expect(html).toContain('<a href="/refunds" class="text-primary-strong underline">link</a>');
    expect(html).toMatch(/<mark[^>]*>\[DATE\]<\/mark>/);
    expect(html).toMatch(/<mark[^>]*>\[REGION\]<\/mark>/);
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('<th scope="row"');
    expect(html).toContain("A paragraph over two lines.");
  });
});

describe.each([
  ["Privacy notice", PrivacyPage, "Your rights"],
  ["Terms of service", TermsPage, "Fair use"],
])("%s", (title, Page, section) => {
  it("renders the Markdown with the site's header and footer, and passes axe", async () => {
    const { container } = render(<Page />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(screen.getByRole("heading", { level: 2, name: section })).toBeTruthy();
    // The file's own "(DRAFT, for review)" title and editor's note aren't shown.
    expect(container.textContent).not.toMatch(/DRAFT|Not legal advice/);
    const footer = within(screen.getByRole("navigation", { name: "Footer" }));
    for (const [href, label] of [
      ["/privacy", "Privacy"],
      ["/terms", "Terms"],
    ]) {
      expect(footer.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("the privacy notice says what the code does", () => {
  it("names what sign-in stores and the 24-hour cache", () => {
    expect(privacy).toContain("name, email address and the link to your profile picture");
    expect(privacy).toContain("IP address and browser");
    expect(privacy).toContain("24 hours");
  });
});

describe("the not-found page", () => {
  it("says so, offers two ways back, keeps the site's header and footer, and passes axe", async () => {
    const { default: NotFound } = await import("@/app/not-found");
    const { container } = render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page doesn't exist.");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
    expect(screen.getByRole("link", { name: "Open the Workspace" }).getAttribute("href")).toBe(
      "/workspace",
    );
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
