import { parseBoxShadow, type ThemaSystem } from "@thema/engine";
import {
  COLOR_ROLES,
  familyForStep,
  fontStack,
  parseColor,
  provenance,
  sourceUrls,
  THEMES,
  toHex,
} from "./shared.js";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const round = (v: number, digits: number): number => Math.round(v * 10 ** digits) / 10 ** digits;
const dimension = (value: number, unit: "px" | "ms" = "px"): Json => ({
  value: round(value, 3),
  unit,
});

/** DTCG color value: OKLCH components (hue "none" when achromatic) with a hex fallback. */
function colorValue(css: string): Json {
  const color = parseColor(css);
  const hue =
    color.c === 0 || color.h === undefined || Number.isNaN(color.h) ? "none" : round(color.h, 1);
  return {
    colorSpace: "oklch",
    components: [round(color.l, 3), round(color.c, 3), hue],
    alpha: round(color.alpha ?? 1, 3),
    hex: toHex(css).slice(0, 7),
  };
}

const token = (type: string, value: Json): Json => ({ $type: type, $value: value });

/** DTCG shadow value; "none" becomes one fully transparent zero-size shadow. */
function shadowValue(css: string): Json {
  const layers = parseBoxShadow(css);
  if (layers.length === 0) {
    // parseCssColor rejects fully transparent colors, so this one is written out directly.
    const transparent: Json = {
      colorSpace: "oklch",
      components: [0, 0, "none"],
      alpha: 0,
      hex: "#000000",
    };
    return [
      {
        color: transparent,
        offsetX: dimension(0),
        offsetY: dimension(0),
        blur: dimension(0),
        spread: dimension(0),
      },
    ];
  }
  return layers.map((layer) => ({
    color: colorValue(layer.color),
    offsetX: dimension(layer.x),
    offsetY: dimension(layer.y),
    blur: dimension(layer.blur),
    spread: dimension(layer.spread),
    ...(layer.inset ? { inset: true } : {}),
  }));
}

const KEYWORD_EASING: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** A CSS easing as a DTCG cubicBezier [x1, y1, x2, y2]. */
export function cubicBezier(easing: string): [number, number, number, number] {
  const keyword = KEYWORD_EASING[easing.trim().toLowerCase()];
  if (keyword) return keyword;
  const match = /^cubic-bezier\(([^)]*)\)$/i.exec(easing.trim());
  const values = match?.[1]?.split(",").map((v) => Number.parseFloat(v)) ?? [];
  const [x1, y1, x2, y2] = values;
  if (values.length !== 4 || [x1, y1, x2, y2].some((v) => v === undefined || Number.isNaN(v))) {
    return KEYWORD_EASING.ease ?? [0.25, 0.1, 0.25, 1];
  }
  return [x1 ?? 0, y1 ?? 0, x2 ?? 1, y2 ?? 1];
}

/** tokens.json in the W3C Design Tokens Format (DTCG). Provenance lives in $extensions. */
export function toDtcg(system: ThemaSystem): string {
  const { typography, spacing, radius, shadow, layout, motion } = system;
  const families = Object.entries(typography.families).filter(
    (e): e is [keyof typeof typography.families, string] => e[1] !== undefined,
  );

  const color = Object.fromEntries(
    THEMES.map((theme) => [
      theme,
      Object.fromEntries(
        COLOR_ROLES.map((role) => [role, token("color", colorValue(system.color[theme][role]))]),
      ),
    ]),
  );

  const typeScale = Object.fromEntries(
    typography.scale.map((step) => {
      const { slot } = familyForStep(typography.families, step.name);
      return [
        step.name,
        token("typography", {
          fontFamily: `{font.family.${slot}}`,
          fontSize: dimension(step.size),
          fontWeight: step.weight,
          lineHeight: step.lineHeight,
          letterSpacing: dimension(step.tracking * step.size),
        }),
      ];
    }),
  );

  const tokens: Json = {
    $description: `${provenance(system)} Edit tokens in Thema; this file is generated.`,
    $extensions: {
      "dev.thema": {
        version: system.meta.version,
        name: system.meta.name,
        sources: sourceUrls(system),
      },
    },
    color,
    font: {
      family: Object.fromEntries(
        families.map(([slot, name]) => [slot, token("fontFamily", fontStack(slot, name))]),
      ),
    },
    typography: typeScale,
    spacing: {
      base: token("dimension", dimension(spacing.base)),
      ...Object.fromEntries(
        spacing.scale.map((v) => [String(v), token("dimension", dimension(v))]),
      ),
    },
    radius: {
      sm: token("dimension", dimension(radius.sm)),
      md: token("dimension", dimension(radius.md)),
      lg: token("dimension", dimension(radius.lg)),
      full: token("dimension", dimension(radius.full)),
    },
    shadow: {
      sm: token("shadow", shadowValue(shadow.sm)),
      md: token("shadow", shadowValue(shadow.md)),
      lg: token("shadow", shadowValue(shadow.lg)),
    },
    layout: {
      containerMax: token("dimension", dimension(layout.containerMax)),
      gutter: token("dimension", dimension(layout.gutter)),
      sectionY: token("dimension", dimension(layout.sectionY)),
    },
    motion: {
      duration: {
        fast: token("duration", dimension(motion.durationFast, "ms")),
        base: token("duration", dimension(motion.durationBase, "ms")),
      },
      easing: token("cubicBezier", cubicBezier(motion.easing)),
    },
  };
  return `${JSON.stringify(tokens, null, 2)}\n`;
}
