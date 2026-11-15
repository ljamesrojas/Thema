// A Workspace project as JSON: what the browser keeps for anonymous use and what the API saves
// for signed-in users. Shared, so both check the same shape (the API trusts nothing it's sent).
import { MAX_REFERENCES } from "@thema/engine";
import { z } from "zod";
import { BORROW_TAGS, themaSystemSchema } from "./schemas";

export const projectDataSchema = z.object({
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
        // Only Thema's own screenshot route: the page shows it as an image.
        screenshot: z
          .string()
          .regex(/^\/api\/references\/[0-9a-f]{24}\/screenshot$/)
          .nullable(),
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

export type ProjectData = z.infer<typeof projectDataSchema>;
