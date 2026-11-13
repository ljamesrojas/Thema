"use client";

import type { BlendSettings, BorrowTag } from "@thema/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A11yReport } from "./a11y-report";
import { AddReference } from "./add-reference";
import { api, ApiFailure } from "./api";
import {
  addReference,
  blendKey,
  blendRequest,
  browserStorage,
  claimTag,
  isLocked,
  loadProject,
  MAX_REFERENCES,
  newProject,
  readyReferences,
  removeReference,
  saveProject,
  swapCandidates,
  swapToken,
  toggleLock,
  updateReference,
  type WorkspaceProject,
} from "./project";
import { ReferenceCard } from "./reference-card";
import { Sliders } from "./sliders";
import { TokenPanel, type Theme, type TokenActions } from "./token-panel";
import { TopBar } from "./top-bar";

/** The Workspace: references, the blended system on the stage, sliders and the report. */
export function Workspace({
  initialUrl,
  pollMs = 1000,
  blendDelayMs = 150,
  onInitialUrlUsed,
}: {
  /** A site to add on arrival (the Landing's hero input sends /workspace?url=…). */
  initialUrl?: string;
  pollMs?: number;
  blendDelayMs?: number;
  /** Called once the initial URL has been handled, so the page can drop it from the address. */
  onInitialUrlUsed?: () => void;
}) {
  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [saved, setSaved] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blendError, setBlendError] = useState<string | null>(null);
  const [blending, setBlending] = useState(false);
  const latest = useRef<WorkspaceProject | null>(null);
  latest.current = project;
  const initialHandled = useRef(false);

  // Load the saved project, or start one (the API hands out the id).
  useEffect(() => {
    let cancelled = false;
    const stored = loadProject(browserStorage());
    if (stored) {
      setProject(stored);
      return;
    }
    api.createProject().then(
      ({ project: created }) => {
        if (!cancelled) setProject(newProject(created.id, created.updatedAt));
      },
      (failure: unknown) => {
        if (!cancelled) {
          setLoadError(failure instanceof Error ? failure.message : "Couldn't start a project.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Save on every change.
  useEffect(() => {
    if (project) setSaved(saveProject(browserStorage(), project));
  }, [project]);

  const add = useCallback(async (url: string) => {
    const current = latest.current;
    if (!current) throw new Error("The project isn't ready yet.");
    if (current.references.length >= MAX_REFERENCES) {
      throw new Error(`A blend takes up to ${MAX_REFERENCES} sites. Remove one to add another.`);
    }
    const borrowed: BorrowTag[] = [];
    const { reference } = await api.addReference(current.id, url, borrowed);
    // The same URL on the same day is the same reference (the API's cache).
    if (latest.current?.references.some((ref) => ref.id === reference.id)) {
      throw new Error("That site is already in this blend.");
    }
    setProject((p) => {
      const result = p ? addReference(p, reference) : null;
      return result?.ok ? result.project : p;
    });
  }, []);

  /** Run a failed extraction again: same URL, same reference, its borrow tags kept. */
  const retry = useCallback(async (url: string) => {
    const current = latest.current;
    if (!current) return;
    const { reference } = await api.addReference(current.id, url, []);
    setProject((p) => (p ? updateReference(p, reference) : p));
  }, []);

  // The Landing's URL, once the project exists.
  useEffect(() => {
    if (!project || initialHandled.current || !initialUrl) return;
    initialHandled.current = true;
    if (!project.references.some((ref) => ref.url === initialUrl)) {
      add(initialUrl).catch((failure: unknown) => {
        setLoadError(failure instanceof Error ? failure.message : "Couldn't add that site.");
      });
    }
    onInitialUrlUsed?.();
  }, [project, initialUrl, add, onInitialUrlUsed]);

  // Poll references that are still extracting.
  const pendingIds = (project?.references ?? [])
    .filter((ref) => ref.status === "queued" || ref.status === "running")
    .map((ref) => ref.id)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      for (const id of pendingIds.split(",")) {
        api.getReference(id, controller.signal).then(
          ({ reference }) => setProject((p) => (p ? updateReference(p, reference) : p)),
          () => undefined, // a missed poll is retried on the next tick
        );
      }
    }, pollMs);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [pendingIds, pollMs]);

  // Blend whenever an input changes: debounced, and a newer blend cancels an older one.
  const key = project ? blendKey(project) : "";
  const hasReady = project ? readyReferences(project).length > 0 : false;
  useEffect(() => {
    const current = latest.current;
    if (!current || !hasReady) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBlending(true);
      api.blend(current.id, blendRequest(latest.current ?? current), controller.signal).then(
        (response) => {
          setBlendError(null);
          setBlending(false);
          setProject((p) =>
            p
              ? {
                  ...p,
                  result: response.system,
                  report: {
                    generated: response.generated,
                    unresolved: response.unresolved,
                    lockedClashes: response.lockedClashes,
                    ignoredLocks: response.ignoredLocks,
                  },
                }
              : p,
          );
        },
        (failure: unknown) => {
          if (failure instanceof DOMException && failure.name === "AbortError") return;
          setBlending(false);
          setBlendError(failure instanceof ApiFailure ? failure.message : "The blend failed.");
        },
      );
    }, blendDelayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, hasReady, blendDelayMs]);

  const actions: TokenActions = useMemo(
    () => ({
      isLocked: (path) => (project ? isLocked(project, path) : false),
      onToggleLock: (path) => setProject((p) => (p ? toggleLock(p, path) : p)),
      candidates: (path) => (project ? swapCandidates(project, path) : []),
      onSwap: (path, value) => setProject((p) => (p ? swapToken(p, path, value) : p)),
    }),
    [project],
  );

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p
          role={loadError ? "alert" : "status"}
          className="m-0 text-body-md font-body-md text-ink-muted"
        >
          {loadError ?? "Opening your workspace…"}
        </p>
      </main>
    );
  }

  const full = project.references.length >= MAX_REFERENCES;
  const status = blendError ? (
    <span role="alert" className="text-ui-sm font-ui-sm text-danger">
      {blendError}
    </span>
  ) : (
    <span role="status" className="text-token font-token text-ink-subtle">
      {blending ? "Blending…" : ""}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar name={project.name} current="/workspace" saved={saved} />
      <main className="flex flex-1 flex-wrap items-start gap-5 px-6 pt-5 pb-8">
        <section
          aria-labelledby="refs-heading"
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 md:max-w-[340px]"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="refs-heading" className="m-0 text-label-md font-label-md font-semibold">
              References
            </h2>
            <span className="text-token font-token text-ink-muted">
              {project.references.length} / {MAX_REFERENCES}
            </span>
          </div>
          {loadError && (
            <p role="alert" className="m-0 text-ui-sm font-ui-sm text-danger">
              {loadError}
            </p>
          )}
          {project.references.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              onClaim={(tag) => setProject((p) => (p ? claimTag(p, reference.id, tag) : p))}
              onRemove={() => setProject((p) => (p ? removeReference(p, reference.id) : p))}
              onRetry={() => {
                retry(reference.url).catch((failure: unknown) =>
                  setLoadError(failure instanceof Error ? failure.message : "Retry failed."),
                );
              }}
            />
          ))}
          <AddReference
            onAdd={add}
            disabled={full}
            error={full ? `That's ${MAX_REFERENCES} sites, the most a blend takes.` : null}
          />
        </section>

        <TokenPanel
          project={project}
          theme={theme}
          onTheme={setTheme}
          actions={actions}
          status={status}
        />

        <aside
          aria-label="Blend controls"
          className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 md:max-w-[320px]"
        >
          <Sliders
            settings={project.blend}
            result={project.result}
            onChange={(blend: BlendSettings) => setProject((p) => (p ? { ...p, blend } : p))}
          />
          <A11yReport
            system={project.result}
            report={project.report}
            locks={project.locks}
            onUnlock={(path) => setProject((p) => (p ? toggleLock(p, path) : p))}
          />
          <a
            href="/preview"
            className="flex min-h-11 items-center justify-center rounded-full bg-ink px-4 text-label-md font-label-md text-canvas no-underline"
          >
            Preview on real pages →
          </a>
        </aside>
      </main>
    </div>
  );
}
