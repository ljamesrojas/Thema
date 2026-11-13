import { exportAll } from "@thema/exporters";
import { strToU8, zipSync } from "fflate";
import { DOWNLOAD_HEADERS, FORMATS, isFormat, ZIP_MTIME } from "@/server/export-formats";
import { ApiError, handler, readJson, type IdParams } from "@/server/http";
import { exportBody, projectId } from "@/server/schemas";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/export?format=design-md|tailwind|shadcn|dtcg|styleguide|zip { system }.
 * POST, not SPEC's GET: an anonymous project lives in the browser, so the system comes in the
 * body. The files are packages/exporters' output, unchanged.
 */
export const POST = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) throw new ApiError(404, "not-found", "No such project.");
  const format = new URL(request.url).searchParams.get("format");
  if (!isFormat(format)) {
    throw new ApiError(
      400,
      "invalid-format",
      `format must be one of: ${[...Object.keys(FORMATS), "zip"].join(", ")}.`,
    );
  }
  const { system } = await readJson(request, exportBody);
  const files = exportAll(system);

  if (format === "zip") {
    const archive = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([name, content]) => [
          name,
          [strToU8(content), { mtime: ZIP_MTIME }],
        ]),
      ),
    );
    return new Response(new Uint8Array(archive), {
      headers: {
        ...DOWNLOAD_HEADERS,
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="thema.zip"',
      },
    });
  }

  const { file, type } = FORMATS[format];
  return new Response(files[file], {
    headers: {
      ...DOWNLOAD_HEADERS,
      "content-type": type,
      "content-disposition": `attachment; filename="${file}"`,
    },
  });
});
