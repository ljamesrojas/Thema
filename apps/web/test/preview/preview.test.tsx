import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { fix } from "@thema/engine";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PreviewFrame } from "@/preview/frame";
import { Preview } from "@/preview/preview";
import { TEMPLATES } from "@/preview/templates";
import { declarationsIn, previewVariables } from "@/preview/variables";
import { addReference, newProject, saveProject, STORAGE_KEY } from "@/workspace/project";
import { toShadcnCss } from "@thema/exporters";
import { fixtureSystem } from "../api/helpers";

const FIXTURES = readdirSync(join(import.meta.dirname, "../../../../fixtures"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/**
 * Variables used without a fallback: `-(--x)` utilities and `var(--x)` with nothing after the
 * name. A `var(--x, …)` may be missing; the innermost var of its fallback chain is caught here.
 */
const requiredVariables = (html: string) =>
  [...new Set([...html.matchAll(/\(--([\w-]+)\)/g)].map((m) => `--${m[1]}`))].sort();

const markup = (template: keyof typeof TEMPLATES, variables: Record<string, string>) => {
  const { Template } = TEMPLATES[template];
  return renderToStaticMarkup(
    <PreviewFrame variables={variables} viewport="desktop" label="preview">
      <Template />
    </PreviewFrame>,
  );
};

describe("preview variables come from the real exports", () => {
  it("parses shadcn.css's :root and .dark blocks", () => {
    const system = fix(fixtureSystem("light-saas")).system;
    const css = toShadcnCss(system);
    const { light, dark } = previewVariables(system);
    expect(light["--primary"]).toBe(declarationsIn(css, ":root")["--primary"]);
    expect(dark["--background"]).toBe(declarationsIn(css, ".dark")["--background"]);
    expect(light["--font-sans"]).toBeTruthy();
    expect(light["--text-base"]).toMatch(/px$/);
    // Colors come from shadcn.css; the base spacing unit isn't applied (it would rescale Tailwind).
    expect(Object.keys(light).some((name) => name.startsWith("--color-"))).toBe(false);
    expect(light["--spacing"]).toBeUndefined();
  });

  it("covers all 22 fixtures", () => {
    expect(FIXTURES).toHaveLength(22);
  });

  it.each(FIXTURES)("every template uses only variables %s's exports define", (name) => {
    const { light, dark } = previewVariables(fix(fixtureSystem(name)).system);
    for (const template of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      for (const variables of [light, dark]) {
        const missing = requiredVariables(markup(template, variables)).filter(
          (v) => !(v in variables),
        );
        expect(missing, `${template}`).toEqual([]);
      }
    }
  });

  it("the light/dark switch swaps only the frame's variables", () => {
    const { light, dark } = previewVariables(fix(fixtureSystem("cal-com")).system);
    for (const template of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const [lightHtml, darkHtml] = [markup(template, light), markup(template, dark)];
      expect(lightHtml).not.toBe(darkHtml);
      // The frame's style attribute is the first one in the markup: remove it from both.
      const withoutFrameStyle = (html: string) => html.replace(/ style="[^"]*"/, "");
      expect(withoutFrameStyle(lightHtml)).toBe(withoutFrameStyle(darkHtml));
    }
  });
});

describe("the Preview screen", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  function seed(screenshot: string | null = null) {
    let project = newProject("6f1c1b2e-3d4a-4b5c-8d6e-7f8091a2b3c4", "2026-11-14T00:00:00.000Z");
    const added = addReference(project, {
      id: "1".repeat(24),
      url: "https://light-saas.test/",
      status: "done",
      system: fixtureSystem("light-saas"),
      warnings: [],
      screenshot,
    });
    if (!added.ok) throw new Error("not added");
    project = { ...added.project, result: fix(fixtureSystem("light-saas")).system };
    saveProject(localStorage, project);
  }

  it("explains itself without a system", async () => {
    render(<Preview />);
    expect(await screen.findByRole("heading", { name: "Nothing to preview yet." })).toBeTruthy();
  });

  it("switches template, theme and viewport", async () => {
    seed();
    render(<Preview />);
    expect(
      await screen.findByRole("heading", { name: "Calm software for busy teams" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings form" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();

    const frame = () => screen.getByTestId("preview-frame");
    const lightBackground = frame().style.getPropertyValue("--background");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(frame().style.getPropertyValue("--background")).not.toBe(lightBackground);
    expect(frame().getAttribute("aria-label")).toBe("Settings form preview, dark, desktop");

    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(frame().className).toContain("max-w-[390px]");
  });

  it("compares with the source screenshot when there is one", async () => {
    seed();
    const { unmount } = render(<Preview />);
    const off = await screen.findByRole("button", { name: "Compare with source" });
    expect(off.hasAttribute("disabled")).toBe(true);
    unmount();

    seed("/api/references/111111111111111111111111/screenshot");
    render(<Preview />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare with source" }));
    expect(screen.getByRole("img", { name: "Screenshot of light-saas.test" })).toBeTruthy();
    expect(screen.getByTestId("preview-frame")).toBeTruthy();
  });

  it("has no axe violations (contrast checked in Chromium: jsdom applies no CSS)", async () => {
    seed("/api/references/111111111111111111111111/screenshot");
    const { container } = render(<Preview />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare with source" }));
    for (const name of ["Landing", "Dashboard", "Settings form"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((v) => `${name} ${v.id}: ${v.help}`)).toEqual([]);
    }
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });
});
