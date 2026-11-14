"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";
import { hostOf, readyReferences } from "@/workspace/project";
import { TopBar } from "@/workspace/top-bar";
import { useStoredProject } from "@/workspace/use-stored-project";
import { PreviewFrame, type Viewport } from "./frame";
import { TEMPLATES, type TemplateId } from "./templates";
import { previewVariables } from "./variables";

type Theme = "light" | "dark";

/** A row of pressed/unpressed buttons (one choice of several). */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-0.5 rounded-full border border-pill-border bg-surface p-0.5"
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "min-h-11 cursor-pointer rounded-full border-0 px-4 text-ui-sm font-ui-sm",
            value === id ? "bg-ink text-canvas" : "bg-transparent text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Shell({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar name={name} current="/preview" saved />
      <main className="flex flex-1 flex-col gap-5 px-6 pt-5 pb-8">{children}</main>
    </div>
  );
}

/** The Preview screen: the blended system applied to three templates (SPEC → Preview). */
export function Preview() {
  const { loaded, project } = useStoredProject();
  const [template, setTemplate] = useState<TemplateId>("landing");
  const [theme, setTheme] = useState<Theme>("light");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [compare, setCompare] = useState(false);
  const [compareRef, setCompareRef] = useState<string | null>(null);

  const system = project?.result;
  const variables = useMemo(() => (system ? previewVariables(system) : null), [system]);
  const withScreenshots = project
    ? readyReferences(project).filter((ref) => ref.screenshot !== null)
    : [];
  const shown = withScreenshots.find((ref) => ref.id === compareRef) ?? withScreenshots[0];

  if (!loaded) {
    return (
      <Shell name="Untitled system">
        <p role="status" className="m-0 text-body-md font-body-md text-ink-muted">
          Opening your preview…
        </p>
      </Shell>
    );
  }
  if (!project || !system || !variables) {
    return (
      <Shell name={project?.name ?? "Untitled system"}>
        <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center gap-5">
          <h2 className="m-0 text-h2 font-h2">Nothing to preview yet.</h2>
          <p className="m-0 text-body-lg font-body-lg text-ink-soft">
            Add a site in the Workspace. Once its styles are read, your system shows up here on a
            landing page, a dashboard and a settings form.
          </p>
          <a href="/workspace" className={buttonVariants({ variant: "secondary" })}>
            Go to the Workspace
          </a>
        </div>
      </Shell>
    );
  }

  const { Template, label } = TEMPLATES[template];
  const frame = (
    <PreviewFrame
      variables={variables[theme]}
      viewport={viewport}
      label={`${label} preview, ${theme}, ${viewport}`}
    >
      <Template />
    </PreviewFrame>
  );

  return (
    <Shell name={project.name}>
      <h2 className="sr-only">Preview</h2>
      <div className="flex flex-wrap items-center gap-3">
        <Choice
          label="Template"
          value={template}
          options={Object.entries(TEMPLATES).map(([id, t]) => [id as TemplateId, t.label] as const)}
          onChange={setTemplate}
        />
        <Choice
          label="Theme"
          value={theme}
          options={[
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={setTheme}
        />
        <Choice
          label="Viewport"
          value={viewport}
          options={[
            ["desktop", "Desktop"],
            ["mobile", "Mobile"],
          ]}
          onChange={setViewport}
        />
        <button
          type="button"
          aria-pressed={compare}
          onClick={() => setCompare((c) => !c)}
          disabled={withScreenshots.length === 0}
          title={withScreenshots.length === 0 ? "No reference screenshots yet" : undefined}
          className={cn(
            "min-h-11 cursor-pointer rounded-full border border-pill-border px-4 text-ui-sm font-ui-sm disabled:cursor-not-allowed disabled:opacity-60",
            compare ? "bg-ink text-canvas" : "bg-surface text-ink",
          )}
        >
          Compare with source
        </button>
      </div>

      {/* User content sits on the stage (DESIGN.md). */}
      <section
        aria-label="Stage"
        className="flex flex-1 flex-col gap-4 rounded-xl border border-hairline bg-stage p-6"
      >
        {compare && shown ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <figure className="m-0 flex min-w-0 flex-col gap-2">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-ui-sm font-ui-sm text-ink-muted">
                Source
                {withScreenshots.length > 1 ? (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Source screenshot</span>
                    <select
                      value={shown.id}
                      onChange={(event) => setCompareRef(event.target.value)}
                      className="min-h-11 rounded-full border border-input-border bg-surface px-3 text-ui-sm font-ui-sm text-ink"
                    >
                      {withScreenshots.map((ref) => (
                        <option key={ref.id} value={ref.id}>
                          {hostOf(ref.url)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="text-token font-token">{hostOf(shown.url)}</span>
                )}
              </figcaption>
              <div
                tabIndex={0}
                aria-label={`Screenshot of ${hostOf(shown.url)}, scrollable`}
                className="max-h-[900px] overflow-y-auto rounded-lg border border-hairline bg-surface"
              >
                <img
                  src={shown.screenshot ?? ""}
                  alt={`Screenshot of ${hostOf(shown.url)}`}
                  className="block w-full"
                />
              </div>
            </figure>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-ui-sm font-ui-sm text-ink-muted">Your blend</span>
              {frame}
            </div>
          </div>
        ) : (
          frame
        )}
      </section>
    </Shell>
  );
}
