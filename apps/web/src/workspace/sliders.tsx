import {
  CONTRAST_MAX_SHIFT,
  DENSITY_MAX_FACTOR,
  DENSITY_MIN_FACTOR,
  WARMTH_MAX_ROTATION,
  type BlendSettings,
  type ThemaSystem,
} from "@thema/engine";
import { useId } from "react";

/** The spacing factor the engine applies for a density setting (blend's applyDensity). */
export const densityFactor = (density: number) =>
  density > 0 ? 1 + (DENSITY_MAX_FACTOR - 1) * density : 1 + (1 - DENSITY_MIN_FACTOR) * density;

const signed = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(digits)}`;

interface SliderDef {
  key: keyof BlendSettings;
  label: string;
  /** What -1 and +1 do, in words. */
  ends: [string, string];
  value: (settings: BlendSettings, result: ThemaSystem | undefined) => string;
}

const SLIDERS: SliderDef[] = [
  {
    key: "density",
    label: "Density",
    ends: ["Compact", "Airy"],
    value: (s) => `${densityFactor(s.density).toFixed(2)}×`,
  },
  {
    key: "roundness",
    label: "Roundness",
    ends: ["Sharp", "Pill"],
    value: (_s, result) =>
      result ? (result.radius.md >= 9999 ? "pill" : `${result.radius.md} px`) : "—",
  },
  {
    key: "contrast",
    label: "Contrast",
    ends: ["Soft", "Crisp"],
    value: (s) => `${signed(s.contrast * CONTRAST_MAX_SHIFT, 2)} L`,
  },
  {
    key: "warmth",
    label: "Warmth",
    ends: ["Cool", "Warm"],
    value: (s) => `${signed(s.warmth * WARMTH_MAX_ROTATION, 0)}°`,
  },
];

/** The four blend sliders: native range inputs, so arrow keys, Home and End work. */
export function Sliders({
  settings,
  result,
  onChange,
}: {
  settings: BlendSettings;
  result: ThemaSystem | undefined;
  onChange: (settings: BlendSettings) => void;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4.5"
    >
      <h2 id={`${id}-heading`} className="m-0 text-label-md font-label-md font-semibold">
        Blend
      </h2>
      {SLIDERS.map(({ key, label, ends, value }) => {
        const inputId = `${id}-${key}`;
        const shown = value(settings, result);
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <label htmlFor={inputId} className="text-ui-sm font-ui-sm">
                {label}
              </label>
              <output htmlFor={inputId} className="text-token font-token text-ink-muted">
                {shown}
              </output>
            </div>
            <input
              id={inputId}
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={settings[key]}
              aria-valuetext={`${shown} (${ends[0]} to ${ends[1]})`}
              onChange={(event) =>
                onChange({ ...settings, [key]: Math.round(Number(event.target.value) * 10) / 10 })
              }
              className="w-full accent-ink"
            />
            <div className="flex justify-between text-ui-sm font-ui-sm text-ink-subtle">
              <span>{ends[0]}</span>
              <span>{ends[1]}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
