import type { ExtractWarning, ThemaSystem } from "@thema/engine";
import type { ExtractionStage, JobSnapshot, JobStatus } from "@thema/jobs";

/** A reference as the API reports it (GET /api/references/:id). */
export interface ReferenceView {
  id: string;
  /** The URL as submitted (normalized). */
  url: string;
  status: JobStatus;
  /** While running: "fetching" (loading the page), "reading" (sampling styles), "naming" (the engine). */
  stage?: ExtractionStage;
  /** The extracted system; its source's `screenshot` is this reference's screenshot route. */
  system?: ThemaSystem;
  /** extractSystem's warnings: no-headings, few-samples, no-dark-theme, monochrome. */
  warnings: ExtractWarning[];
  /** Token paths filled by a fallback or default instead of measured. */
  derived: string[];
  /** Screenshot route, once the extraction is done. */
  screenshot: string | null;
  error?: string;
}

export const screenshotPath = (id: string) => `/api/references/${id}/screenshot`;

export function referenceView(job: JobSnapshot): ReferenceView {
  const screenshot = job.status === "done" ? screenshotPath(job.id) : null;
  const view: ReferenceView = {
    id: job.id,
    url: job.url,
    status: job.status,
    warnings: job.result?.warnings ?? [],
    derived: job.result?.derived ?? [],
    screenshot,
  };
  if (job.result) {
    const { system } = job.result;
    view.system = {
      ...system,
      meta: {
        ...system.meta,
        sources: system.meta.sources.map((source) => ({
          ...source,
          screenshot: screenshot ?? "",
        })),
      },
    };
  }
  if (job.stage !== undefined) view.stage = job.stage;
  if (job.error !== undefined) view.error = job.error;
  return view;
}
