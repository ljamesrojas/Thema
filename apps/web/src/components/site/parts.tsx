// Pieces every marketing page shares (docs/landing-white.md, docs/pages.md): the serif italic
// accent word, the mono eyebrow, the page hero and the closing call to action.
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";

/** The 1200px container with 32px side padding. */
export const container = "mx-auto w-full max-w-[1200px] px-8";

/**
 * The serif italic accent: one per headline (DESIGN.md → Typography). The site pages' hero
 * headings don't use it: they're plain Geist throughout (user's call).
 */
export function Accent({ children, underline = false }: { children: string; underline?: boolean }) {
  return (
    <span
      className={cn(
        "font-display-accent italic font-normal tracking-[-0.01em]",
        underline && "border-b-4 border-primary",
      )}
    >
      {children}
    </span>
  );
}

const EYEBROW_TONE = {
  subtle: "text-ink-subtle",
  kiln: "text-primary-strong",
  band: "text-band-accent",
} as const;

/**
 * Mono eyebrow: Kiln Deep for numbered section labels, band accent on the black band, ink subtle
 * otherwise. One color class only (no tailwind-merge, so two would fight over CSS order).
 */
export function Eyebrow({
  children,
  tone = "subtle",
}: {
  children: string;
  tone?: keyof typeof EYEBROW_TONE;
}) {
  return (
    <p className={cn("m-0 text-eyebrow font-eyebrow uppercase", EYEBROW_TONE[tone])}>{children}</p>
  );
}

/** A page's hero (docs/pages.md): Kiln Deep eyebrow, 72px h1 with one accent word, subhead. */
export function PageHero({
  eyebrow,
  title,
  subhead,
  centered = false,
  split = false,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subhead: ReactNode;
  centered?: boolean;
  /** Subhead in a right-hand column, level with the heading's last line (How it works). */
  split?: boolean;
  children?: ReactNode;
}) {
  if (split) {
    return (
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="flex flex-col gap-6">
          <Eyebrow tone="kiln">{eyebrow}</Eyebrow>
          <h1
            className="m-0 max-w-[16ch] text-h1 font-h1"
            style={{ fontSize: "clamp(44px, 7vw, var(--text-h1))" }}
          >
            {title}
          </h1>
        </div>
        <p className="m-0 text-body-lg font-body-lg text-ink-soft lg:pb-2">{subhead}</p>
        {children}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-6", centered && "items-center text-center")}>
      <Eyebrow tone="kiln">{eyebrow}</Eyebrow>
      <h1
        className="m-0 max-w-[16ch] text-h1 font-h1"
        style={{ fontSize: "clamp(44px, 7vw, var(--text-h1))" }}
      >
        {title}
      </h1>
      <p className="m-0 max-w-[620px] text-body-lg font-body-lg text-ink-soft">{subhead}</p>
      {children}
    </div>
  );
}

/** The closing call to action every page ends with: headline, one line, one pill to `/`. */
export function ClosingCta({
  title,
  line,
  action,
}: {
  title: ReactNode;
  line: string;
  action: string;
}) {
  return (
    <section aria-label="Get started" className="border-t border-hairline bg-canvas">
      <div className={cn(container, "flex flex-col items-center gap-6 py-26 text-center")}>
        <h2 className="m-0 text-h2-lg font-h2-lg">{title}</h2>
        <p className="m-0 text-lead font-lead text-ink-muted">{line}</p>
        <a href="/" className={buttonVariants({ variant: "primary" })}>
          {action}
        </a>
      </div>
    </section>
  );
}

/** A section with the page rhythm: 104px padding, white or surface-subtle, hairline on top. */
export function Band({
  tone = "canvas",
  id,
  label,
  children,
  className,
}: {
  tone?: "canvas" | "subtle" | "band";
  id?: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      {...(id ? { id } : {})}
      {...(label ? { "aria-label": label } : {})}
      className={cn(
        tone === "canvas" && "border-t border-hairline bg-canvas",
        tone === "subtle" && "border-t border-hairline bg-surface-subtle",
        tone === "band" && "bg-band text-band-ink",
      )}
    >
      <div className={cn(container, "py-26", className)}>{children}</div>
    </section>
  );
}
