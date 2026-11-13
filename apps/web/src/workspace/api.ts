// Typed calls to Thema's API (apps/web/src/app/api). Errors come back as ApiFailure with the
// API's code and a message for people.
import type { BorrowTag, ThemaSystem, UnresolvedPair } from "@thema/engine";
import type { ReferenceView } from "@/server/references";
import type { blendRequest } from "./project";

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
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
    (T & { error?: undefined }) | { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const error = data && "error" in data ? data.error : undefined;
    throw new ApiFailure(
      error?.code ?? "unknown",
      error?.message ?? "Something went wrong. Try again.",
      response.status,
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
};
