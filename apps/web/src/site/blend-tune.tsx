"use client";

import { useId, useState } from "react";

/**
 * How it works, step 04 (docs/pages.md): Roundness and Density move a small preview card's
 * radius and padding; Contrast and Warmth are shown at rest; the lock toggles on the primary.
 */
export function BlendTune({
  primary,
  primaryInk,
  hex,
}: {
  /** The sample system's primary and its label color (a pair the fixer checks). */
  primary: string;
  primaryInk: string;
  hex: string;
}) {
  const id = useId();
  const [roundness, setRoundness] = useState(50);
  const [density, setDensity] = useState(50);
  const [locked, setLocked] = useState(true);
  const radius = Math.round(2 + (roundness / 100) * 22);
  const padding = Math.round(12 + (density / 100) * 20);

  const slider = (
    name: string,
    value: number,
    set: (v: number) => void,
    ends: [string, string],
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${name}`} className="text-ui-sm font-ui-sm text-ink">
        {name}
      </label>
      <input
        id={`${id}-${name}`}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
        className="min-h-11 w-full accent-ink"
      />
      <span
        aria-hidden="true"
        className="flex justify-between text-token font-token text-ink-subtle"
      >
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-hairline bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {slider("Roundness", roundness, setRoundness, ["Sharp", "Pill"])}
        {slider("Density", density, setDensity, ["Compact", "Airy"])}
        {(
          [
            ["Contrast", "Soft", "Crisp"],
            ["Warmth", "Cool", "Warm"],
          ] as const
        ).map(([name, low, high]) => (
          <div key={name} className="flex flex-col gap-1">
            <span className="text-ui-sm font-ui-sm text-ink">
              {name} <span className="text-ink-subtle">· at rest</span>
            </span>
            <span aria-hidden="true" className="relative mt-4 mb-3 h-1 rounded-full bg-hairline">
              <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-ink-faint" />
            </span>
            <span
              aria-hidden="true"
              className="flex justify-between text-token font-token text-ink-subtle"
            >
              <span>{low}</span>
              <span>{high}</span>
            </span>
          </div>
        ))}
      </div>

      <div
        data-testid="tune-card"
        className="flex flex-col gap-2 border border-hairline bg-canvas"
        style={{ borderRadius: `${radius}px`, padding: `${padding}px` }}
      >
        <span className="text-label-md font-label-md">Weekly report</span>
        <span className="text-ui-sm font-ui-sm text-ink-muted">
          Radius {radius}px · padding {padding}px
        </span>
        <span
          className="self-start px-4 py-2 text-ui-sm font-ui-sm"
          style={{ background: primary, color: primaryInk, borderRadius: `${radius}px` }}
        >
          Open report
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-pressed={locked}
          onClick={() => setLocked((l) => !l)}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-pill-border bg-surface px-4 text-ui-sm font-ui-sm text-ink"
        >
          <span
            aria-hidden="true"
            className="size-3 rounded-full"
            style={{ background: primary }}
          />
          <span className="font-token text-token">primary {hex}</span>
          <span className="text-ink-subtle">{locked ? "· locked" : "· unlocked"}</span>
        </button>
        <span className="rounded-full bg-success px-3 py-1 text-ui-sm font-ui-sm text-canvas">
          WCAG AA · every text pair passes
        </span>
      </div>
    </div>
  );
}
