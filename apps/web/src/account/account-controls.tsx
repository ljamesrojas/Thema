"use client";

import { buttonVariants } from "@/components/button";
import { AccountMenu } from "./account-menu";
import { useAccount, type AccountState } from "./use-account";

/**
 * The app's account corner: Sign in, or the signed-in person's menu. Nothing while loading or
 * when the server has no accounts, so anonymous use looks as it always has.
 */
export function AccountControls({ account, next }: { account: AccountState; next: string }) {
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
  return <AccountMenu me={me} current={next} />;
}

/**
 * The site header's account corner. Signed out (also while loading, or with accounts off or
 * unreachable) it's the "Sign in" text link before Start blending; signed in, the account menu
 * after it, in the far right corner. The header renders it in both places; each shows only its
 * own case.
 */
export function SiteAccount({ current, slot }: { current?: string; slot: "before" | "after" }) {
  const account = useAccount();
  const me = account.status === "ready" ? account.info.account : null;
  if (slot === "after")
    return me ? <AccountMenu me={me} {...(current ? { current } : {})} /> : null;
  if (me) return null;
  return (
    <a
      href="/sign-in"
      className="flex min-h-11 items-center px-3.5 text-label-md font-label-md text-ink no-underline"
    >
      Sign in
    </a>
  );
}
