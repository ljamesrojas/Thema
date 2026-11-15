// Accounts in the browser: the Workspace's autosave and claiming, the Projects screen and the
// sign-in screen, against the real route handlers (fetch is routed to them in-process). Who's
// signed in is set per test through the fake session's header.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeNext, signOut } from "@/account/auth-client";
import { ProjectsScreen } from "@/account/projects-screen";
import { SignInScreen } from "@/account/sign-in";
import { GET as getAccount } from "@/app/api/account/route";
import { GET as listProjects, POST as createProject } from "@/app/api/projects/route";
import {
  DELETE as deleteProject,
  GET as getProject,
  PUT as saveProject,
} from "@/app/api/projects/[id]/route";
import { PATCH as blendRoute } from "@/app/api/projects/[id]/blend/route";
import { POST as addReference } from "@/app/api/projects/[id]/references/route";
import { GET as getReference } from "@/app/api/references/[id]/route";
import { setServices } from "@/server/services";
import { loadProject, STORAGE_KEY } from "@/workspace/project";
import { Workspace } from "@/workspace/workspace";
import { signedIn, useFakeServices, type TestServices } from "../api/helpers";
import { ID, newId, OTHER_ID, projectData } from "../server/project-data";

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

const ROUTES: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/account$/, getAccount],
  ["GET", /^\/api\/projects$/, listProjects],
  ["POST", /^\/api\/projects$/, createProject],
  ["GET", /^\/api\/projects\/([^/]+)$/, getProject],
  ["PUT", /^\/api\/projects\/([^/]+)$/, saveProject],
  ["DELETE", /^\/api\/projects\/([^/]+)$/, deleteProject],
  ["POST", /^\/api\/projects\/([^/]+)\/references$/, addReference],
  ["PATCH", /^\/api\/projects\/([^/]+)\/blend$/, blendRoute],
  ["GET", /^\/api\/references\/([^/]+)$/, getReference],
];

let services: TestServices;
let user: string | null;
let auth: string[];

function route(accounts = true) {
  services = useFakeServices({ accounts });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://localhost");
    const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.pathname.startsWith("/api/auth/")) {
      auth.push(`${method} ${url.pathname}`);
      if (url.pathname === "/api/auth/sign-out") user = null;
      return Response.json({ success: true });
    }
    for (const [verb, pattern, handler] of ROUTES) {
      const match = pattern.exec(url.pathname);
      if (verb !== method || !match) continue;
      const request = new Request(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.9",
          ...(user ? signedIn(user) : {}),
        },
        ...(typeof init.body === "string" ? { body: init.body } : {}),
      });
      return handler(request, { params: Promise.resolve({ id: match[1] ?? "" }) });
    }
    return new Response("not found", { status: 404 });
  });
}

beforeEach(() => {
  user = null;
  auth = [];
  localStorage.clear();
  route();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setServices(undefined);
});

const renderWorkspace = () => render(<Workspace pollMs={20} blendDelayMs={10} saveDelayMs={10} />);

async function addSite(url: string) {
  const input = await screen.findByLabelText("Add a reference URL");
  fireEvent.change(input, { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

const stored = () => loadProject(localStorage);

describe("the Workspace and accounts", { timeout: 15_000 }, () => {
  it("signed out: offers sign-in and keeps the project in the browser only", async () => {
    renderWorkspace();
    const signIn = await screen.findByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe("/sign-in?next=%2Fworkspace");
    await addSite("light-saas.test");
    await screen.findByRole("article", { name: "light-saas.test" });
    expect(screen.getByText("Saved locally")).toBeTruthy();
    expect(stored()?.account).toBeUndefined();
  });

  it("accounts off: no sign-in, as before", async () => {
    route(false);
    renderWorkspace();
    await screen.findByLabelText("Add a reference URL");
    await waitFor(() => expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull());
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  });

  it("signed in: claims the project with its first site, then saves changes to it", async () => {
    user = "ana";
    renderWorkspace();
    expect(await screen.findByRole("link", { name: "Projects" })).toBeTruthy();
    await addSite("light-saas.test");
    await screen.findByText("Saved to your account");
    const id = stored()?.id ?? "";
    expect(stored()?.account).toMatchObject({ userId: "ana" });

    // The extraction finishes and the first blend lands: both are saved on top.
    await waitFor(async () => {
      const saved = await services.projects.get("ana", id);
      expect(saved?.data.result).toBeDefined();
      expect(saved?.data.references[0]?.status).toBe("done");
      expect(saved?.version).toBe(stored()?.account?.version);
    });
    expect(await services.projects.count("ana")).toBe(1);
  });

  it("after a save elsewhere, stops and offers the latest version", async () => {
    user = "ana";
    await services.projects.create("ana", projectData({ name: "Mine" }), newId);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...projectData({ name: "This tab" }),
        account: { userId: "ana", version: 1 },
      }),
    );
    await services.projects.save("ana", ID, projectData({ name: "Other device" }), 1);
    renderWorkspace();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/changed in another tab or device/);
    expect(screen.getByText("Not saved: newer version elsewhere")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "Load the latest version" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(stored()?.name).toBe("Other device");
    expect(stored()?.account?.version).toBe(2);
  });

  it("at the Free limit, keeps the project in the browser and says why", async () => {
    user = "ana";
    for (const id of [
      OTHER_ID,
      "11111111-2222-4333-8444-555555555555",
      "22222222-2222-4333-8444-555555555555",
    ]) {
      await services.projects.create("ana", projectData({ id }), newId);
    }
    renderWorkspace();
    await addSite("light-saas.test");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Free accounts keep 3 projects/);
    expect(within(alert).getByRole("link", { name: "Go to Projects" })).toBeTruthy();
    expect(screen.getByText("Saved locally: project limit reached")).toBeTruthy();
    expect(stored()?.account).toBeUndefined();
  });

  it("starts fresh when this browser holds another account's project", async () => {
    user = "ben";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...projectData({ name: "Ana's" }), account: { userId: "ana", version: 1 } }),
    );
    renderWorkspace();
    await waitFor(() => expect(stored()?.name).toBe("Untitled system"));
    expect(stored()?.references).toEqual([]);
    expect(stored()?.id).not.toBe(ID);
  });
});

