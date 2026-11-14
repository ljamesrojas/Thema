// What the CLI and the MCP server do, in one place: extract a site (in a local browser, or through
// a Thema API), blend and fix systems, export files, and summarize a system in a few lines. The
// token values all come from @thema/engine and @thema/exporters, exactly as in the web app.
import { readFile, writeFile } from "node:fs/promises";
import {
  blend,
  CHECKED_PAIRS,
  fix,
  type BlendSettings,
  type BorrowTag,
  type ColorAdjustment,
  type ExtractWarning,
  type ThemaSystem,
  type UnresolvedPair,
} from "@thema/engine";
import { exportAll, toHex } from "@thema/exporters";
import type { ExtractionOutput } from "@thema/jobs";
import { themaSystemSchema } from "@thema/schema";
import { BlockedUrlError } from "@thema/url-guard";
import { wcagContrast } from "culori";

export { BlockedUrlError };
export type { ExtractionOutput };

/** A user-facing failure: bad input, a file that isn't a system, a failed extraction. */
export class ThemaError extends Error {
  override name = "ThemaError";
}

// --- Extraction -----------------------------------------------------------------------------

/** Turns a URL into a system: the worker's browser locally, or a Thema API. */
export interface Extractor {
  readonly kind: "local" | "api";
  extract(url: string): Promise<ExtractionOutput>;
}

/**
 * Extraction on this machine: the worker's Playwright browser, behind the same SSRF guard as the
 * hosted worker. Needs Chromium once: `pnpm --filter @thema/worker exec playwright install chromium`.
 */
export function localExtractor(now: () => Date = () => new Date()): Extractor {
  return {
    kind: "local",
    async extract(url) {
      const { runExtraction } = await import("@thema/worker/job");
      return runExtraction(url, { now });
    },
  };
}

interface ApiReference {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  system?: unknown;
  warnings?: ExtractWarning[];
  derived?: string[];
  error?: string;
  screenshot?: string | null;
}

/**
 * Extraction through a Thema API (apps/web's routes): create a project, add the URL, poll until
 * it's done, then fetch the screenshot. The API applies its own SSRF guard, cache and limits.
 */
export function apiExtractor(
  baseUrl: string,
  options: { fetch?: typeof fetch; pollMs?: number; timeoutMs?: number } = {},
): Extractor {
  const request = options.fetch ?? fetch;
  const pollMs = options.pollMs ?? 1_000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const base = baseUrl.replace(/\/+$/, "");

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await request(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json" },
    });
    const data = (await response.json().catch(() => null)) as
      (T & { error?: { code?: string; message?: string } }) | null;
    if (!response.ok) {
      const message = data?.error?.message ?? `The Thema API answered ${response.status}.`;
      // The API names a URL its SSRF guard refused with the code "blocked-url".
      throw data?.error?.code === "blocked-url"
        ? new BlockedUrlError(message)
        : new ThemaError(message);
    }
    if (data === null) throw new ThemaError("The Thema API sent an unreadable answer.");
    return data;
  }

  return {
    kind: "api",
    async extract(url) {
      const { project } = await call<{ project: { id: string } }>("/api/projects", {
        method: "POST",
      });
      let { reference } = await call<{ reference: ApiReference }>(
        `/api/projects/${project.id}/references`,
        { method: "POST", body: JSON.stringify({ url, borrowed: [] }) },
      );
      const started = Date.now();
      while (reference.status === "queued" || reference.status === "running") {
        if (Date.now() - started > timeoutMs) throw new ThemaError(`Timed out extracting ${url}.`);
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        ({ reference } = await call<{ reference: ApiReference }>(
          `/api/references/${reference.id}`,
        ));
      }
      if (reference.status === "failed") {
        throw new ThemaError(reference.error ?? `The extraction of ${url} failed.`);
      }
      const system = parseSystem(reference.system, "the API's answer");
      let screenshot = new Uint8Array();
      if (reference.screenshot) {
        const image = await request(`${base}${reference.screenshot}`);
        if (image.ok) screenshot = new Uint8Array(await image.arrayBuffer());
      }
      return {
        url: system.meta.sources[0]?.url ?? url,
        system,
        warnings: reference.warnings ?? [],
        derived: reference.derived ?? [],
        screenshot,
      };
    },
  };
}

/** THEMA_API_URL set → the API; otherwise this machine's browser. */
export function extractorFromEnv(env: Record<string, string | undefined>): Extractor {
  const api = env.THEMA_API_URL?.trim();
  return api ? apiExtractor(api) : localExtractor();
}

// --- Systems in and out ---------------------------------------------------------------------

