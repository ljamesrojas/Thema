// Small line icons for the site pages (stroke follows the text color; hidden from assistive tech,
// the text next to each one says what it means).
const base = {
  "aria-hidden": true,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="m3 8.5 3 3 7-7" />
  </svg>
);

export const CrossIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

export const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

/** A padlock, closed or open. */
export const LockIcon = ({ open = false, size = 14 }: { open?: boolean; size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d={open ? "M5.5 7V5a2.5 2.5 0 0 1 4.9-.7" : "M5.5 7V5a2.5 2.5 0 0 1 5 0v2"} />
  </svg>
);
