"use client";

import { blend, fix, type BorrowTag, type ThemaSystem } from "@thema/engine";
import { cssFontStack, familyForStep, fontStack, toHex } from "@thema/exporters";
import { wcagContrast } from "culori";
import { useId, useMemo, useState } from "react";
import { PaintChip } from "@/components/paint-chip";
import { cn } from "@/lib/cn";
import { densityFactor } from "@/workspace/sliders";

/** A sample site: one of our synthetic fixtures, extracted at build time (hero-blend.ts). */
export interface DemoSite {
  id: string;
  label: string;
  system: ThemaSystem;
}

/** The tags the demo lets people move; spacing and layout stay with the first site. */
export const DEMO_TAGS = [
  ["colors", "Colors"],
  ["typography", "Type"],
  ["shape", "Shape"],
] as const satisfies readonly [BorrowTag, string][];
type DemoTag = (typeof DEMO_TAGS)[number][0];

export type Owners = Record<DemoTag, string>;
export interface DemoSettings {
  roundness: number;
  density: number;
}

const CREATED_AT = "2026-11-13T00:00:00.000Z";

/** The real pipeline, in the browser: blend the sites as owned, then fix for WCAG AA. Pure. */
export function demoSystem(sites: readonly DemoSite[], owners: Owners, settings: DemoSettings) {
  const blended = blend({
    references: sites.map((site) => ({
      system: site.system,
      borrowed: DEMO_TAGS.filter(([tag]) => owners[tag] === site.id).map(([tag]) => tag),
    })),
    settings: { density: settings.density, roundness: settings.roundness, contrast: 0, warmth: 0 },
    name: "Demo blend",
    createdAt: CREATED_AT,
  });
  return fix(blended.system);
}

/** The scale step closest to a target size (density moves the whole scale). */
const near = (scale: readonly number[], target: number) =>
  scale.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), target);

const radiusLabel = (px: number) => (px >= 9999 ? "pill" : `${px}px`);

const ratio = (a: string, b: string) => Math.round(wcagContrast(a, b) * 10) / 10;

/**
 * The Landing's "Try it" demo (docs/landing-white.md, canvas board Landing-white): move borrow
 * chips between three sample sites and drag two sliders; the preview, the paint chips, the
 * contrast ratios and the DESIGN.md lines all come from the engine's blend and fix.
 */
