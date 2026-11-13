/**
 * The logo: three stacked paint chips (paper, ink, kiln). `inverted` is for the black band and
 * footer: the paper chip becomes an outline in band ink and the ink chip turns light, so all
 * three stay visible on black.
 */
export function Logo({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const paper = inverted ? "transparent" : "var(--color-surface)";
  const outline = inverted ? "var(--color-band-ink)" : "var(--color-ink)";
  const middle = inverted ? "var(--color-band-ink)" : "var(--color-ink)";
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="14"
        height="20"
        rx="3"
        fill={paper}
        stroke={outline}
        strokeWidth="1.5"
      />
      <rect x="7" y="5" width="14" height="20" rx="3" fill={middle} />
      <rect x="12" y="8" width="14" height="18" rx="3" fill="var(--color-primary)" />
    </svg>
  );
}
