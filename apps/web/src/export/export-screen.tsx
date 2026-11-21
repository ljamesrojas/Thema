"use client";

import type { ThemaSystem } from "@thema/engine";
import { exportAll } from "@thema/exporters";
import { useId, useMemo, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/button";
import { saveFile } from "@/lib/download";
import { api } from "@/workspace/api";
import { cn } from "@/lib/cn";
import { EXPORT_FILES, SNIPPETS, type ExportFile } from "@/lib/exports-meta";
import { buildZip } from "@/lib/zip";
import { TopBar } from "@/workspace/top-bar";
import { useAccount } from "@/account/use-account";
import { useStoredProject } from "@/workspace/use-stored-project";

export { EXPORT_FILES, SNIPPETS, type ExportFile };

/** The system as JSON: what the CLI and the MCP server read (`--in`, `system_path`). */
export const systemJson = (system: ThemaSystem) => `${JSON.stringify(system, null, 2)}\n`;

function AgentSetup({ system, onExport }: { system: ThemaSystem; onExport: () => void }) {
  const id = useId();
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2_000);
    } catch {
      setCopied(null);
    }
  }
  return (
    <section
      aria-labelledby={`${id}-agents`}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[640px] flex-col gap-1">
          <h3 id={`${id}-agents`} className="m-0 text-label-md font-label-md font-semibold">
            MCP server and CLI
          </h3>
          <p className="m-0 text-body-sm font-body-sm text-ink-muted">
            Let your agent extract, blend and fetch DESIGN.md mid-task, or script it from the
            terminal. Until Thema&apos;s packages are published at launch, these run from a clone of
            the Thema repo: replace /path/to/thema with where you cloned it. Download thema.json to
            use this blend there (the CLI&apos;s --in, the MCP tools&apos; system_path).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            saveFile("thema.json", systemJson(system), "application/json");
            onExport();
          }}
          className={buttonVariants({ variant: "secondary" })}
        >
          Download thema.json
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {SNIPPETS.map(([label, text]) => (
          <li key={label} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2">
              <span className="text-ui-sm font-ui-sm text-ink-muted">{label}</span>
              <span className="flex items-center gap-2">
                <span role="status" className="text-ui-sm font-ui-sm text-success">
                  {copied === label ? "Copied" : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Copy the ${label} setup`}
                  onClick={() => void copy(label, text)}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Copy
                </button>
              </span>
            </span>
            <code className="block rounded-md bg-band px-4 py-3 text-token font-token break-all whitespace-pre-wrap text-band-ink">
              {text}
            </code>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The zip's contents: the checked files, byte for byte as exportAll writes them. */
export function zipFiles(files: Record<string, string>, checked: ReadonlySet<string>) {
  return Object.fromEntries(Object.entries(files).filter(([name]) => checked.has(name)));
}

/** `synced`: the project is saved to the signed-in account (it carries its sync info). */
function Shell({
  name,
  synced = false,
  children,
}: {
  name: string;
  synced?: boolean;
  children: ReactNode;
}) {
  const account = useAccount();
  const sync = synced ? "saved" : "local";
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar name={name} current="/export" saved sync={sync} account={account} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 pt-6 pb-10">
        {children}
      </main>
    </div>
  );
}

/** The Export screen (SPEC → Screens): checklist, file preview with copy, zip, agent setup. */
export function ExportScreen() {
  const id = useId();
  const { loaded, project } = useStoredProject();
  const system = project?.result;
  const files = useMemo(() => (system ? exportAll(system) : null), [system]);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(EXPORT_FILES.map(([name]) => name)),
  );
  const [selected, setSelected] = useState<ExportFile>("DESIGN.md");
  const [copied, setCopied] = useState<string | null>(null);

  if (!loaded) {
    return (
      <Shell name="Untitled system">
        <p role="status" className="m-0 text-body-md font-body-md text-ink-muted">
          Opening your export…
        </p>
      </Shell>
    );
  }
  if (!project || !files || !system) {
    return (
      <Shell name={project?.name ?? "Untitled system"}>
        <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center gap-5">
          <h2 className="m-0 text-h2 font-h2">Nothing to export yet.</h2>
          <p className="m-0 text-body-lg font-body-lg text-ink-soft">
            Add a site in the Workspace. Once your system is blended, its DESIGN.md, Tailwind,
            shadcn and DTCG files are ready here.
          </p>
          <a href="/workspace" className={buttonVariants({ variant: "secondary" })}>
            Go to the Workspace
          </a>
        </div>
      </Shell>
    );
  }

  /** Count this project's export in the anonymous daily totals (by its random id only). */
  const exported = () => api.exported(project.id);
  const content = files[selected] ?? "";
  const meta = EXPORT_FILES.find(([name]) => name === selected);
  const toggle = (name: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      exported();
      setCopied(selected);
      setTimeout(() => setCopied((c) => (c === selected ? null : c)), 2_000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Shell name={project.name} synced={project.account !== undefined}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-h2 font-h2">Export</h2>
          <p className="m-0 text-body-md font-body-md text-ink-muted">
            Every file comes from the same system, with a header naming Thema and your sources.
          </p>
        </div>
        <button
          type="button"
          disabled={checked.size === 0}
          onClick={() => {
            saveFile("thema.zip", buildZip(zipFiles(files, checked)), "application/zip");
            exported();
          }}
          className={cn(
            buttonVariants({ variant: "primary" }),
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          Download zip ({checked.size} {checked.size === 1 ? "file" : "files"})
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby={`${id}-formats`}
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 lg:max-w-[380px]"
        >
          <h3 id={`${id}-formats`} className="m-0 text-label-md font-label-md font-semibold">
            Formats
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {EXPORT_FILES.map(([name, description]) => (
              <li
                key={name}
                className={cn(
                  "flex items-start gap-3 rounded-md px-2 py-1.5",
                  selected === name && "bg-surface-subtle",
                )}
              >
                <input
                  id={`${id}-${name}`}
                  type="checkbox"
                  checked={checked.has(name)}
                  onChange={() => toggle(name)}
                  aria-label={`Include ${name} in the zip`}
                  className="mt-3.5 size-4 flex-none accent-ink"
                />
                <button
                  type="button"
                  aria-pressed={selected === name}
                  onClick={() => setSelected(name)}
                  className="flex min-h-11 flex-1 cursor-pointer flex-col items-start justify-center rounded-sm border-0 bg-transparent px-1 text-left"
                >
                  <span className="text-token font-token text-ink">{name}</span>
                  <span className="text-ui-sm font-ui-sm text-ink-muted">{description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby={`${id}-file`}
          className="flex min-w-0 flex-[999_1_480px] flex-col overflow-hidden rounded-lg border border-hairline bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider bg-surface-subtle px-4 py-2">
            <h3 id={`${id}-file`} className="m-0 text-token font-token">
              {selected}
            </h3>
            <span className="flex items-center gap-2">
              <span role="status" className="text-ui-sm font-ui-sm text-success">
                {copied === selected ? "Copied" : ""}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                className={buttonVariants({ variant: "ghost" })}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  saveFile(selected, content, meta?.[2] ?? "text/plain");
                  exported();
                }}
                className={buttonVariants({ variant: "ghost" })}
              >
                Download
              </button>
            </span>
          </div>
          <pre
            tabIndex={0}
            aria-label={`${selected} contents`}
            data-testid="file-preview"
            className="m-0 max-h-[560px] overflow-auto p-4 text-token font-token leading-[1.6] text-ink-soft"
          >
            {content}
          </pre>
        </section>
      </div>

      <AgentSetup system={system} onExport={exported} />
    </Shell>
  );
}
