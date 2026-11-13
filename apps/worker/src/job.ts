import { extractSystem } from "@thema/engine";
import type { ExtractionOutput, ExtractionStage } from "@thema/jobs";
import { extract, type ExtractOptions } from "./extract.js";

export interface RunOptions extends Omit<ExtractOptions, "onStage"> {
  /** Progress: "fetching", "reading" (from extract), then "naming" while the engine runs. */
  onStage?: (stage: ExtractionStage) => void;
  /** The extraction's timestamp (the engine has no clock). */
  now?: () => Date;
}

/**
 * One extraction job: load the page in the browser (extract, with the SSRF guard), then parse
 * its samples into a ThemaSystem (the engine's extractSystem). The queues in @thema/jobs run
 * this, in-process for development or in the queue worker (src/queue.ts).
 */
export async function runExtraction(
  url: string,
  options: RunOptions = {},
): Promise<ExtractionOutput> {
  const { now = () => new Date(), ...extractOptions } = options;
  const extraction = await extract(url, extractOptions);
  extractOptions.onStage?.("naming");
  const { system, warnings, derived } = extractSystem({
    samples: extraction.light,
    ...(extraction.dark ? { darkSamples: extraction.dark } : {}),
    // borrowed is the project's choice, set when blending; the API fills in the screenshot URL.
    source: { url: extraction.url, borrowed: [], screenshot: "" },
    name: new URL(extraction.url).hostname,
    createdAt: now().toISOString(),
  });
  return {
    url: extraction.url,
    system,
    warnings,
    derived,
    screenshot: new Uint8Array(extraction.screenshot),
  };
}
