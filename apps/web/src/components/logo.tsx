/** The logo: three stacked paint chips (paper, ink, kiln). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="14"
        height="20"
        rx="3"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
      />
      <rect x="7" y="5" width="14" height="20" rx="3" fill="var(--color-ink)" />
      <rect x="12" y="8" width="14" height="18" rx="3" fill="var(--color-primary)" />
    </svg>
  );
}
