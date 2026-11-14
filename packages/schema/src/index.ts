// @thema/schema: one set of zod schemas for everything that reads a ThemaSystem it didn't make,
// the web API's request bodies, the MCP server's tool inputs and the CLI's JSON files, so they
// all validate the same way. Nothing read from outside is trusted. The schemas mirror
// packages/engine/src/types.ts; test/schema.test.ts fails at compile time if they drift apart.
import {
  MAX_REFERENCES,
  parseCssColor,
  type BorrowTag,
  type ColorRole,
  type ThemaSystem,
} from "@thema/engine";
import { z } from "zod";

export const COLOR_ROLES = [
  "canvas",
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "hairline",
  "primary",
  "primary-ink",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
] as const satisfies readonly ColorRole[];

export const BORROW_TAGS = [
  "colors",
  "typography",
  "spacing",
  "shape",
  "layout",
] as const satisfies readonly BorrowTag[];

const SCALE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;

/**
 * Text that ends up in CSS, Markdown (MDX) and HTML exports: no angle brackets, braces,
 * semicolons, backslashes, backticks or line breaks, so a value can't close the block it's in.
 */
const SAFE_TEXT = /^[^<>{};\\`\r\n]*$/;
const text = (max: number) =>
  z.string().max(max).regex(SAFE_TEXT, "contains a character that isn't allowed");

/** An OKLCH color as the engine writes it, e.g. "oklch(0.62 0.19 259)". */
const color = z
  .string()
  .max(64)
  .regex(/^oklch\([\d.\s/%-]+\)$/, "must be an oklch() color")
  .refine((value) => parseCssColor(value) !== null, "must be a valid oklch() color");

const px = z.number().min(0).max(10_000);
const role = z.enum(COLOR_ROLES);
const palette = z.record(role, color);
const borrowTag = z.enum(BORROW_TAGS);
const borrowed = z.array(borrowTag).max(BORROW_TAGS.length);

/** A token path as blend's locks name them, e.g. "color.light.primary" or "radius.md". */
export const lockPath = z
  .string()
  .max(80)
  .regex(/^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)*$/, "must be a token path like color.light.primary");

const sourceRef = z.object({
  url: z.string().max(2048),
  borrowed,
  screenshot: z.string().max(2048),
});

const contrastFix = z.object({
  pair: z.tuple([role, role]),
  theme: z.enum(["light", "dark"]),
  before: z.number().min(0).max(21),
  after: z.number().min(0).max(21),
});

const family = text(120).min(1);

export const themaSystemSchema = z.object({
  meta: z.object({
    name: text(120),
    version: text(40),
    sources: z.array(sourceRef).max(MAX_REFERENCES),
    createdAt: text(40),
  }),
  color: z.object({ light: palette, dark: palette }),
  typography: z.object({
    families: z.object({
      sans: family,
      serif: family.optional(),
      mono: family.optional(),
      display: family.optional(),
      heading: family.optional(),
    }),
    scale: z
      .array(
        z.object({
          name: z.enum(SCALE_NAMES),
          size: z.number().positive().max(1_000),
          lineHeight: z.number().min(0).max(10),
          weight: z.number().min(1).max(1_000),
          tracking: z.number().min(-1).max(1),
        }),
      )
      .max(SCALE_NAMES.length),
    ratio: z.number().min(0).max(10),
  }),
  spacing: z.object({
    base: z.union([z.literal(4), z.literal(8)]),
    scale: z.array(px).max(64),
  }),
  radius: z.object({ sm: px, md: px, lg: px, full: z.literal(9999) }),
  shadow: z.object({ sm: text(500), md: text(500), lg: text(500) }),
  layout: z.object({ containerMax: px, gutter: px, sectionY: px }),
  motion: z.object({
    durationFast: z.number().min(0).max(10_000),
    durationBase: z.number().min(0).max(10_000),
    easing: text(100),
  }),
  voice: z.object({ mood: z.array(text(40)).max(10), summary: text(2_000) }),
  a11y: z.object({ fixes: z.array(contrastFix).max(200), passes: z.boolean() }),
  locks: z.array(lockPath).max(200),
});

/** Kept so the compile-time check in the tests can name it. */
export type ParsedSystem = z.output<typeof themaSystemSchema>;
export type { ThemaSystem };

export const projectId = z.uuid();
export const referenceId = z.string().regex(/^[0-9a-f]{24}$/, "must be a reference id");

const setting = z.number().min(-1).max(1);

// --- Bodies -------------------------------------------------------------------------------

/** POST /api/projects/:id/references */
export const addReferenceBody = z.object({
  url: z.string().trim().min(1, "paste a website address").max(2048),
  borrowed: borrowed.default([]),
});

/**
 * PATCH /api/projects/:id/blend: the project as the browser keeps it. Each reference carries its
 * extracted system (from GET /api/references/:id); `result` is the last blend, which locks take
 * their values from. Other fields the client keeps (status, error, updatedAt) are ignored.
 */
export const blendBody = z.object({
  project: z.object({
    id: projectId,
    references: z
      .array(
        z.object({
          id: referenceId,
          url: z.string().max(2048),
          borrowed,
          extracted: themaSystemSchema.optional(),
        }),
      )
      .min(1, "add a reference first")
      .max(MAX_REFERENCES, `at most ${MAX_REFERENCES} references`),
    blend: z.object({ density: setting, roundness: setting, contrast: setting, warmth: setting }),
    result: themaSystemSchema.optional(),
  }),
  locks: z.array(lockPath).max(200).default([]),
  name: text(120).min(1).optional(),
});

/** POST /api/projects/:id/export */
export const exportBody = z.object({ system: themaSystemSchema });
