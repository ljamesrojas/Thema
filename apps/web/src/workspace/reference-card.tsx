import type { BorrowTag, ExtractWarning } from "@thema/engine";
import type { ExtractionStage } from "@thema/jobs";
import { Tag } from "@/components/tag";
import { cn } from "@/lib/cn";
import { BORROW_TAGS, hostOf, type WorkspaceReference } from "./project";

export const TAG_LABEL: Record<BorrowTag, string> = {
  colors: "Colors",
  typography: "Type",
  spacing: "Spacing",
  shape: "Shape",
  layout: "Layout",
};

/** SPEC's progress line: the stage the extraction reports. */
const STAGE_LABEL: Record<ExtractionStage, string> = {
  fetching: "Fetching the page…",
  reading: "Reading styles…",
  naming: "Naming roles…",
};

/** extractSystem's warnings, in words for people. */
export const WARNING_TEXT: Record<ExtractWarning, string> = {
  "no-headings": "No headings found. This may be a variant or placeholder page.",
  "few-samples": "Very little to read. The page may be blocked or nearly empty.",
  monochrome: "No brand color. The main button's gray is used as primary.",
  "no-dark-theme": "No dark theme. Thema will generate one.",
};

function Status({ reference }: { reference: WorkspaceReference }) {
  if (reference.status === "done") {
    return (
      <span className="flex items-center gap-1 text-ui-sm font-ui-sm text-success">
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M2.5 7.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Extracted
      </span>
    );
  }
  if (reference.status === "failed") {
    return <span className="text-ui-sm font-ui-sm text-danger">Failed</span>;
  }
  return (
    <span className="text-ui-sm font-ui-sm text-ink-subtle">
      {reference.status === "queued" ? "Queued" : STAGE_LABEL[reference.stage ?? "fetching"]}
    </span>
  );
}

export function ReferenceCard({
  reference,
  onClaim,
  onRemove,
  onRetry,
}: {
  reference: WorkspaceReference;
  onClaim: (tag: BorrowTag) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const host = hostOf(reference.url);
  const pending = reference.status === "queued" || reference.status === "running";
  return (
    <article
      aria-label={host}
      className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-surface p-3"
    >
      <div className="relative h-24 overflow-hidden rounded-sm bg-stage">
        {reference.screenshot ? (
          <img
            src={reference.screenshot}
            alt={`Screenshot of ${host}`}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-2 text-token font-token text-ink-subtle"
            role="status"
          >
            {pending ? (
              <>
                <span>
                  {reference.status === "queued"
                    ? "Waiting to start…"
                    : STAGE_LABEL[reference.stage ?? "fetching"]}
                </span>
                {/* Indeterminate: the worker reports stages, not a percentage. */}
                <span className="block h-1 w-3/5 overflow-hidden rounded-full bg-hairline">
                  <span className="block h-1 w-1/3 animate-pulse rounded-full bg-primary" />
                </span>
              </>
            ) : (
              <span>No screenshot</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-token font-token text-ink">{host}</span>
        <span className="flex items-center gap-1">
          <Status reference={reference} />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${host}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-subtle hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M3 3l8 8M11 3l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      </div>

      {reference.status === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-ui-sm font-ui-sm text-danger">
            {reference.error ?? "The extraction failed."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 cursor-pointer rounded-full border border-pill-border bg-surface px-3.5 text-ui-sm font-ui-sm text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {reference.warnings.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={`Warnings for ${host}`}>
          {reference.warnings.map((warning) => (
            <li
              key={warning}
              className="flex gap-1.5 rounded-sm bg-surface-subtle px-2 py-1.5 text-ui-sm font-ui-sm text-ink-muted"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
                className="mt-0.5 flex-none text-warning"
              >
                <path
                  d="M7 1.5l6 11H1zM7 6v3M7 10.8v.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {WARNING_TEXT[warning]}
            </li>
          ))}
        </ul>
      )}

      <div role="group" aria-label={`Borrow from ${host}`} className="flex flex-wrap gap-1">
        {BORROW_TAGS.map((tag) => {
          const owned = reference.borrowed.includes(tag);
          return (
            <Tag
              key={tag}
              pressed={owned}
              onClick={() => onClaim(tag)}
              title={
                owned
                  ? `${TAG_LABEL[tag]} come from ${host}`
                  : `Take ${TAG_LABEL[tag].toLowerCase()} from ${host}`
              }
              className={cn(owned && "cursor-default")}
            >
              {TAG_LABEL[tag]}
            </Tag>
          );
        })}
      </div>
    </article>
  );
}
