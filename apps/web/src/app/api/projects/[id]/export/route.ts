import type { ThemaSystem } from "@thema/engine";
import { exportAll } from "@thema/exporters";
import { buildZip } from "@/lib/zip";
import { requireAccount } from "@/server/accounts";
import { DOWNLOAD_HEADERS, FORMATS, isFormat, type Format } from "@/server/export-formats";
import { ApiError, handler, readJson, type IdParams } from "@/server/http";
import { exportBody, projectId } from "@/server/schemas";
import { getServices } from "@/server/services";
import { recordSafely } from "@/server/stats";

export const runtime = "nodejs";

/**
 * POST /api/projects/:id/export?format=design-md|tailwind|shadcn|dtcg|styleguide|zip { system }.
 * POST, not SPEC's GET: an anonymous project lives in the browser, so the system comes in the
 * body. The files are packages/exporters' output, unchanged.
 */
export const POST = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) throw new ApiError(404, "not-found", "No such project.");
  const format = formatOf(request);
  const { system } = await readJson(request, exportBody);
  await recordSafely((await getServices()).stats, "export", id);
  return download(system, format);
});

/**
 * GET /api/projects/:id/export?format=…: a saved project's files (SPEC: comes with accounts),
 * from its last blend.
 */
export const GET = handler(async (request: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!projectId.safeParse(id).success) throw new ApiError(404, "not-found", "No such project.");
  const format = formatOf(request);
  const services = await getServices();
  const { accounts, account } = await requireAccount(services, request);
  const stored = await accounts.projects.get(account.userId, id);
  if (!stored) throw new ApiError(404, "not-found", "No such project.");
  if (!stored.data.result) {
    throw new ApiError(409, "not-blended", "Add a site to this project before exporting it.");
  }
  await recordSafely(services.stats, "export", id);
  return download(stored.data.result, format);
});

function formatOf(request: Request): Format {
  const format = new URL(request.url).searchParams.get("format");
  if (!isFormat(format)) {
    throw new ApiError(
      400,
      "invalid-format",
      `format must be one of: ${[...Object.keys(FORMATS), "zip"].join(", ")}.`,
    );
  }
  return format;
}

function download(system: ThemaSystem, format: Format): Response {
  const files = exportAll(system);

  if (format === "zip") {
    return new Response(new Uint8Array(buildZip(files)), {
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
}
