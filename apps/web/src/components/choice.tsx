import { cn } from "@/lib/cn";

/** A row of pressed/unpressed buttons (one choice of several). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-0.5 rounded-full border border-pill-border bg-surface p-0.5"
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "min-h-11 cursor-pointer rounded-full border-0 px-4 text-ui-sm font-ui-sm",
            value === id ? "bg-ink text-canvas" : "bg-transparent text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
