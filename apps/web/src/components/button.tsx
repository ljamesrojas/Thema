import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** DESIGN.md buttons: full pills, 44px tall (the minimum touch target). */
export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-body-md font-body-md no-underline transition-colors duration-(--duration-fast) ease-(--ease-standard) cursor-pointer",
  {
    variants: {
      variant: {
        /** The next step: at most one per view. */
        primary: "bg-primary-strong px-6 text-on-primary hover:bg-primary-deep",
        secondary: "bg-ink px-5 text-canvas",
        ghost: "border border-pill-border bg-surface px-4 text-ink",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export function Button({
  variant,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
