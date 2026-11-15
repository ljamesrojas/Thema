// shadcn/ui components for the previews (Button, Card, Input, Label, Badge, Table, Separator are
// adapted from shadcn/ui, MIT). They read only the CSS variables the preview frame sets from the
// user's exported shadcn.css and theme.css, never Thema's own tokens: `bg-(--primary)` is the
// user's primary, while Thema's `bg-primary` is Kiln. Switch, Checkbox and Select are native
// elements styled the same way (shadcn's need Radix, a dependency we don't add).
//
// Every text color here sits on a background the fixer checks it against (WCAG AA): foreground
// on background/card, muted-foreground on background/muted, primary-foreground on primary,
// destructive on background. Primary is never small text (it's only checked at 3:1).
import { cva, type VariantProps } from "class-variance-authority";
import type {
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { type } from "./variables";

export const buttonVariants = cva(
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-(--radius) px-4 py-2 font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-(--primary) text-(--primary-foreground)",
        secondary: "bg-(--secondary) text-(--secondary-foreground)",
        outline: "border border-(--border) bg-(--background) text-(--foreground)",
        ghost: "bg-transparent text-(--foreground)",
        /** shadcn fills it; outline keeps the text on the canvas, a pair the fixer checks. */
        destructive: "border border-(--destructive) bg-(--background) text-(--destructive)",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  variant,
  className,
  type: buttonType = "button",
  style,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={buttonType}
      className={cn(buttonVariants({ variant }), className)}
      style={{ ...type("sm"), fontWeight: 500, ...style }}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-(--radius-lg) border border-(--border) bg-(--card) p-5 text-(--card-foreground) shadow-(--shadow-sm)",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ children, as: Tag = "h3" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return (
    <Tag className="m-0" style={{ ...type("lg"), fontWeight: 600, fontFamily: "var(--font-sans)" }}>
      {children}
    </Tag>
  );
}

export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("m-0 text-(--muted-foreground)", className)} style={type("sm")}>
      {children}
    </p>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-(--foreground)", className)}
      style={{ ...type("sm"), fontWeight: 500 }}
      {...props}
    />
  );
}

const fieldClass =
  "min-h-9 w-full rounded-(--radius) border border-(--input) bg-(--background) px-3 py-2 text-(--foreground) outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} style={type("sm")} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(fieldClass, "min-h-20", className)} style={type("sm")} {...props} />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, className)} style={type("sm")} {...props} />;
}

/** A native checkbox with role="switch": a track in input/primary and a knob. */
export function Switch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "relative h-5 w-9 flex-none cursor-pointer appearance-none rounded-full bg-(--input) transition-colors checked:bg-(--primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
        "before:absolute before:top-0.5 before:left-0.5 before:size-4 before:rounded-full before:bg-(--background) before:transition-transform checked:before:translate-x-4",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 flex-none cursor-pointer accent-(--primary)", className)}
      {...props}
    />
  );
}

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5", {
  variants: {
    variant: {
      default: "border-transparent bg-(--primary) text-(--primary-foreground)",
      secondary: "border-transparent bg-(--secondary) text-(--secondary-foreground)",
      outline: "border-(--border) text-(--foreground)",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  variant,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      style={{ ...type("xs"), fontWeight: 600 }}
      {...props}
    />
  );
}

export function Separator() {
  return <hr className="m-0 h-px border-0 bg-(--border)" />;
}

/** A table that scrolls sideways on narrow frames; the scroll area is keyboard-reachable. */
export function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left" style={type("sm")}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-(--border) px-3 py-2 font-medium text-(--muted-foreground)">
      {children}
    </th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-(--border) px-3 py-2.5">{children}</td>;
}
