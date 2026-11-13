// Small helpers shared by the API routes: JSON bodies with a size cap and schema check, and one
// error shape, { error: { code, message } }.
import type { z } from "zod";

/** Largest request body accepted: 5 extracted systems plus the previous blend fit in ~60 KB. */
export const MAX_BODY_BYTES = 1_000_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...init.headers },
  });
}

/** Read and validate a JSON body. Bodies come from the browser, so nothing is trusted. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw tooLarge();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid-json", "The request body isn't valid JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = issues[0];
    throw new ApiError(
      400,
      "invalid-body",
      first ? `Invalid request: ${first.path || "body"}: ${first.message}` : "Invalid request.",
      {},
      issues,
    );
  }
  return parsed.data;
}

const tooLarge = () =>
  new ApiError(413, "too-large", `The request body is over ${MAX_BODY_BYTES} bytes.`);

/** Wrap a route handler: ApiErrors become their response; anything else is a logged 500. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          },
          { status: error.status, headers: error.headers },
        );
      }
      console.error(error);
      return json(
        { error: { code: "internal", message: "Something went wrong on our side." } },
        { status: 500 },
      );
    }
  };
}

/** Next.js passes dynamic route params as a promise. */
export interface IdParams {
  params: Promise<{ id: string }>;
}
