import type { ColorRole, ThemaSystem } from "@thema/engine";
import { cssFontStack, familyForStep, fontStack, toHex } from "@thema/exporters";
import type { ReactNode } from "react";
import { chipTextColor } from "@/components/paint-chip";
import { cn } from "@/lib/cn";
import { TAG_LABEL } from "./reference-card";
import { hostOf, ownerOf, type SwapCandidate, type WorkspaceProject } from "./project";

export type Theme = "light" | "dark";

const MAIN_ROLES: [ColorRole, string][] = [
  ["canvas", "Canvas"],
  ["surface", "Surface"],
  ["ink", "Ink"],
  ["ink-muted", "Muted"],
  ["primary", "Primary"],
  ["accent", "Accent"],
];
const MORE_ROLES: [ColorRole, string][] = [
  ["surface-raised", "Raised"],
  ["hairline", "Hairline"],
  ["primary-ink", "On primary"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
  ["info", "Info"],
];

export interface TokenActions {
  isLocked: (path: string) => boolean;
  onToggleLock: (path: string) => void;
  candidates: (path: string) => SwapCandidate[];
  onSwap: (path: string, value: string | number) => void;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        fill={locked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d={locked ? "M5.5 7V5a2.5 2.5 0 0 1 5 0v2" : "M5.5 7V5a2.5 2.5 0 0 1 4.9-.7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const describe = (value: string | number) => (typeof value === "number" ? `${value}px` : value);

/**
 * Lock and swap for one token. Lock keeps the current value through every blend; swap takes the
 * value another reference has, then locks it (SPEC). Both are real buttons.
 */
function TokenControls({
  path,
  label,
  actions,
  isColor = false,
}: {
  path: string;
  label: string;
  actions: TokenActions;
  isColor?: boolean;
}) {
  const locked = actions.isLocked(path);
  const candidates = actions.candidates(path);
  return (
    <span className="flex items-center gap-0.5">
      {candidates.length > 0 && (
        <details className="relative">
          <summary
            aria-label={`Swap ${label} from another site`}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <ul className="absolute right-0 z-10 m-0 flex w-max max-w-[260px] list-none flex-col gap-1 rounded-md border border-hairline bg-surface p-1.5 text-ink shadow-card">
            {candidates.map((candidate) => (
              <li key={candidate.refId}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    actions.onSwap(path, candidate.value);
                  }}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 text-left text-ui-sm font-ui-sm text-ink hover:bg-surface-subtle"
                >
                  {isColor && typeof candidate.value === "string" && (
                    <span
                      aria-hidden="true"
                      className="size-4 flex-none rounded-xs border border-hairline"
                      style={{ background: candidate.value }}
                    />
                  )}
                  <span className="min-w-0">
                    Use {candidate.host}&apos;s{" "}
                    <span className="text-token font-token">
                      {isColor && typeof candidate.value === "string"
                        ? toHex(candidate.value)
                        : describe(candidate.value)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <button
        type="button"
        aria-label={`Lock ${label}`}
        aria-pressed={locked}
        onClick={() => actions.onToggleLock(path)}
        className={cn(
          "flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-current",
          !locked && "opacity-70 hover:opacity-100",
        )}
      >
        <LockIcon locked={locked} />
      </button>
    </span>
  );
}

function ColorChip({
  role,
  label,
  colors,
  theme,
  actions,
  tall,
}: {
  role: ColorRole;
  label: string;
  colors: Record<ColorRole, string>;
  theme: Theme;
  actions: TokenActions;
  tall: boolean;
}) {
  const color = colors[role];
  const path = `color.${theme}.${role}`;
  const locked = actions.isLocked(path);
  return (
    <figure
      className={cn(
        "m-0 flex flex-col justify-between rounded-md border border-hairline p-1.5 pl-3",
        tall ? "h-[176px]" : "h-[112px]",
        locked && "outline-2 outline-offset-2 outline-ink",
      )}
      style={{ background: color, color: chipTextColor(color, colors.ink) }}
    >
      <span className="self-end">
        <TokenControls path={path} label={label} actions={actions} isColor />
      </span>
      <figcaption className="flex flex-col gap-1.5 pb-1.5">
        <span className="text-ui-sm font-ui-sm">
          {label}
          {locked ? " · locked" : ""}
        </span>
        {tall && <span aria-hidden="true" className="h-[1.5px] w-[18px] bg-current" />}
        <code className="text-token font-token">{toHex(color)}</code>
      </figcaption>
    </figure>
  );
}

function Card({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-md border border-hairline bg-surface p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-ui-sm font-ui-sm font-semibold">{title}</h3>
        <span className="text-token font-token text-ink-muted">{note}</span>
      </div>
      {children}
    </div>
  );
}

const fromNote = (project: WorkspaceProject, tag: Parameters<typeof ownerOf>[1]) => {
  const owner = ownerOf(project, tag);
  return owner ? `from ${hostOf(owner.url)}` : TAG_LABEL[tag];
};

function Typography({
  system,
  project,
  actions,
}: {
  system: ThemaSystem;
  project: WorkspaceProject;
  actions: TokenActions;
}) {
  const { families, scale, ratio } = system.typography;
  const steps = [...scale].sort((a, b) => b.size - a.size);
  const ink = system.color.light.ink;
  const slots = (["sans", "serif", "mono", "display", "heading"] as const).filter(
    (slot) => families[slot] !== undefined,
  );
  return (
    <Card
      title="Typography"
      note={`${fromNote(project, "typography")} · ratio ${ratio.toFixed(2)}`}
      className="flex-[1_1_340px]"
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {steps.map((step) => {
          const large = step.size >= 24;
          const { slot, name } = familyForStep(families, step.name);
          return (
            <li
              key={step.name}
              className="flex items-baseline justify-between gap-3 border-b border-divider py-2.5 last:border-b-0"
            >
              <span
                className="min-w-0 truncate"
                style={{
                  // The user's font by name with fallbacks: web fonts aren't loaded (no runtime
                  // requests), so it renders exactly only where the font is installed.
                  fontFamily: cssFontStack(fontStack(slot, name)),
                  fontSize: `${Math.min(step.size, 48)}px`,
                  lineHeight: step.lineHeight,
                  fontWeight: step.weight,
                  letterSpacing: `${step.tracking}em`,
                  color: ink,
                }}
              >
                {step.size >= 40
                  ? "Heading"
                  : large
                    ? "Section heading"
                    : "Body text reads comfortably."}
              </span>
              <span className="flex-none text-token font-token text-ink-muted">
                {step.name} · {step.size}/{Math.round(step.size * step.lineHeight)}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {slots.map((slot) => (
          <li
            key={slot}
            className="flex items-center gap-1 rounded-sm bg-stage py-0.5 pl-2.5 text-token font-token text-ink-soft"
          >
            {slot}: {families[slot]}
            <TokenControls
              path={`typography.families.${slot}`}
              label={`${slot} font`}
              actions={actions}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Spacing({ system, project }: { system: ThemaSystem; project: WorkspaceProject }) {
  const bar = system.color.light.primary;
  return (
    <Card title="Spacing" note={`base ${system.spacing.base} · ${fromNote(project, "spacing")}`}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Spacing scale">
        {system.spacing.scale.slice(0, 10).map((value) => (
          <li key={value} className="flex items-center gap-2.5">
            <span className="w-8 text-token font-token text-ink-muted">{value}</span>
            <span
              aria-hidden="true"
              className="block h-2.5 rounded-xs"
              style={{ width: `${Math.min(value, 200)}px`, background: bar }}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Shape({
  system,
  project,
  actions,
}: {
  system: ThemaSystem;
  project: WorkspaceProject;
  actions: TokenActions;
}) {
  const ink = system.color.light.ink;
  const surface = system.color.light.surface;
  return (
    <Card title="Shape" note={fromNote(project, "shape")}>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0" aria-label="Radius">
        {(["sm", "md", "lg"] as const).map((size) => (
          <li key={size} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className="block size-14"
              style={{ border: `1.5px solid ${ink}`, borderRadius: `${system.radius[size]}px` }}
            />
            <span className="text-token font-token text-ink-muted">
              {size} {system.radius[size]}
            </span>
            <TokenControls path={`radius.${size}`} label={`radius ${size}`} actions={actions} />
          </li>
        ))}
      </ul>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0" aria-label="Shadow">
        {(["sm", "md", "lg"] as const).map((size) => (
          <li key={size} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className="block size-14"
              style={{
                background: surface,
                borderRadius: `${system.radius.md}px`,
                boxShadow: system.shadow[size],
              }}
            />
            <span className="text-token font-token text-ink-muted">shadow {size}</span>
            <TokenControls path={`shadow.${size}`} label={`shadow ${size}`} actions={actions} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** "Your system" on the neutral stage: user content only, so its colors read true (DESIGN.md). */
export function TokenPanel({
  project,
  theme,
  onTheme,
  actions,
  status,
}: {
  project: WorkspaceProject;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  actions: TokenActions;
  /** A short line about the blend in flight or its error. */
  status: ReactNode;
}) {
  const system = project.result;
  return (
    <section
      aria-labelledby="stage-heading"
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 rounded-xl border border-hairline bg-stage p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="stage-heading" className="m-0 text-label-md font-label-md font-semibold">
            Your system
          </h2>
          <span className="text-ui-sm font-ui-sm text-ink-muted">
            Shown on a neutral stage so your colors read true.
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status}
          <div
            role="group"
            aria-label="Theme"
            className="flex gap-0.5 rounded-full border border-pill-border bg-surface p-0.5"
          >
            {(["light", "dark"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => onTheme(value)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full border-0 px-4 text-ui-sm font-ui-sm",
                  theme === value ? "bg-ink text-canvas" : "bg-transparent text-ink",
                )}
              >
                {value === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!system ? (
        <p className="m-0 rounded-lg border border-dashed border-input-border bg-surface p-8 text-center text-body-sm font-body-sm text-ink-muted">
          {project.references.length === 0
            ? "Add a site to start. Your system appears here once its styles are read."
            : "Reading your first site. Your system appears here as soon as it's done."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 text-ui-sm font-ui-sm font-semibold">Color</h3>
              <span className="text-token font-token text-ink-muted">
                {fromNote(project, "colors")} · {theme}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
              {MAIN_ROLES.map(([role, label]) => (
                <ColorChip
                  key={role}
                  role={role}
                  label={label}
                  colors={system.color[theme]}
                  theme={theme}
                  actions={actions}
                  tall
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {MORE_ROLES.map(([role, label]) => (
                <ColorChip
                  key={role}
                  role={role}
                  label={label}
                  colors={system.color[theme]}
                  theme={theme}
                  actions={actions}
                  tall={false}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <Typography system={system} project={project} actions={actions} />
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-5">
              <Spacing system={system} project={project} />
              <Shape system={system} project={project} actions={actions} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
