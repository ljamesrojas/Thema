"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";
import { PLANS } from "@/server/plans";
import type { ProjectSummary } from "@/server/project-store";
import { api } from "@/workspace/api";
import { browserStorage, hostOf, loadProject, saveProject, STORAGE_KEY } from "@/workspace/project";
import { AccountControls } from "./account-controls";
import { useAccount } from "./use-account";

/** The palette strip: the system's main colors, light theme. */
const STRIP = ["canvas", "surface", "primary", "accent", "ink"] as const;

const edited = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const hosts = project.urls.map(hostOf);
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface">
      <div aria-hidden="true" className="flex h-16 border-b border-hairline">
        {project.colors ? (
          STRIP.map((role) => (
            <span
              key={role}
              className="flex-1"
              style={{ background: project.colors?.[role] ?? "transparent" }}
            />
          ))
        ) : (
          <span className="flex flex-1 bg-stage" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="m-0 truncate text-label-md font-label-md font-semibold">{project.name}</h2>
        <p className="m-0 truncate text-ui-sm font-ui-sm text-ink-muted">
          {hosts.length ? hosts.join(" · ") : "No sites yet"}
        </p>
        <p className="m-0 text-token font-token text-ink-subtle">
          Edited {edited(project.updatedAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
        {confirming ? (
          <>
            <span className="text-ui-sm font-ui-sm text-ink">Delete for good?</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onDelete().catch(() => setBusy(false));
              }}
              className={buttonVariants({ variant: "secondary" })}
            >
              Delete {project.name}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Keep it
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Open ${project.name}`}
              onClick={onOpen}
              className={buttonVariants({ variant: "secondary" })}
            >
              Open
            </button>
            <button
              type="button"
              aria-label={`Delete ${project.name}`}
              onClick={() => setConfirming(true)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** Projects (SPEC → Screens, signed in): saved systems with their palette strips. */
export function ProjectsScreen() {
  const account = useAccount();
  const me = account.status === "ready" ? account.info.account : null;
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsavedHere, setUnsavedHere] = useState(false);

  const load = useCallback(() => {
    api.listProjects().then(
      ({ projects: list }) => setProjects(list),
      (failure: unknown) =>
        setError(failure instanceof Error ? failure.message : "Couldn't load your projects."),
    );
  }, []);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  useEffect(() => {
    const local = loadProject(browserStorage());
    setUnsavedHere(Boolean(local && !local.account && local.references.length > 0));
  }, []);

  async function open(id: string) {
    if (!me) return;
    try {
      const { project, version } = await api.getProject(id);
      saveProject(browserStorage(), { ...project, account: { userId: me.userId, version } });
      window.location.assign("/workspace");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't open that project.");
    }
  }

  async function remove(id: string) {
    await api.deleteProject(id);
    const storage = browserStorage();
    const local = loadProject(storage);
    if (local?.account && local.id === id) storage?.removeItem(STORAGE_KEY);
    setProjects((list) => list?.filter((p) => p.id !== id) ?? null);
  }

  function startNew() {
    const storage = browserStorage();
    // A project saved to the account stays there; only this browser's copy is cleared.
    if (loadProject(storage)?.account) storage?.removeItem(STORAGE_KEY);
    window.location.assign("/workspace");
  }

  const plan = me ? PLANS[me.plan] : null;
  const full = plan !== null && projects !== null && projects.length >= plan.savedProjects;

  let body;
  if (account.status === "loading" || (me && projects === null && !error)) {
    body = (
      <p role="status" className="m-0 text-body-md font-body-md text-ink-muted">
        Loading your projects…
      </p>
    );
  } else if (!me) {
    const enabled = account.status === "ready" && account.info.enabled;
    body = (
      <div className="flex max-w-[560px] flex-col items-start gap-4">
        <p className="m-0 text-body-lg font-body-lg text-ink-soft">
          {enabled
            ? "Sign in to save projects and open them on any device."
            : "Accounts aren't set up on this server. Your project is saved in this browser."}
        </p>
        <a
          href={enabled ? "/sign-in?next=%2Fprojects" : "/workspace"}
          className={buttonVariants({ variant: "secondary" })}
        >
          {enabled ? "Sign in" : "Go to the Workspace"}
        </a>
      </div>
    );
  } else {
    body = (
      <>
        {unsavedHere && (
          <p className="m-0 rounded-md border border-hairline bg-surface-subtle px-4 py-3 text-ui-sm font-ui-sm text-ink">
            The project open in this browser isn&apos;t saved to your account. Opening another
            project replaces it.
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-ui-sm font-ui-sm text-danger">
            {error}
          </p>
        )}
        {projects && projects.length === 0 ? (
          <div className="flex max-w-[560px] flex-col items-start gap-4">
            <p className="m-0 text-body-lg font-body-lg text-ink-soft">
              No saved projects yet. Add a site in the Workspace and it&apos;s saved here.
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => void open(project.id)}
                onDelete={() => remove(project.id)}
              />
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline bg-canvas">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <a href="/" aria-label="Thema home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </a>
          <span className="flex items-center gap-2">
            <a href="/workspace" className={buttonVariants({ variant: "ghost" })}>
              Workspace
            </a>
            <AccountControls account={account} next="/projects" />
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 pt-6 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-h2 font-h2">Projects</h1>
            {plan && projects && (
              <p className="m-0 text-body-md font-body-md text-ink-muted">
                {Number.isFinite(plan.savedProjects)
                  ? `${projects.length} of ${plan.savedProjects} saved · ${plan.label}`
                  : `${projects.length} saved · ${plan.label}`}
              </p>
            )}
          </div>
          {me && (
            <span className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={full}
                onClick={startNew}
                className={`${buttonVariants({ variant: "primary" })} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                New project
              </button>
              {full && plan && (
                <span className="text-ui-sm font-ui-sm text-ink-muted">
                  {plan.label} accounts keep {plan.savedProjects}. Delete one to start another.
                </span>
              )}
            </span>
          )}
        </div>
        {body}
      </main>
    </div>
  );
}
