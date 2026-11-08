import { analyzeColors } from "./colors.js";
import { parseCssColor } from "./color-math.js";
import { DARK_CANVAS_LIGHTNESS } from "./constants.js";
import type { StyleSample } from "./types.js";

function canvasLightness(samples: readonly StyleSample[]): number | null {
  const canvas = analyzeColors(samples).roles.canvas;
  return canvas === undefined ? null : (parseCssColor(canvas)?.l ?? null);
}

/**
 * True when a page has a real dark theme: the canvas from the light-scheme pass is light and
 * the canvas from the `prefers-color-scheme: dark` pass is dark. Sites that ignore the
 * preference render the same canvas twice and return false.
 */
export function canvasFlipsInDark(
  light: readonly StyleSample[],
  dark: readonly StyleSample[],
): boolean {
  const lightL = canvasLightness(light);
  const darkL = canvasLightness(dark);
  if (lightL === null || darkL === null) return false;
  return lightL > DARK_CANVAS_LIGHTNESS && darkL < DARK_CANVAS_LIGHTNESS;
}
