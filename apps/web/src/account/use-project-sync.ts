"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ProjectData } from "@/server/project-schema";
import { api, ApiFailure } from "@/workspace/api";
import { newProject, type WorkspaceProject } from "@/workspace/project";

export type SyncStatus =
  /** Signed out or accounts off: the project lives in this browser only. */
  | "local"
  /** Signed in, nothing to save yet (no site added). */
  | "pending"
  | "saving"
  | "saved"
  /** A newer version was saved elsewhere; saving stops until the latest is loaded. */
  | "conflict"
  /** The plan's saved-project limit: this project stays in the browser. */
  | "limit"
  /** Couldn't reach Thema; the next change tries again. */
  | "error";

/** What goes to the account: no blend report, sync info or transient progress stage. */
export function toSaved(project: WorkspaceProject): ProjectData {
  const data: ProjectData = {
    id: project.id,
    name: project.name,
    references: project.references.map((ref) => {
      const saved = { ...ref };
      delete saved.stage;
      return saved;
    }),
    blend: project.blend,
    locks: project.locks,
    revision: project.revision,
    updatedAt: project.updatedAt,
  };
  if (project.result) data.result = project.result;
  return data;
}

const signature = (data: ProjectData) => JSON.stringify(data);

/**
 * Keep the Workspace's project in the signed-in account: claim it once it has a site, then
 * save `delayMs` after each change, on the version last synced (a stale save is refused).
 * `userId`: undefined while the account is loading, null when signed out.
 */
export function useProjectSync({
  project,
  setProject,
  userId,
  delayMs = 1000,
}: {
  project: WorkspaceProject | null;
  setProject: Dispatch<SetStateAction<WorkspaceProject | null>>;
  userId: string | null | undefined;
  delayMs?: number;
}) {
  const [status, setStatus] = useState<SyncStatus>("local");
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(project);
  latest.current = project;
  /** Signature of what the account has, so a version bump alone doesn't save again. */
  const savedSig = useRef<string | null>(null);
  const busy = useRef(false);
  /** Bumped when a save finishes, so changes made meanwhile are saved next. */
  const [tick, setTick] = useState(0);
  const stopped = useRef<"conflict" | "limit" | null>(null);

  const fail = useCallback((failure: unknown) => {
    const text = failure instanceof Error ? failure.message : "Couldn't save to your account.";
    if (failure instanceof ApiFailure && failure.code === "conflict") {
      stopped.current = "conflict";
      setStatus("conflict");
    } else if (failure instanceof ApiFailure && failure.code === "project-limit") {
      stopped.current = "limit";
      setStatus("limit");
    } else {
      setStatus("error");
    }
    setMessage(text);
  }, []);

  useEffect(() => {
    if (!project || userId === undefined) return;
    if (userId === null) {
      setStatus("local");
      return;
    }
    // A project another account saved in this browser: start a fresh one instead.
    if (project.account && project.account.userId !== userId) {
      api
        .createProject()
        .then(
          ({ project: created }) => setProject(newProject(created.id, created.updatedAt)),
          fail,
        );
      return;
    }
    if (stopped.current) return;
    if (!project.account && project.references.length === 0) {
      setStatus("pending");
      return;
    }
    const sig = signature(toSaved(project));
    if (project.account && sig === savedSig.current) {
      setStatus("saved");
      return;
    }

    const timer = setTimeout(
      () => {
        const current = latest.current;
        if (!current || busy.current || stopped.current) return;
        const data = toSaved(current);
        busy.current = true;
        setStatus("saving");
        const done = (id: string, version: number) => {
          savedSig.current = signature({ ...data, id });
          setProject((p) =>
            p && (p.id === data.id || p.id === id) ? { ...p, id, account: { userId, version } } : p,
          );
          setStatus("saved");
          setMessage(null);
        };
        const request = current.account
          ? api.saveProject(data, current.account.version).then((r) => done(data.id, r.version))
          : api.claimProject(data).then((r) => done(r.project.id, r.project.version));
        request.catch(fail).finally(() => {
          busy.current = false;
          setTick((t) => t + 1);
        });
      },
      project.account ? delayMs : 0,
    );
    return () => clearTimeout(timer);
  }, [project, userId, delayMs, setProject, fail, tick]);

  /** After a conflict: load the account's latest version over this browser's copy. */
  const reload = useCallback(async () => {
    const current = latest.current;
    if (!current || !userId) return;
    const { project: data, version } = await api.getProject(current.id);
    savedSig.current = signature(data);
    stopped.current = null;
    setProject({ ...data, account: { userId, version } });
    setStatus("saved");
    setMessage(null);
  }, [userId, setProject]);

  return { status, message, reload };
}
