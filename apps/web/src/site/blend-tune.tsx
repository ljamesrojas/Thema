"use client";

import type { ColorRole } from "@thema/engine";
import { useId, useState } from "react";
import { CheckIcon, LockIcon } from "./icons";

/** The density slider's spacing factor, as the engine applies it: −1 → 0.8×, +1 → 1.25×. */
export const densityFactor = (value: number): number => {
  const t = (value - 50) / 50;
  return t < 0 ? 1 + 0.2 * t : 1 + 0.25 * t;
};

/** Roundness: the middle is the system's own radius; the ends are square and 24px. */
export const roundnessRadius = (value: number, base: number): number =>
  Math.round(value <= 50 ? (base * value) / 50 : base + ((24 - base) * (value - 50)) / 50);

/** Padding of the preview card at 1.00× density. */
const BASE_PADDING = 20;

/**
 * How it works, step 04 (docs/pages.md): Roundness and Density move the preview card's radius
 * and padding; Contrast and Warmth are shown at rest; the lock is a real toggle on the primary.
 * The preview's colors are the sample system's light theme (pairs the fixer checked).
 */
export function BlendTune({
  colors,
  hex,
  radius: baseRadius,
}: {
  colors: Record<ColorRole, string>;
  /** The primary's hex, as the exporters write it. */
  hex: string;
  /** The sample system's own radius (md), the slider's middle. */
  radius: number;
}) {
  const id = useId();
  const [roundness, setRoundness] = useState(50);
  const [density, setDensity] = useState(50);
  const [locked, setLocked] = useState(true);
  const radius = roundnessRadius(roundness, baseRadius);
  const factor = densityFactor(density);
  const padding = Math.round(BASE_PADDING * factor);

  const slider = (name: string, value: number, set: (v: number) => void, shown: string) => (
    <div className="flex flex-col gap-1">
      <span className="flex justify-between text-ui-sm font-ui-sm">
        <label htmlFor={`${id}-${name}`} className="text-ink">
          {name}
        </label>
        <span className="text-token font-token text-ink-subtle">{shown}</span>
      </span>
      <input
        id={`${id}-${name}`}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
        className="min-h-11 w-full accent-ink"
      />
    </div>
  );

  return (
    <div className="grid overflow-hidden rounded-lg border border-hairline bg-surface sm:grid-cols-2">
      <div className="flex flex-col gap-3 p-5">
        {slider("Roundness", roundness, setRoundness, `${radius}px`)}
        {slider("Density", density, setDensity, `${factor.toFixed(2)}×`)}
        {["Contrast", "Warmth"].map((name) => (
          <div key={name} className="flex flex-col gap-1">
            <span className="flex justify-between text-ui-sm font-ui-sm text-ink">
              <span>
                {name} <span className="sr-only">(at rest here)</span>
              </span>
              <span className="text-token font-token text-ink-subtle">0</span>
            </span>
            <span aria-hidden="true" className="relative my-4 h-1 rounded-full bg-hairline">
              <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-ink" />
            </span>
          </div>
        ))}
        <button
          type="button"
          aria-pressed={locked}
          onClick={() => setLocked((l) => !l)}
          className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-ink bg-surface px-3 text-left text-ui-sm font-ui-sm text-ink"
        >
          <span
            aria-hidden="true"
            className="size-3 flex-none rounded-sm"
            style={{ background: colors.primary }}
          />
          <span className="flex-1 text-token font-token">primary {hex}</span>
          <LockIcon open={!locked} />
          <span>{locked ? "Locked" : "Unlocked"}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline bg-surface-subtle p-5 sm:border-t-0 sm:border-l">
        <div
          data-testid="tune-card"
          className="flex flex-col gap-2 border"
          style={{
            background: colors.canvas,
            color: colors.ink,
            borderColor: colors.hairline,
            borderRadius: `${radius}px`,
            padding: `${padding}px`,
          }}
        >
          <span className="text-token font-token" style={{ color: colors["ink-muted"] }}>
            PREVIEW
          </span>
          <span className="text-h4 font-h4">Calm software for busy teams</span>
          <span className="text-ui-sm font-ui-sm" style={{ color: colors["ink-muted"] }}>
            Every value here comes from your blend.
          </span>
          <span className="mt-1 flex flex-col items-start gap-2">
            <span
              className="px-3 py-1.5 text-ui-sm font-ui-sm"
              style={{
                background: colors.primary,
                color: colors["primary-ink"],
                borderRadius: `${radius}px`,
              }}
            >
              Get started
            </span>
            <span
              className="border px-3 py-1.5 text-ui-sm font-ui-sm"
              style={{ borderColor: colors.hairline, borderRadius: `${radius}px` }}
            >
              Book a demo
            </span>
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-token font-token text-success">
          <CheckIcon size={12} />
          WCAG AA · every text pair passes
        </span>
      </div>
    </div>
  );
}
