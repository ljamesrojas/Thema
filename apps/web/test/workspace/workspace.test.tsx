// The Workspace against the real API route handlers: fetch is routed to them in-process, with the
// worker mocked by recorded fixtures (a URL on "<fixture>.test" extracts as that fixture).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createProject } from "@/app/api/projects/route";
import { PATCH as blendRoute } from "@/app/api/projects/[id]/blend/route";
import { POST as addReference } from "@/app/api/projects/[id]/references/route";
import { GET as getReference } from "@/app/api/references/[id]/route";
import { setServices } from "@/server/services";
import { A11yReport } from "@/workspace/a11y-report";
import { STORAGE_KEY } from "@/workspace/project";
import { Workspace } from "@/workspace/workspace";
import { fixtureSystem, useFakeServices, type TestServices } from "../api/helpers";

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

const ROUTES: [string, RegExp, Handler][] = [
  ["POST", /^\/api\/projects$/, createProject],
  ["POST", /^\/api\/projects\/([^/]+)\/references$/, addReference],
  ["PATCH", /^\/api\/projects\/([^/]+)\/blend$/, blendRoute],
  ["GET", /^\/api\/references\/([^/]+)$/, getReference],
];

let services: TestServices;
let blendBodies: {
  project: { references: { borrowed: string[] }[]; blend: unknown };
  locks: string[];
}[];

