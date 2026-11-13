// The Workspace's project, as the browser keeps it (anonymous projects live in the browser only,
// SPEC). Pure functions: every change returns a new project. The API is stateless, so this is
// what each blend sends.
import {
  MAX_REFERENCES,
  type BlendSettings,
  type BorrowTag,
  type ColorRole,
  type ExtractWarning,
  type ThemaSystem,
  type UnresolvedPair,
} from "@thema/engine";
import type { ExtractionStage, JobStatus } from "@thema/jobs";
import { z } from "zod";
import { BORROW_TAGS, themaSystemSchema } from "@/server/schemas";

export { BORROW_TAGS, MAX_REFERENCES };

export interface WorkspaceReference {
  id: string;
  url: string;
  status: JobStatus;
  stage?: ExtractionStage;
  borrowed: BorrowTag[];
  extracted?: ThemaSystem;
  warnings: ExtractWarning[];
  screenshot: string | null;
  error?: string;
}

/** What the last blend said besides the system (fix's and blend's reports). */
export interface BlendReport {
  generated: "light" | "dark" | null;
  unresolved: UnresolvedPair[];
  lockedClashes: string[];
  ignoredLocks: string[];
}

export interface WorkspaceProject {
  id: string;
  name: string;
  references: WorkspaceReference[];
  blend: BlendSettings;
  locks: string[];
  /** The last blend: shown in the token panel, and where locked values come from. */
  result?: ThemaSystem;
  report?: BlendReport;
  /** Bumped by edits a blend must pick up that don't show in the other fields (a swap). */
  revision: number;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: BlendSettings = { density: 0, roundness: 0, contrast: 0, warmth: 0 };

export function newProject(id: string, now: string): WorkspaceProject {
  return {
    id,
    name: "Untitled system",
    references: [],
    blend: { ...DEFAULT_SETTINGS },
    locks: [],
    revision: 0,
    updatedAt: now,
  };
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A reference as the API reports it (POST …/references, GET /api/references/:id). */
export interface ReferenceUpdate {
  id: string;
  url: string;
  status: JobStatus;
  stage?: ExtractionStage;
  system?: ThemaSystem;
  warnings: ExtractWarning[];
  screenshot: string | null;
  error?: string;
}

function merged(existing: WorkspaceReference, update: ReferenceUpdate): WorkspaceReference {
  const next: WorkspaceReference = {
    id: existing.id,
    url: existing.url,
    borrowed: existing.borrowed,
    status: update.status,
    warnings: update.warnings,
    screenshot: update.screenshot,
  };
  if (update.stage !== undefined) next.stage = update.stage;
  const extracted = update.system ?? existing.extracted;
  if (extracted) next.extracted = extracted;
  if (update.error !== undefined) next.error = update.error;
  return next;
}

export type AddResult =
  { ok: true; project: WorkspaceProject } | { ok: false; reason: "full" | "duplicate" };

/**
 * Add a reference. The first one owns every borrow tag (SPEC: "By default the first reference
 * owns every tag"); later ones start with none and claim tags from the others.
 */
export function addReference(project: WorkspaceProject, update: ReferenceUpdate): AddResult {
  if (project.references.some((ref) => ref.id === update.id)) {
    return { ok: false, reason: "duplicate" };
  }
  if (project.references.length >= MAX_REFERENCES) return { ok: false, reason: "full" };
  const borrowed = project.references.length === 0 ? [...BORROW_TAGS] : [];
  const blank: WorkspaceReference = {
    id: update.id,
    url: update.url,
    borrowed,
    status: update.status,
    warnings: [],
    screenshot: null,
  };
  const reference = merged(blank, update);
  return { ok: true, project: { ...project, references: [...project.references, reference] } };
}

/** Apply a status update from the API to the reference with that id. */
export function updateReference(
  project: WorkspaceProject,
  update: ReferenceUpdate,
): WorkspaceProject {
  return {
    ...project,
    references: project.references.map((ref) => (ref.id === update.id ? merged(ref, update) : ref)),
  };
}

/** Which reference owns a tag. Every tag always has exactly one owner while references exist. */
export function ownerOf(project: WorkspaceProject, tag: BorrowTag): WorkspaceReference | undefined {
  return project.references.find((ref) => ref.borrowed.includes(tag));
}

/**
 * Move a tag to a reference. A tag belongs to one reference at a time, so it leaves its previous
 * owner. Claiming a tag the reference already owns changes nothing.
 */
export function claimTag(
  project: WorkspaceProject,
  refId: string,
  tag: BorrowTag,
): WorkspaceProject {
  if (!project.references.some((ref) => ref.id === refId)) return project;
  return {
    ...project,
    references: project.references.map((ref) => {
      const without = ref.borrowed.filter((t) => t !== tag);
      const borrowed = ref.id === refId ? [...without, tag] : without;
      return { ...ref, borrowed: BORROW_TAGS.filter((t) => borrowed.includes(t)) };
    }),
  };
}

/** Remove a reference; its tags go back to the first remaining reference. */
export function removeReference(project: WorkspaceProject, refId: string): WorkspaceProject {
  const removed = project.references.find((ref) => ref.id === refId);
  if (!removed) return project;
  const rest = project.references.filter((ref) => ref.id !== refId);
  if (rest.length === 0) {
    const empty: WorkspaceProject = { ...project, references: [], locks: [] };
    delete empty.result;
    delete empty.report;
    return empty;
  }
  const [first, ...others] = rest;
  if (!first) return project; // unreachable: rest is not empty
  const inherited = BORROW_TAGS.filter(
    (tag) => first.borrowed.includes(tag) || removed.borrowed.includes(tag),
  );
  return { ...project, references: [{ ...first, borrowed: inherited }, ...others] };
}

/** The references a blend can use: finished, with a system. */
export const readyReferences = (project: WorkspaceProject) =>
  project.references.filter(
    (ref): ref is WorkspaceReference & { extracted: ThemaSystem } =>
      ref.status === "done" && ref.extracted !== undefined,
  );

// --- Locks and swaps ------------------------------------------------------------------------

export function getAt(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function withValueAt<T extends object>(root: T, path: string, value: unknown): T {
  const copy = structuredClone(root);
  const keys = path.split(".");
  const last = keys.pop();
  if (last === undefined) return copy;
  let node = copy as Record<string, unknown>;
  for (const key of keys) {
    const child = node[key];
    if (child === null || typeof child !== "object") return copy;
    node = child as Record<string, unknown>;
  }
  node[last] = value;
  return copy;
}

export const isLocked = (project: WorkspaceProject, path: string) => project.locks.includes(path);

/** Lock or unlock a token path. A locked token keeps the value from the last result. */
export function toggleLock(project: WorkspaceProject, path: string): WorkspaceProject {
  const locks = isLocked(project, path)
    ? project.locks.filter((p) => p !== path)
    : [...project.locks, path];
  return { ...project, locks };
}

/** Another reference's value for a token, offered as a swap. */
export interface SwapCandidate {
  refId: string;
  host: string;
  value: string | number;
}

/** The other finished references' values for a token, skipping ones equal to the current value. */
export function swapCandidates(project: WorkspaceProject, path: string): SwapCandidate[] {
  const current = getAt(project.result, path);
  return readyReferences(project).flatMap((ref) => {
    const value = getAt(ref.extracted, path);
    if ((typeof value !== "string" && typeof value !== "number") || value === current) return [];
    return [{ refId: ref.id, host: hostOf(ref.url), value }];
  });
}

/**
 * Swap = take the token from another reference, then lock it (SPEC). The value goes into the last
 * result, which blend reads locked values from.
 */
export function swapToken(
  project: WorkspaceProject,
  path: string,
  value: string | number,
): WorkspaceProject {
  if (!project.result) return project;
  return {
    ...project,
    result: withValueAt(project.result, path, value),
    locks: isLocked(project, path) ? project.locks : [...project.locks, path],
    revision: project.revision + 1,
  };
}

/** The lock path an unresolved pair is blocked by: the foreground, the color the fixer moves. */
export const pairLockPath = (pair: UnresolvedPair): string =>
  `color.${pair.theme}.${pair.pair[0] satisfies ColorRole}`;

// --- The blend request ----------------------------------------------------------------------

/** PATCH /api/projects/:id/blend's body: only finished references, with their systems. */
export function blendRequest(project: WorkspaceProject) {
  return {
    project: {
      id: project.id,
      references: readyReferences(project).map(({ id, url, borrowed, extracted }) => ({
        id,
        url,
        borrowed,
        extracted,
      })),
      blend: project.blend,
      ...(project.result ? { result: project.result } : {}),
    },
    locks: project.locks,
    name: project.name,
  };
}

/** Changes when anything a blend depends on changes (not the result it returns). */
export function blendKey(project: WorkspaceProject): string {
  return JSON.stringify([
    readyReferences(project).map((ref) => [ref.id, ref.borrowed]),
    project.blend,
    project.locks,
    project.revision,
  ]);
}

// --- Saved in the browser -------------------------------------------------------------------

export const STORAGE_KEY = "thema.project.v1";

const storedSchema = z.object({
  id: z.uuid(),
  name: z.string().max(120),
  references: z
    .array(
      z.object({
        id: z.string().regex(/^[0-9a-f]{24}$/),
        url: z.string().max(2048),
        status: z.enum(["queued", "running", "done", "failed"]),
        stage: z.enum(["fetching", "reading", "naming"]).optional(),
        borrowed: z.array(z.enum(BORROW_TAGS)),
        extracted: themaSystemSchema.optional(),
        warnings: z.array(z.enum(["no-headings", "few-samples", "no-dark-theme", "monochrome"])),
        screenshot: z.string().max(2048).nullable(),
        error: z.string().max(500).optional(),
      }),
    )
    .max(MAX_REFERENCES),
  blend: z.object({
    density: z.number().min(-1).max(1),
    roundness: z.number().min(-1).max(1),
    contrast: z.number().min(-1).max(1),
    warmth: z.number().min(-1).max(1),
  }),
  locks: z.array(z.string().max(80)).max(200),
  result: themaSystemSchema.optional(),
  revision: z.number().int().min(0),
  updatedAt: z.string().max(40),
});

/** The saved project, or null when there is none, it's unreadable, or storage is blocked. */
export function loadProject(
  storage: Pick<Storage, "getItem"> | undefined,
): WorkspaceProject | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Save the project. The report isn't saved: the next blend recomputes it. */
export function saveProject(
  storage: Pick<Storage, "setItem"> | undefined,
  project: WorkspaceProject,
): boolean {
  try {
    const saved: WorkspaceProject = { ...project };
    delete saved.report;
    storage?.setItem(STORAGE_KEY, JSON.stringify(saved));
    return storage !== undefined;
  } catch {
    return false;
  }
}

/** localStorage, or undefined where it's missing or blocked (private mode, sandboxed previews). */
export function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
