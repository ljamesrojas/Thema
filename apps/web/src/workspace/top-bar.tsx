import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";

const TABS = [
  ["/workspace", "Workspace"],
  ["/preview", "Preview"],
  ["/export", "Export"],
] as const;

/** The app's top bar: project, the Workspace / Preview / Export switch, and the next step. */
export function TopBar({
  name,
  current,
  saved,
}: {
  name: string;
  current: (typeof TABS)[number][0];
  /** False when the browser blocks storage: the project then lasts only this visit. */
  saved: boolean;
}) {
  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" aria-label="Thema home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </a>
          <span aria-hidden="true" className="text-ink-faint">
            /
          </span>
          <h1 className="m-0 truncate text-label-md font-label-md font-semibold">{name}</h1>
          <span className="rounded-full border border-pill-border px-2 py-0.5 text-token font-token text-ink-subtle">
            {saved ? "Saved locally" : "Not saved: storage is blocked"}
          </span>
        </div>
        <nav
          aria-label="Project"
          className="flex gap-1 rounded-full border border-hairline bg-surface-subtle p-1"
        >
          {TABS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={href === current ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-full px-4 text-ui-sm font-ui-sm no-underline",
                href === current ? "bg-ink text-canvas" : "text-ink",
              )}
            >
              {label}
            </a>
          ))}
        </nav>
        <a href="/export" className={buttonVariants({ variant: "primary" })}>
          Export system
        </a>
      </div>
    </header>
  );
}