beforeEach(() => {
  services = useFakeServices();
  blendBodies = [];
  localStorage.clear();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://localhost");
    const method = init.method ?? "GET";
    for (const [verb, pattern, handler] of ROUTES) {
      const match = pattern.exec(url.pathname);
      if (verb !== method || !match) continue;
      if (verb === "PATCH" && typeof init.body === "string")
        blendBodies.push(JSON.parse(init.body) as (typeof blendBodies)[number]);
      // jsdom's AbortSignal isn't Node's: the route doesn't need it.
      const request = new Request(url, {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        ...(typeof init.body === "string" ? { body: init.body } : {}),
      });
      return handler(request, { params: Promise.resolve({ id: match[1] ?? "" }) });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setServices(undefined);
});

const renderWorkspace = (props: { initialUrl?: string } = {}) =>
  render(<Workspace pollMs={20} blendDelayMs={10} {...props} />);

async function addSite(url: string) {
  const input = await screen.findByLabelText("Add a reference URL");
  fireEvent.change(input, { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

const card = (host: string) => screen.getByRole("article", { name: host });
const chip = (host: string, label: string) =>
  within(within(card(host)).getByRole("group", { name: `Borrow from ${host}` })).getByRole(
    "button",
    { name: label },
  );

describe("Workspace", () => {
  it("adds a site, shows its stage, then its system, warnings and screenshot", async () => {
    const release = services.hold();
    renderWorkspace();
    await addSite("light-saas.test");
    expect(
      await within(await screen.findByRole("article", { name: "light-saas.test" })).findAllByText(
        "Reading styles…",
      ),
    ).not.toHaveLength(0);
    release();
    await waitFor(() =>
      expect(within(card("light-saas.test")).getByText("Extracted")).toBeTruthy(),
    );
    expect(within(card("light-saas.test")).getByText(/No dark theme/)).toBeTruthy();
    expect(
      within(card("light-saas.test")).getByRole("img", { name: "Screenshot of light-saas.test" }),
    ).toBeTruthy();
    // The blend arrives: the token panel and the report fill in.
    expect(await screen.findByRole("heading", { name: "Typography" })).toBeTruthy();
    expect(screen.getByText(/light ·/)).toBeTruthy();
  });

  it("adds the Landing's URL on arrival", async () => {
    renderWorkspace({ initialUrl: "https://warm-editorial.test/" });
    expect(await screen.findByRole("article", { name: "warm-editorial.test" })).toBeTruthy();
  });

  it("refuses a private address before calling the API", async () => {
    renderWorkspace();
    await addSite("localhost:3000");
    expect((await screen.findByRole("alert")).textContent).toMatch(/public websites/);
    expect(services.runs).toEqual([]);
  });

  it("moves a borrow chip between references and blends with the new owner", async () => {
    renderWorkspace();
    await addSite("light-saas.test");
    await waitFor(() =>
      expect(within(card("light-saas.test")).getByText("Extracted")).toBeTruthy(),
    );
    await addSite("warm-editorial.test");
    await waitFor(() =>
      expect(within(card("warm-editorial.test")).getByText("Extracted")).toBeTruthy(),
    );
    expect(chip("light-saas.test", "Type").getAttribute("aria-pressed")).toBe("true");
    expect(chip("warm-editorial.test", "Type").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(chip("warm-editorial.test", "Type"));
    expect(chip("warm-editorial.test", "Type").getAttribute("aria-pressed")).toBe("true");
    expect(chip("light-saas.test", "Type").getAttribute("aria-pressed")).toBe("false");
    await waitFor(() =>
      expect(blendBodies.at(-1)?.project.references.map((r) => r.borrowed)).toEqual([
        ["colors", "spacing", "shape", "layout"],
        ["typography"],
      ]),
    );
    expect(
      await screen.findByText(`from warm-editorial.test · ratio`, { exact: false }),
    ).toBeTruthy();
  });

  it("debounces slider moves into one blend with the new settings", async () => {
    renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    await waitFor(() => expect(blendBodies.length).toBeGreaterThan(0));
    const before = blendBodies.length;
    const density = screen.getByLabelText("Density");
    act(() => {
      for (const value of ["0.2", "0.4", "0.6"]) fireEvent.change(density, { target: { value } });
    });
    await waitFor(() => expect(blendBodies.at(-1)?.project.blend).toMatchObject({ density: 0.6 }));
    expect(blendBodies.length - before).toBe(1);
    expect(screen.getByText("1.15×")).toBeTruthy();
  });

  it("locks a color: the blend sends the lock and the chip shows it", async () => {
    renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    const lock = screen.getByRole("button", { name: "Lock Primary" });
    expect(lock.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(lock);
    expect(lock.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(blendBodies.at(-1)?.locks).toEqual(["color.light.primary"]));
    expect(screen.getByText("Primary · locked")).toBeTruthy();
  });

  it("switches the palette between light and dark", async () => {
    renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    const canvasHex = () =>
      screen
        .getByText("Canvas", { selector: "figcaption span" })
        .closest("figure")
        ?.querySelector("code")?.textContent;
    const light = canvasHex();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    expect(canvasHex()).not.toBe(light);
    expect(screen.getByRole("button", { name: "Lock Primary" })).toBeTruthy();
  });

  it("saves the project in the browser and opens it again", async () => {
    const first = renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    expect(localStorage.getItem(STORAGE_KEY)).toContain("light-saas.test");
    first.unmount();
    renderWorkspace();
    expect(await screen.findByRole("article", { name: "light-saas.test" })).toBeTruthy();
  });

  it("is keyboard-operable: chips, locks, theme and remove are buttons; sliders are labelled ranges", async () => {
    renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    for (const button of [
      chip("light-saas.test", "Colors"),
      screen.getByRole("button", { name: "Lock Canvas" }),
      screen.getByRole("button", { name: "Dark" }),
      screen.getByRole("button", { name: "Remove light-saas.test" }),
    ]) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.tabIndex).toBe(0);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    for (const name of ["Density", "Roundness", "Contrast", "Warmth"]) {
      const slider = screen.getByRole("slider", { name });
      expect(slider.getAttribute("type")).toBe("range");
      expect(slider.getAttribute("aria-valuetext")).toBeTruthy();
    }
  });

  it("has no axe violations (contrast checked from DESIGN.md's ratios: jsdom applies no CSS)", async () => {
    const { container } = renderWorkspace();
    await addSite("light-saas.test");
    await screen.findByRole("heading", { name: "Typography" });
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("A11yReport", () => {
  const system = fixtureSystem("light-saas");

  it("lists fixes and unresolved pairs, with 'locked: can't fix' and an Unlock button", () => {
    const onUnlock = vi.fn();
    render(
      <A11yReport
        system={{
          ...system,
          a11y: {
            passes: false,
            fixes: [{ pair: ["ink-muted", "surface"], theme: "light", before: 3.9, after: 4.7 }],
          },
        }}
        report={{
          generated: "dark",
          unresolved: [
            { theme: "light", pair: ["primary", "canvas"], ratio: 1.4, min: 3, reason: "locked" },
            {
              theme: "dark",
              pair: ["accent", "canvas"],
              ratio: 2.1,
              min: 3,
              reason: "out-of-range",
            },
          ],
          lockedClashes: [],
          ignoredLocks: [],
        }}
        locks={["color.light.primary"]}
        onUnlock={onUnlock}
      />,
    );
    expect(screen.getByText("muted / surface")).toBeTruthy();
    expect(screen.getByText("3.9 → 4.7")).toBeTruthy();
    expect(screen.getByText("locked: can't fix")).toBeTruthy();
    expect(screen.getByText("no lightness passes")).toBeTruthy();
    expect(screen.getByText(/Locked tokens were left alone/)).toBeTruthy();
    expect(screen.getByText("Generated")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlock primary" }));
    expect(onUnlock).toHaveBeenCalledWith("color.light.primary");
  });

  it("explains itself before there's a system", () => {
    render(<A11yReport system={undefined} report={undefined} locks={[]} onUnlock={() => {}} />);
    expect(screen.getByText(/checked against WCAG 2.2 AA once your system is ready/)).toBeTruthy();
  });
});
