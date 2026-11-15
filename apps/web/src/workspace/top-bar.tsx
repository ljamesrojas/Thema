import { AccountControls } from "@/account/account-controls";
import type { AccountState } from "@/account/use-account";
import type { SyncStatus } from "@/account/use-project-sync";
import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";

const TABS = [
  ["/workspace", "Workspace"],
  ["/preview", "Preview"],
  ["/export", "Export"],
] as const;

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: "Saved locally",
  pending: "Saved locally",
  saving: "Saving…",
  saved: "Saved to your account",
  conflict: "Not saved: newer version elsewhere",
  limit: "Saved locally: project limit reached",
  error: "Saved locally: couldn't reach your account",
};

/** The app's top bar: project, the Workspace / Preview / Export switch, and the next step. */
export function TopBar({
  name,
  current,
  saved,
  sync,
  account,
}: {
  name: string;
  current: (typeof TABS)[number][0];
  /** False when the browser blocks storage: the project then lasts only this visit. */
  saved: boolean;
  /** Where the project is kept (see useProjectSync). */
  sync: SyncStatus;
  account: AccountState;
}) {
  // Three columns with equal sides, so the tabs sit in the same place on every screen whatever
  // the sides hold (the Export screen has no "Export system" button). Below lg the tabs take a
  // row of their own, centered, for the same reason.
  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" aria-label="Thema home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </a>
          <span aria-hidden="true" className="text-ink-faint">
            /
          </span>
          <h1 className="m-0 truncate text-label-md font-label-md font-semibold">{name}</h1>
          <span className="rounded-full border border-pill-border px-2 py-0.5 text-token font-token text-ink-subtle">
            {saved || sync === "saved" || sync === "saving"
              ? SYNC_LABEL[sync]
              : "Not saved: storage is blocked"}
          </span>
        </div>
        <div className="order-last flex w-full justify-center lg:order-none lg:w-auto">
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
        </div>
        <span className="flex items-center gap-2 lg:justify-self-end">
          <AccountControls account={account} next={current} />
          {/* One primary per view: the Export screen has its own (Download zip). On phones the
              Export tab does the same job, and the button would wrap onto a row of its own,
              moving the tabs down on two screens out of three. */}
          {current !== "/export" && (
            <span className="hidden sm:flex">
              <a href="/export" className={buttonVariants({ variant: "primary" })}>
                Export system
              </a>
            </span>
          )}
        </span>
      </div>
    </header>
  );
}
