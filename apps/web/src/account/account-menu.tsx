"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { api, type AccountInfo } from "@/workspace/api";
import { browserStorage, loadProject, STORAGE_KEY } from "@/workspace/project";
import { signOut } from "./auth-client";

type Me = NonNullable<AccountInfo["account"]>;

/** Up to two initials from the name ("Ana Reyes" → "AR"), else the email's first letter. */
export function initials(me: Pick<Me, "name" | "email">): string {
  const words = me.name.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("");
  return (letters || me.email[0] || "?").toUpperCase();
}

/** The panel's width (w-64) and the room it keeps from the window's edges. */
const PANEL_WIDTH = 256;
const MARGIN = 16;

const item =
  "flex min-h-11 w-full items-center rounded-md px-3 text-ui-sm font-ui-sm text-ink no-underline hover:bg-surface-subtle";

/**
 * The signed-in person's menu, top right: a round button with their initials (no photo, so
 * Thema makes no requests to GitHub or Google) that opens a small panel: who's signed in and
 * their plan, Your projects, Plans and pricing, Sign out, Delete account (with a confirm step;
 * deleted right away, user's call). A disclosure (button + panel of links), not an ARIA menu:
 * Tab moves through it, Escape or a click outside closes it.
 */
export function AccountMenu({ me, current }: { me: Me; current?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The panel shows a confirm step instead of the links while deleting the account. */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /**
   * The panel's left edge relative to the button: right-aligned under it where there's room,
   * moved just enough to stay MARGIN inside the window otherwise (a phone's mid-header button).
   */
  const [left, setLeft] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
    setDeleteError(null);
  };

  async function deleteAccount() {
    setLeaving(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      // The account's project leaves this browser too; an unsaved one would have no account.
      const storage = browserStorage();
      if (loadProject(storage)?.account) storage?.removeItem(STORAGE_KEY);
      window.location.assign("/");
    } catch (failure) {
      setLeaving(false);
      setDeleteError(failure instanceof Error ? failure.message : "Couldn't delete your account.");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={`Account: ${me.name}`}
        onClick={() => {
          const box = button.current?.getBoundingClientRect();
          if (box) {
            const wanted = box.right - PANEL_WIDTH;
            const fits = Math.max(
              MARGIN,
              Math.min(wanted, window.innerWidth - PANEL_WIDTH - MARGIN),
            );
            setLeft(fits - box.left);
          }
          if (open) close();
          else setOpen(true);
        }}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-ink text-ui-sm font-ui-sm font-semibold text-canvas"
        >
          {initials(me)}
        </span>
      </button>

      <div
        id={`${id}-panel`}
        hidden={!open}
        className={cn(
          "absolute top-full z-20 mt-2 w-64 rounded-lg border border-hairline bg-surface p-2",
          left === null && "right-0",
        )}
        style={left === null ? undefined : { left }}
      >
        <div className="flex flex-col gap-1 border-b border-divider px-3 pt-2 pb-3">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-label-md font-label-md font-semibold text-ink">
              {me.name}
            </span>
            <span className="flex-none rounded-full border border-pill-border px-2 py-0.5 text-token font-token text-ink-subtle">
              {me.plan === "pro" ? "Pro" : "Free"}
            </span>
          </span>
          <span className="truncate text-ui-sm font-ui-sm text-ink-muted">{me.email}</span>
        </div>
        {confirmDelete ? (
          <div role="group" aria-labelledby={`${id}-delete`} className="flex flex-col gap-3 p-3">
            <p
              id={`${id}-delete`}
              className="m-0 text-label-md font-label-md font-semibold text-ink"
            >
              Delete your account?
            </p>
            <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">
              Your saved projects and their screenshots are deleted with it, right away. This
              can&apos;t be undone.
            </p>
            {deleteError && (
              <p role="alert" className="m-0 text-ui-sm font-ui-sm text-danger">
                {deleteError}
              </p>
            )}
            <span className="flex flex-col gap-2">
              <button
                type="button"
                disabled={leaving}
                onClick={() => void deleteAccount()}
                className="min-h-11 cursor-pointer rounded-full border-0 bg-danger px-4 text-ui-sm font-ui-sm font-semibold text-canvas disabled:cursor-wait disabled:opacity-70"
              >
                {leaving ? "Deleting…" : "Delete my account"}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => setConfirmDelete(false)}
                className="min-h-11 cursor-pointer rounded-full border border-pill-border bg-surface px-4 text-ui-sm font-ui-sm text-ink"
              >
                Keep my account
              </button>
            </span>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pt-2">
            <li>
              <a
                href="/projects"
                aria-current={current === "/projects" ? "page" : undefined}
                className={item}
              >
                Your projects
              </a>
            </li>
            <li>
              <a
                href="/pricing"
                aria-current={current === "/pricing" ? "page" : undefined}
                className={item}
              >
                Plans and pricing
              </a>
            </li>
            <li className="mt-1 border-t border-divider pt-1">
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  signOut().then(
                    () => window.location.assign("/"),
                    () => setLeaving(false),
                  );
                }}
                className={cn(item, "cursor-pointer border-0 bg-transparent text-left")}
              >
                {leaving ? "Signing out…" : "Sign out"}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={cn(item, "cursor-pointer border-0 bg-transparent text-left text-danger")}
              >
                Delete account
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