/** Validate unknown JSON as a ThemaSystem, with the first problem in the message. */
export function parseSystem(data: unknown, where: string): ThemaSystem {
  const parsed = themaSystemSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "(root)";
    throw new ThemaError(`${where} isn't a Thema system: ${path}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}

export async function readSystemFile(path: string): Promise<ThemaSystem> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new ThemaError(`Can't read ${path}.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ThemaError(`${path} isn't valid JSON.`);
  }
  return parseSystem(data, path);
}

export const writeSystemFile = (path: string, system: ThemaSystem) =>
  writeFile(path, `${JSON.stringify(system, null, 2)}\n`);

// --- Blend ----------------------------------------------------------------------------------

export const BORROW_TAGS: readonly BorrowTag[] = [
  "colors",
  "typography",
  "spacing",
  "shape",
  "layout",
];

export interface BlendRef {
  system: ThemaSystem;
  borrowed: BorrowTag[];
}

export interface BlendOutcome {
  system: ThemaSystem;
  generated: "light" | "dark" | null;
  unresolved: UnresolvedPair[];
  adjustments: ColorAdjustment[];
  lockedClashes: string[];
  ignoredLocks: string[];
}

/** blend → fix, as the web app's blend route does. Tags nobody claims go to the first reference. */
export function blendAndFix(input: {
  references: BlendRef[];
  settings?: Partial<BlendSettings>;
  locks?: string[];
  previous?: ThemaSystem;
  name?: string;
  now?: () => Date;
}): BlendOutcome {
  if (input.references.length === 0) throw new ThemaError("Blend needs at least one system.");
  if (input.references.length > 5) throw new ThemaError("Blend takes at most 5 systems.");
  const settings: BlendSettings = { density: 0, roundness: 0, contrast: 0, warmth: 0 };
  for (const key of Object.keys(settings) as (keyof BlendSettings)[]) {
    const value = input.settings?.[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new ThemaError(`${key} must be between -1 and 1, got ${value}.`);
    }
    settings[key] = value;
  }
  const blended = blend({
    references: input.references,
    settings,
    locks: input.locks ?? [],
    ...(input.previous ? { previous: input.previous } : {}),
    name: input.name ?? "Thema blend",
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
  });
  const fixed = fix(blended.system);
  return {
    system: fixed.system,
    generated: fixed.generated,
    unresolved: fixed.unresolved,
    adjustments: blended.adjustments,
    lockedClashes: blended.lockedClashes,
    ignoredLocks: blended.ignoredLocks,
  };
}

// --- Export ---------------------------------------------------------------------------------

/** Export formats by name, as the web API names them, and the file each writes. */
export const FORMATS = {
  "design-md": "DESIGN.md",
  tailwind: "theme.css",
  shadcn: "shadcn.css",
  dtcg: "tokens.json",
  styleguide: "style-guide.html",
} as const;
export type Format = keyof typeof FORMATS;

/** The export files for a system: one format, or every format with "all". */
export function exportFiles(system: ThemaSystem, format: Format | "all"): Record<string, string> {
  const files = exportAll(system);
  if (format === "all") return files;
  const name = FORMATS[format];
  return { [name]: files[name] ?? "" };
}

// --- Summary --------------------------------------------------------------------------------

/** A system in a few lines: what an agent or a terminal needs, without 5 KB of JSON. */
export function summarize(system: ThemaSystem, warnings: readonly ExtractWarning[] = []) {
  const light = system.color.light;
  const passing = (theme: "light" | "dark") =>
    CHECKED_PAIRS.filter(
      ({ fg, bg, min }) => wcagContrast(system.color[theme][fg], system.color[theme][bg]) >= min,
    ).length;
  return {
    name: system.meta.name,
    sources: system.meta.sources.map((s) => ({ url: s.url, borrowed: s.borrowed })),
    colors: {
      canvas: toHex(light.canvas),
      ink: toHex(light.ink),
      primary: toHex(light.primary),
      accent: toHex(light.accent),
      muted: toHex(light["ink-muted"]),
    },
    fonts: system.typography.families,
    spacingBase: system.spacing.base,
    radius: system.radius.md,
    contrast: {
      light: `${passing("light")}/${CHECKED_PAIRS.length}`,
      dark: `${passing("dark")}/${CHECKED_PAIRS.length}`,
    },
    warnings: [...warnings],
  };
}

/** extractSystem's warnings in words for people. */
export const WARNING_TEXT: Record<ExtractWarning, string> = {
  "no-headings": "No headings found: this may be a variant or placeholder page.",
  "few-samples": "Very little to read: the page may be blocked or nearly empty.",
  monochrome: "No brand color: the main button's gray is used as primary.",
  "no-dark-theme": "No dark theme: one is generated when you blend.",
};
