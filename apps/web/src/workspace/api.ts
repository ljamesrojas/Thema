// Typed calls to Thema's API (apps/web/src/app/api). Errors come back as ApiFailure with the
// API's code and a message for people.
import type { BorrowTag, ThemaSystem, UnresolvedPair } from "@thema/engine";
import type { Provider } from "@/server/auth";
import type { Plan } from "@/server/plans";
import type { ProjectData } from "@/server/project-schema";
import type { ProjectSummary } from "@/server/project-store";
import type { ReferenceView } from "@/server/references";
import { withLocalTimes } from "@/lib/local-time";
import type { blendRequest } from "./project";

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** GET /api/account. */
export interface AccountInfo {
  enabled: boolean;
  providers: Provider[];
  account: { userId: string; name: string; email: string; image: string | null; plan: Plan } | null;
  limits: { dailyExtractions: number; savedProjects?: number | null; saved?: number };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiFailure("network", "Can't reach Thema. Check your connection and try again.", 0);
  }
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;
  if (!response.ok) {
    const error = data && "error" in data ? data.error : undefined;
    throw new ApiFailure(
      error?.code ?? "unknown",
      withLocalTimes(error?.message ?? "Something went wrong. Try again."),
      response.status,
      error?.details,
    );
  }
  return data as T;
}

export interface BlendResponse {
  system: ThemaSystem;
  generated: "light" | "dark" | null;
  unresolved: UnresolvedPair[];
  adjustments: { path: string; before: string; after: string }[];
  lockedClashes: string[];
  ignoredLocks: string[];
}

export const api = {
  createProject: () =>
    call<{ project: { id: string; updatedAt: string } }>("/api/projects", { method: "POST" }),

  addReference: (projectId: string, url: string, borrowed: BorrowTag[]) =>
    call<{ reference: ReferenceView; cached: boolean }>(`/api/projects/${projectId}/references`, {
      method: "POST",
      body: JSON.stringify({ url, borrowed }),
    }),

  getReference: (id: string, signal?: AbortSignal) =>
    call<{ reference: ReferenceView }>(`/api/references/${id}`, signal ? { signal } : {}),

  blend: (projectId: string, body: ReturnType<typeof blendRequest>, signal?: AbortSignal) =>
    call<BlendResponse>(`/api/projects/${projectId}/blend`, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    }),

  account: () => call<AccountInfo>("/api/account"),

  listProjects: () => call<{ projects: ProjectSummary[] }>("/api/projects"),

  /** Save the browser's project to the account (once: claiming again returns "exists"). */
  claimProject: (project: ProjectData) =>
    call<{ status: "created" | "exists"; project: { id: string; version: number } }>(
      "/api/projects",
      { method: "POST", body: JSON.stringify({ project }) },
    ),

  getProject: (id: string) =>
    call<{ project: ProjectData; version: number; updatedAt: string }>(`/api/projects/${id}`),

  saveProject: (project: ProjectData, baseVersion: number) =>
    call<{ version: number; updatedAt: string }>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify({ project, baseVersion }),
    }),

  /**
   * Count an export made in the browser (anonymous daily totals). Fire and forget: `keepalive`
   * lets it finish if the page is closing, and a failure never bothers the person exporting.
   */
  exported: (projectId: string) => {
    void fetch(`/api/projects/${projectId}/exported`, { method: "POST", keepalive: true }).catch(
      () => undefined,
    );
  },

  /** Delete the signed-in account and everything saved in it. */
  deleteAccount: () => call<{ deleted: true }>("/api/account", { method: "DELETE" }),

  deleteProject: (id: string) =>
    call<{ deleted: string }>(`/api/projects/${id}`, { method: "DELETE" }),
};