export function BlendDemo({ sites }: { sites: DemoSite[] }) {
  const id = useId();
  const initial = useMemo<Owners>(
    () => ({
      colors: sites[0]?.id ?? "",
      typography: sites[1]?.id ?? sites[0]?.id ?? "",
      shape: sites[2]?.id ?? sites[0]?.id ?? "",
    }),
    [sites],
  );
  const [owners, setOwners] = useState<Owners>(initial);
  const [settings, setSettings] = useState<DemoSettings>({ roundness: 0, density: 0 });
  const { system, unresolved } = useMemo(
    () => demoSystem(sites, owners, settings),
    [sites, owners, settings],
  );

  const c = system.color.light;
  const { families } = system.typography;
  const body = cssFontStack(fontStack("sans", families.sans));
  const headingFamily = familyForStep(families, "3xl");
  const heading = cssFontStack(fontStack(headingFamily.slot, headingFamily.name));
  const scale = system.spacing.scale;
  const gap = near(scale, 14);
  const padY = near(scale, 10);
  const padX = near(scale, 18);
  const button = system.radius.md;
  const card = system.radius.lg;
  const fixes = system.a11y.fixes.filter((f) => f.theme === "light").length;
  const labelOnPrimary = ratio(c["primary-ink"], c.primary);
  const inkOnCanvas = ratio(c.ink, c.canvas);
  const pass = unresolved.length === 0 && labelOnPrimary >= 4.5 && inkOnCanvas >= 4.5;
  const host = (tag: DemoTag) => sites.find((s) => s.id === owners[tag])?.label ?? "";

  const lines: [string, string, string][] = [
    ["colors:", "", ""],
    ["  primary: ", `"${toHex(c.primary)}"`, `  # ${host("colors")}`],
    ["  canvas: ", `"${toHex(c.canvas)}"`, ""],
    ["  ink: ", `"${toHex(c.ink)}"`, ""],
    ["typography:", "", ""],
    ["  body: ", families.sans, `  # ${host("typography")}`],
    ["rounded:", "", ""],
    ["  button: ", radiusLabel(button), `  # ${host("shape")}`],
    ["  card: ", radiusLabel(card), ""],
    ["spacing:", "", ""],
    ["  density: ", `${densityFactor(settings.density).toFixed(2)}x`, ""],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-input-border bg-surface shadow-demo">
      <div className="flex items-center justify-between gap-3 border-b border-divider bg-surface-subtle px-4 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="block size-2.5 rounded-full bg-pill-border" />
          ))}
        </span>
        <span className="text-token font-token text-ink-subtle">thema · demo blend</span>
        <button
          type="button"
          onClick={() => {
            setOwners(initial);
            setSettings({ roundness: 0, density: 0 });
          }}
          className="min-h-11 cursor-pointer rounded-full border border-pill-border bg-surface px-3.5 text-ui-sm font-ui-sm text-ink"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap">
        {/* References */}
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 border-divider p-5 md:max-w-[320px] md:border-r">
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-ui-sm font-ui-sm font-semibold">References</h3>
            <span className="text-token font-token text-ink-subtle">{sites.length} / 5</span>
          </div>
          {sites.map((site) => {
            const own = site.system.color.light;
            const owns = DEMO_TAGS.some(([tag]) => owners[tag] === site.id);
            const font = site.system.typography.families;
            const sample = familyForStep(font, "3xl");
            return (
              <article
                key={site.id}
                aria-label={site.label}
                className={cn(
                  "flex flex-col gap-2.5 rounded-lg border bg-surface p-3",
                  owns ? "border-ink" : "border-input-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-token font-token">{site.label}</span>
                  <span
                    aria-hidden="true"
                    className="text-h4"
                    style={{ fontFamily: cssFontStack(fontStack(sample.slot, sample.name)) }}
                  >
                    Aa
                  </span>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {[own.canvas, own.ink, own.primary, own.accent].map((color, i) => (
                    <span
                      key={i}
                      className="block h-5.5 flex-1 rounded-xs border border-hairline"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <div
                  role="group"
                  aria-label={`Borrow from ${site.label}`}
                  className="flex flex-wrap gap-1.5"
                >
                  {DEMO_TAGS.map(([tag, label]) => {
                    const on = owners[tag] === site.id;
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setOwners((o) => ({ ...o, [tag]: site.id }))}
                        className={cn(
                          "min-h-11 cursor-pointer rounded-full px-3 text-ui-sm font-ui-sm",
                          on
                            ? "border border-ink bg-ink text-canvas"
                            : "border border-dot-grid bg-surface text-ink-soft",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
          <p className="m-0 text-ui-sm font-ui-sm text-ink-subtle">
            Each part comes from one site at a time. Sample sites, for illustration.
          </p>
        </div>

        {/* Live preview, on the stage */}
        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-4 bg-stage p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-ui-sm font-ui-sm font-semibold">Live preview</h3>
            <span className="text-token font-token text-ink-muted">
              neutral stage · your colors read true
            </span>
          </div>
          <figure
            aria-label="Preview of the blended system"
            className="m-0 overflow-hidden rounded-lg border"
            style={{
              background: c.canvas,
              color: c.ink,
              fontFamily: body,
              borderColor: c.hairline,
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: `1px solid ${c.hairline}` }}
            >
              <span className="flex items-center gap-2 font-semibold">
                <span
                  aria-hidden="true"
                  className="inline-block size-3.5 rounded-[4px]"
                  style={{ background: c.primary }}
                />
                Acme
              </span>
              <span className="flex gap-4 text-ui-sm" style={{ color: c["ink-muted"] }}>
                <span>Product</span>
                <span>Pricing</span>
                <span>Docs</span>
              </span>
            </div>
            <div className="flex flex-col px-7 pt-9 pb-7" style={{ gap: `${gap}px` }}>
              <span
                className="flex items-center gap-2 text-token font-semibold tracking-[0.04em] uppercase"
                style={{ color: c["ink-muted"] }}
              >
                {/* Accent is checked at 3:1 (a UI color), not 4.5:1, so it marks the label, not its text. */}
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ background: c.accent }}
                />
                New · Release 4.0
              </span>
              <span
                className="text-[38px] leading-[1.08] font-semibold tracking-[-0.02em]"
                style={{ fontFamily: heading }}
              >
                Calm software for busy teams
              </span>
              <span className="max-w-[440px] text-body-sm" style={{ color: c["ink-muted"] }}>
                Plan, track and ship in one quiet place. Everything here is styled by the system you
                just blended.
              </span>
              <span className="flex flex-wrap gap-2.5 pt-1">
                <span
                  data-testid="demo-primary-button"
                  className="text-ui-sm font-semibold"
                  style={{
                    background: c.primary,
                    color: c["primary-ink"],
                    borderRadius: `${Math.min(button, 9999)}px`,
                    padding: `${padY}px ${padX}px`,
                  }}
                >
                  Get started
                </span>
                <span
                  className="text-ui-sm"
                  style={{
                    border: `1px solid ${c.hairline}`,
                    borderRadius: `${Math.min(button, 9999)}px`,
                    padding: `${padY}px ${padX}px`,
                  }}
                >
                  Book a demo
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 px-7 pb-7 sm:grid-cols-3" style={{ gap: `${gap}px` }}>
              {[
                ["Roadmaps", "See the quarter at a glance."],
                ["Cycles", "Two-week rhythm, built in."],
                ["Insights", "Know what shipped and why."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="flex flex-col gap-1.5"
                  style={{
                    background: c.surface,
                    border: `1px solid ${c.hairline}`,
                    borderRadius: `${Math.min(card, 9999)}px`,
                    padding: `${near(scale, 18)}px`,
                  }}
                >
                  <span className="text-ui-sm font-semibold">{title}</span>
                  <span className="text-ui-sm font-normal" style={{ color: c["ink-muted"] }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </figure>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Canvas", c.canvas],
                ["Ink", c.ink],
                ["Primary", c.primary],
                ["Accent", c.accent],
              ] as const
            ).map(([name, color]) => (
              <PaintChip
                key={name}
                name={name}
                color={color}
                hex={toHex(color)}
                ink={c.ink}
                compact
              />
            ))}
          </div>
        </div>

        {/* Tune */}
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4.5 border-divider p-5 md:max-w-[340px] md:border-l">
          <h3 className="m-0 text-ui-sm font-ui-sm font-semibold">Tune</h3>
          {(
            [
              ["roundness", "Roundness", radiusLabel(button), ["Sharp", "Pill"]],
              [
                "density",
                "Density",
                `${densityFactor(settings.density).toFixed(2)}x`,
                ["Compact", "Airy"],
              ],
            ] as const
          ).map(([key, label, shown, ends]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <label htmlFor={`${id}-${key}`} className="text-ui-sm font-ui-sm">
                  {label}
                </label>
                <output htmlFor={`${id}-${key}`} className="text-token font-token text-ink-muted">
                  {shown}
                </output>
              </div>
              <input
                id={`${id}-${key}`}
                type="range"
                min={-1}
                max={1}
                step={0.1}
                value={settings[key]}
                aria-valuetext={`${shown} (${ends[0]} to ${ends[1]})`}
                onChange={(event) =>
                  setSettings((s) => ({
                    ...s,
                    [key]: Math.round(Number(event.target.value) * 10) / 10,
                  }))
                }
                className="w-full accent-ink"
              />
            </div>
          ))}

          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-subtle p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-ui-sm font-ui-sm font-semibold">Accessibility</span>
              <span className={cn("text-token font-token", pass ? "text-success" : "text-danger")}>
                {pass ? "AA ✓ all pass" : "fix needed"}
              </span>
            </div>
            <div className="flex justify-between text-token font-token text-ink-soft">
              <span>label on primary</span>
              <span data-testid="ratio-label">{labelOnPrimary.toFixed(1)}:1</span>
            </div>
            <div className="flex justify-between text-token font-token text-ink-soft">
              <span>ink on canvas</span>
              <span data-testid="ratio-ink">{inkOnCanvas.toFixed(1)}:1</span>
            </div>
            <span className="text-token font-token text-ink-subtle">
              {fixes === 0
                ? "nothing needed fixing"
                : `${fixes} ${fixes === 1 ? "pair" : "pairs"} fixed`}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-ui-sm font-ui-sm font-semibold">DESIGN.md</span>
              <span className="text-token font-token text-ink-subtle">live</span>
            </div>
            <pre
              data-testid="demo-design-md"
              className="m-0 rounded-md bg-band p-3.5 text-token font-token leading-[1.75] break-words whitespace-pre-wrap text-band-ink"
            >
              {lines.map(([key, value, comment]) => (
                <span key={key + comment} className="block">
                  <span className={value ? "text-band-accent" : "text-band-ink-muted"}>{key}</span>
                  <span>{value}</span>
                  <span className="text-band-ink-muted">{comment}</span>
                </span>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
