// Thema's MCP server: three tools so an AI coding agent can create or update a design system
// mid-task (SPEC → MVP scope). Systems live in this server's memory by id, so an agent passes
// a short id around instead of 5 KB of JSON; `*_path` arguments read and write ThemaSystem JSON
// files (thema.json, e.g. from the web app's Export screen) for work that outlives the session.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ExtractWarning, ThemaSystem } from "@thema/engine";
import { toDesignMd } from "@thema/exporters";
import {
  blendAndFix,
  BORROW_TAGS,
  extractorFromEnv,
  readSystemFile,
  summarize,
  ThemaError,
  WARNING_TEXT,
  writeSystemFile,
  type Extractor,
} from "@thema/cli/core";
import { normalizeUrl } from "@thema/url-guard";
import { z } from "zod";

export interface ThemaServerOptions {
  /** Where extract runs. Defaults to THEMA_API_URL's API, else this machine's browser. */
  extractor?: Extractor;
  /** Relative `*_path` arguments resolve against this. */
  cwd?: string;
  now?: () => Date;
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [
    { type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) },
  ],
});

const fail = (error: unknown): ToolResult => {
  const message =
    error instanceof Error ? (error.message.split("\n")[0] ?? error.message) : String(error);
  const blocked = error instanceof Error && error.name === "BlockedUrlError";
  return {
    isError: true,
    content: [{ type: "text", text: blocked ? `Blocked: ${message}` : message }],
  };
};

const systemRef = {
  system_id: z.string().max(40).optional().describe("An id returned by extract or blend."),
  system_path: z
    .string()
    .max(1024)
    .optional()
    .describe("A ThemaSystem JSON file, e.g. thema.json from Thema's Export screen."),
};

export function createThemaServer(options: ThemaServerOptions = {}): McpServer {
  const extractor = options.extractor ?? extractorFromEnv(process.env);
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const systems = new Map<string, { system: ThemaSystem; warnings: ExtractWarning[] }>();
  let next = 0;

  const store = (system: ThemaSystem, warnings: ExtractWarning[] = []) => {
    next += 1;
    const id = `sys_${next}`;
    systems.set(id, { system, warnings });
    return id;
  };

  async function load(ref: { system_id?: string | undefined; system_path?: string | undefined }) {
    if (ref.system_id) {
      const found = systems.get(ref.system_id);
      if (!found) throw new ThemaError(`No system "${ref.system_id}" in this session.`);
      return found.system;
    }
    if (ref.system_path) return readSystemFile(resolve(cwd, ref.system_path));
    throw new ThemaError("Give a system_id or a system_path.");
  }

  const described = (id: string, system: ThemaSystem, warnings: ExtractWarning[] = []) => ({
    system_id: id,
    ...summarize(system, warnings),
    warnings: warnings.map((w) => WARNING_TEXT[w]),
  });

  const server = new McpServer({ name: "thema", version: "0.1.0" });

  server.registerTool(
    "extract",
    {
      title: "Extract a site's design system",
      description:
        "Load a public website in a browser and measure its design tokens (colors, type, spacing, radius, shadows, layout). Returns a system_id for blend and get_design_md, a short summary and any warnings. Local and private addresses are refused.",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .max(2048)
          .describe("The site, e.g. https://example.com or example.com."),
        out_path: z.string().max(1024).optional().describe("Also save the system as JSON here."),
      },
    },
    async ({ url, out_path }) => {
      try {
        const output = await extractor.extract(normalizeUrl(url));
        const id = store(output.system, output.warnings);
        if (out_path) await writeSystemFile(resolve(cwd, out_path), output.system);
        return ok(described(id, output.system, output.warnings));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "blend",
    {
      title: "Blend systems into one",
      description:
        "Blend 1-5 systems: each reference lends the parts named in borrowed (colors, typography, spacing, shape, layout; unclaimed parts come from the first). Sliders go from -1 to 1. Then every text and background pair is fixed to WCAG AA and a missing dark or light theme is generated. locks keep a token (e.g. color.light.primary) at its value in the previous system. Returns a new system_id, a summary, and pairs that couldn't be fixed.",
      inputSchema: {
        references: z
          .array(z.object({ ...systemRef, borrowed: z.array(z.enum(BORROW_TAGS)).default([]) }))
          .min(1)
          .max(5),
        density: z
          .number()
          .min(-1)
          .max(1)
          .optional()
          .describe("Spacing: -1 compact (0.8×) … 1 airy (1.25×)."),
        roundness: z.number().min(-1).max(1).optional().describe("Radius: -1 square … 1 pill."),
        contrast: z
          .number()
          .min(-1)
          .max(1)
          .optional()
          .describe("Ink and canvas lightness apart (1) or together (-1)."),
        warmth: z
          .number()
          .min(-1)
          .max(1)
          .optional()
          .describe("Neutrals toward cool (-1) or warm (1)."),
        locks: z.array(z.string().max(80)).max(200).optional(),
        previous_system_id: z
          .string()
          .max(40)
          .optional()
          .describe("The system locked values come from."),
        previous_path: z.string().max(1024).optional(),
        name: z.string().max(120).optional(),
        out_path: z.string().max(1024).optional().describe("Also save the result as JSON here."),
      },
    },
    async (input) => {
      try {
        const references = await Promise.all(
          input.references.map(async (ref) => ({
            system: await load(ref),
            borrowed: ref.borrowed,
          })),
        );
        const previous =
          input.previous_system_id || input.previous_path
            ? await load({ system_id: input.previous_system_id, system_path: input.previous_path })
            : undefined;
        const settings = Object.fromEntries(
          (["density", "roundness", "contrast", "warmth"] as const)
            .filter((key) => input[key] !== undefined)
            .map((key) => [key, input[key]]),
        );
        const outcome = blendAndFix({
          references,
          settings,
          locks: input.locks ?? [],
          ...(previous ? { previous } : {}),
          ...(input.name ? { name: input.name } : {}),
          now,
        });
        const id = store(outcome.system);
        if (input.out_path) await writeSystemFile(resolve(cwd, input.out_path), outcome.system);
        return ok({
          ...described(id, outcome.system),
          contrast_fixes: outcome.system.a11y.fixes.length,
          generated_theme: outcome.generated,
          unresolved: outcome.unresolved.map((p) => ({
            pair: `${p.pair[0]} on ${p.pair[1]}`,
            theme: p.theme,
            ratio: Math.round(p.ratio * 100) / 100,
            min: p.min,
            reason: p.reason === "locked" ? "locked, can't fix" : "no lightness passes",
          })),
          ignored_locks: outcome.ignoredLocks,
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_design_md",
    {
      title: "Get DESIGN.md",
      description:
        "The DESIGN.md for a system: tokens plus plain-language rules an agent follows. Give out_path to write it (e.g. DESIGN.md in the repo root).",
      inputSchema: {
        ...systemRef,
        out_path: z.string().max(1024).optional().describe("Write the file here as well."),
      },
    },
    async ({ system_id, system_path, out_path }) => {
      try {
        const designMd = toDesignMd(await load({ system_id, system_path }));
        if (out_path) await writeFile(resolve(cwd, out_path), designMd);
        return ok(out_path ? `Wrote ${out_path}.\n\n${designMd}` : designMd);
      } catch (error) {
        return fail(error);
      }
    },
  );

  return server;
}
