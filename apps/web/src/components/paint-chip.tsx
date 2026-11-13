import { wcagContrast } from "culori";

/**
 * The text color for a chip: whichever of white or the system's ink reads better on it
 * (DESIGN.md → chip-swatch). Both arguments are CSS colors from the user's system.
 */
export function chipTextColor(background: string, ink: string): string {
  const white = "white";
  return wcagContrast(white, background) >= wcagContrast(ink, background) ? white : ink;
}

/** A paint chip: a tall rounded swatch with its name, a short rule and its hex in mono. */
export function PaintChip({
  name,
  color,
  hex,
  ink,
}: {
  name: string;
  /** The chip's color as CSS (the user's OKLCH value). */
  color: string;
  /** The hex shown on the chip. */
  hex: string;
  /** The system's ink, a candidate for the chip's text. */
  ink: string;
}) {
  return (
    <figure
      className="m-0 flex h-[168px] flex-col justify-end gap-1.5 rounded-md border border-hairline p-3"
      style={{ background: color, color: chipTextColor(color, ink) }}
    >
      <figcaption className="text-ui-sm font-ui-sm">{name}</figcaption>
      <span aria-hidden="true" className="h-[1.5px] w-[18px] bg-current" />
      <code className="text-token font-token">{hex}</code>
    </figure>
  );
}
