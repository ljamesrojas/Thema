import { strToU8, zipSync } from "fflate";

/**
 * Fixed modification time for files in the zip, so the same files give the same archive.
 * (Zip stores local time, so the bytes match across runs on one machine, not across time zones.)
 */
export const ZIP_MTIME = new Date(2026, 0, 1);

/**
 * The export zip: the given files, in the order given. One function for the browser's Download
 * zip and the API's `?format=zip`, so both make the same archive.
 */
export function buildZip(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        name,
        [strToU8(content), { mtime: ZIP_MTIME }],
      ]),
    ),
  );
}
