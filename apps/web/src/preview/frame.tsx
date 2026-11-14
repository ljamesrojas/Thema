import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Variables } from "./variables";

export type Viewport = "desktop" | "mobile";

/**
 * Where a template renders: the user's variables are set here, on this element only, so
 * switching theme or system swaps variables and nothing else (no rebuild), and Thema's own
 * chrome around it is untouched. A container, so templates lay out by its width.
 */
export function PreviewFrame({
  variables,
  viewport,
  label,
  children,
}: {
  variables: Variables;
  viewport: Viewport;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      data-testid="preview-frame"
      className={cn(
        "@container overflow-hidden rounded-lg border border-hairline bg-(--background) text-(--foreground)",
        viewport === "mobile" ? "mx-auto w-full max-w-[390px]" : "w-full",
      )}
      style={variables}
    >
      {children}
    </div>
  );
}
