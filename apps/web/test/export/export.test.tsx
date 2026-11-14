import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { fix } from "@thema/engine";
import { exportAll } from "@thema/exporters";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as exportRoute } from "@/app/api/projects/[id]/export/route";
import { themaSystemSchema } from "@thema/schema";
import { EXPORT_FILES, ExportScreen, SNIPPETS, systemJson, zipFiles } from "@/export/export-screen";
import * as download from "@/lib/download";
import { buildZip } from "@/lib/zip";
import { newProject, saveProject } from "@/workspace/project";
import { call, fixtureSystem, PROJECT_ID } from "../api/helpers";

const system = fix(fixtureSystem("light-saas")).system;
const files = exportAll(system);

describe("the zip", () => {
  it("holds the five files, each byte for byte as exportAll writes it", () => {
    const unzipped = unzipSync(buildZip(files));
    expect(Object.keys(unzipped)).toEqual(EXPORT_FILES.map(([name]) => name));
    for (const [name, content] of Object.entries(files)) {
      expect(strFromU8(unzipped[name] ?? new Uint8Array()), name).toBe(content);
    }
  });

  it("holds only the checked files", () => {
    const subset = zipFiles(files, new Set(["DESIGN.md", "tokens.json"]));
    expect(Object.keys(unzipSync(buildZip(subset)))).toEqual(["DESIGN.md", "tokens.json"]);
  });

  it("is the same archive the API route sends", async () => {
    const response = await call(exportRoute, {
      method: "POST",
      path: `/api/projects/${PROJECT_ID}/export?format=zip`,
      id: PROJECT_ID,
      body: { system },
    });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(buildZip(files));
  });
});

describe("the Export screen", () => {
  const saved = vi.spyOn(download, "saveFile").mockImplementation(() => undefined);

  beforeEach(() => {
    localStorage.clear();
    saved.mockClear();
  });
  afterEach(cleanup);

  const seed = () =>
    saveProject(localStorage, {
      ...newProject(PROJECT_ID, "2026-11-14T00:00:00.000Z"),
      result: system,
    });

  it("explains itself without a system", async () => {
    render(<ExportScreen />);
    expect(await screen.findByRole("heading", { name: "Nothing to export yet." })).toBeTruthy();
  });

  it("previews each file and copies its exact content", async () => {
    seed();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ExportScreen />);
    const preview = await screen.findByTestId("file-preview");
    expect(preview.textContent).toBe(files["DESIGN.md"]);

    fireEvent.click(screen.getByRole("button", { name: /^tokens\.json/ }));
    expect(screen.getByTestId("file-preview").textContent).toBe(files["tokens.json"]);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(files["tokens.json"]));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("downloads a zip of the checked files", async () => {
    seed();
    render(<ExportScreen />);
    fireEvent.click(await screen.findByLabelText("Include style-guide.html in the zip"));
    fireEvent.click(screen.getByLabelText("Include theme.css in the zip"));
    fireEvent.click(screen.getByRole("button", { name: "Download zip (3 files)" }));
    expect(saved).toHaveBeenCalledTimes(1);
    const [name, data] = saved.mock.calls[0] ?? [];
    expect(name).toBe("thema.zip");
    expect(Object.keys(unzipSync(data as Uint8Array)).sort()).toEqual(
      ["DESIGN.md", "shadcn.css", "tokens.json"].sort(),
    );
  });

  it("shows the MCP and CLI setup with copy buttons, and downloads thema.json", async () => {
    seed();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ExportScreen />);
    await screen.findByTestId("file-preview");
    for (const [label, text] of SNIPPETS) {
      expect(screen.getByText(text)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: `Copy the ${label} setup` }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(text));
    }
    expect(screen.queryByText(/arrive in week 6/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Download thema.json" }));
    const [name, data, type] = saved.mock.calls.at(-1) ?? [];
    expect(name).toBe("thema.json");
    expect(type).toBe("application/json");
    expect(data).toBe(systemJson(system));
    // What the CLI (--in) and the MCP server (system_path) read: the same system, valid.
    expect(themaSystemSchema.parse(JSON.parse(String(data)))).toEqual(system);
  });

  it("has no axe violations and one primary button", async () => {
    seed();
    const { container } = render(<ExportScreen />);
    await screen.findByTestId("file-preview");
    expect(screen.queryByRole("link", { name: "Export system" })).toBeNull();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