describe("the Projects screen", () => {
  it("signed out: asks to sign in", async () => {
    render(<ProjectsScreen />);
    // The header's and the page's: both go to sign-in and come back here.
    const links = await screen.findAllByRole("link", { name: "Sign in" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/sign-in?next=%2Fprojects",
      "/sign-in?next=%2Fprojects",
    ]);
  });

  it("lists the account's projects with palette strips, opens and deletes them", async () => {
    user = "ana";
    await services.projects.create("ana", projectData({ name: "Kiln" }), newId);
    await services.projects.create("ana", projectData({ id: OTHER_ID, name: "Harbor" }), newId);
    await services.projects.create("ben", projectData({ id: newId(), name: "Ben's" }), newId);
    const { container } = render(<ProjectsScreen />);

    expect(await screen.findByRole("heading", { name: "Harbor" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Kiln" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ben's" })).toBeNull();
    expect(screen.getByText("2 of 3 saved · Free")).toBeTruthy();
    expect(screen.getAllByText("light-saas.test")).toHaveLength(2);
    const primary = projectData().result?.color.light.primary ?? "";
    expect(container.innerHTML).toContain(primary);

    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Open Kiln" }));
    await waitFor(() => expect(stored()?.name).toBe("Kiln"));
    expect(stored()?.account).toEqual({ userId: "ana", version: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Delete Kiln" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Kiln" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Kiln" })).toBeNull());
    expect(await services.projects.count("ana")).toBe(1);
    // It was also the copy open in this browser.
    expect(stored()).toBeNull();
  });

  it("shows the empty state, and New project is off at the limit", async () => {
    user = "ana";
    const { unmount } = render(<ProjectsScreen />);
    expect(await screen.findByText(/No saved projects yet/)).toBeTruthy();
    unmount();
    for (const id of [ID, OTHER_ID, "11111111-2222-4333-8444-555555555555"]) {
      await services.projects.create("ana", projectData({ id }), newId);
    }
    render(<ProjectsScreen />);
    await screen.findByText("3 of 3 saved · Free");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "New project" }).disabled).toBe(
      true,
    );
  });
});

describe("signing in and out", () => {
  it("shows the configured providers", async () => {
    render(<SignInScreen next="/projects" />);
    expect(await screen.findByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  });

  it("says when accounts are off, and when someone is already signed in", async () => {
    route(false);
    const { unmount } = render(<SignInScreen next={null} />);
    expect(await screen.findByText(/Accounts aren't set up on this server/)).toBeTruthy();
    unmount();
    route(true);
    user = "ana";
    render(<SignInScreen next={null} />);
    expect(await screen.findByText("You're signed in as User ana.")).toBeTruthy();
  });

  it("only returns to same-site paths", () => {
    expect(safeNext("/projects")).toBe("/projects");
    for (const bad of [
      null,
      "",
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "projects",
    ]) {
      expect(safeNext(bad)).toBe("/workspace");
    }
  });

  it("signing out clears an account's project from this browser, not an unsaved one", async () => {
    user = "ana";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...projectData(), account: { userId: "ana", version: 1 } }),
    );
    await signOut();
    expect(auth).toContain("POST /api/auth/sign-out");
    expect(stored()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData()));
    await signOut();
    expect(stored()?.id).toBe(ID);
  });
});
