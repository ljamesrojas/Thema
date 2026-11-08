import { deltaEOK, formatOklch, parseCssColor, type Oklch } from "./color-math.js";
import { CLUSTER_DELTA_E } from "./constants.js";

export interface ClusterInput {
  color: Oklch;
  weight: number;
}

export interface ColorCluster<T extends ClusterInput> {
  /** Representative: the heaviest exact color in the cluster (a real site color, not an average). */
  color: Oklch;
  /** Representative formatted as an OKLCH string. */
  key: string;
  members: T[];
}

/**
 * Greedy, deterministic clustering by ΔE OK.
 * 1. Group entries with the same formatted color.
 * 2. Sort those groups heaviest first (ties broken by the OKLCH string).
 * 3. Each group joins the first existing cluster within `threshold` of its representative,
 *    or starts a new cluster. Clusters come back heaviest-representative first.
 * Output does not depend on input order.
 */
export function clusterColors<T extends ClusterInput>(
  entries: readonly T[],
  threshold: number = CLUSTER_DELTA_E,
): ColorCluster<T>[] {
  const groups = new Map<string, { color: Oklch; weight: number; members: T[] }>();
  for (const entry of entries) {
    const key = formatOklch(entry.color);
    const group = groups.get(key);
    if (group) {
      group.weight += entry.weight;
      group.members.push(entry);
    } else {
      // Re-derive from the key so sub-rounding differences between inputs can't leak through.
      const color = parseCssColor(key) ?? entry.color;
      groups.set(key, { color, weight: entry.weight, members: [entry] });
    }
  }

  const sorted = [...groups.entries()].sort(([keyA, a], [keyB, b]) =>
    b.weight !== a.weight ? b.weight - a.weight : keyA < keyB ? -1 : keyA > keyB ? 1 : 0,
  );

  const clusters: ColorCluster<T>[] = [];
  for (const [key, group] of sorted) {
    const home = clusters.find((c) => deltaEOK(c.color, group.color) < threshold);
    if (home) {
      home.members.push(...group.members);
    } else {
      clusters.push({ color: group.color, key, members: [...group.members] });
    }
  }
  return clusters;
}
