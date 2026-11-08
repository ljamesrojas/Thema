import { ROLE_WEIGHT, TAG_ROLE, type SampleRole } from "./constants.js";
import type { StyleSample } from "./types.js";

/** The sample's role, falling back to its tag when the worker sent none. */
export function sampleRole(sample: StyleSample): SampleRole {
  return sample.role ?? TAG_ROLE[sample.tag.toLowerCase()] ?? "body";
}

/** Containers only inherit text styles (color, font), so they don't count as visible text. */
export function isTextSample(sample: StyleSample): boolean {
  return sampleRole(sample) !== "container";
}

/** Visible area × importance weight. 0 for samples with no visible area. */
export function sampleWeight(sample: StyleSample): number {
  return sample.area > 0 ? sample.area * ROLE_WEIGHT[sampleRole(sample)] : 0;
}

/** Sort comparator: higher score first, ties broken by key ascending, so results are stable. */
export function byScoreThenKey<K extends string | number>(
  a: readonly [K, number],
  b: readonly [K, number],
): number {
  if (b[1] !== a[1]) return b[1] - a[1];
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}
