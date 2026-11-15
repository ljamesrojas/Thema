"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/button";
import { signOut } from "./auth-client";
import type { AccountState } from "./use-account";

/**
 * Sign in, or Projects and Sign out. Nothing while loading or when the server has no accounts,
 * so anonymous use looks as it always has.
 */
export function AccountControls({ account, next }: { account: AccountState; next: string }) {
  const [leaving, setLeaving] = useState(false);
  if (account.status !== "ready" || !account.info.enabled) return null;
  const { account: me } = account.info;
  if (!me) {
    return (
      <a
        href={`/sign-in?next=${encodeURIComponent(next)}`}
        className={buttonVariants({ variant: "ghost" })}
      >
        Sign in
      </a>
    );
  }
  return (
    <span className="flex items-center gap-1">
      {next !== "/projects" && (
        <a href="/projects" className={buttonVariants({ variant: "ghost" })}>
          Projects
        </a>
      )}
      <button
        type="button"
        disabled={leaving}
        aria-label={`Sign out ${me.name}`}
        onClick={() => {
          setLeaving(true);
          signOut().then(
            () => window.location.assign("/"),
            () => setLeaving(false),
          );
        }}
        className={buttonVariants({ variant: "ghost" })}
      >
        Sign out
      </button>
    </span>
  );
}
