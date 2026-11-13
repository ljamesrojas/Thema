import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A borrow chip (Colors, Type, Spacing, Shape, Layout): on = ink fill; off = hairline outline. */
export function Tag({
  pressed,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "min-h-11 rounded-full px-2.5 text-ui-sm font-ui-sm cursor-pointer",
        pressed ? "bg-ink text-canvas" : "border border-hairline bg-transparent text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/** A non-interactive label in the tag style, for showing which tags a reference claims. */
export function TagLabel({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-ink px-2.5 py-1 text-ui-sm font-ui-sm text-canvas">
      {children}
    </span>
  );
}
