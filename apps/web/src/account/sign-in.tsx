"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/button";
import type { Provider } from "@/server/auth";
import { PLANS } from "@/server/plans";
import { safeNext, signIn } from "./auth-client";
import { useAccount } from "./use-account";

const PROVIDER_LABEL: Record<Provider, string> = { github: "GitHub", google: "Google" };

/** Sign in (SPEC: signing in unlocks saved projects). GitHub or Google; no passwords. */
export function SignInScreen({ next }: { next: string | null }) {
  const account = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Provider | null>(null);
  const target = safeNext(next);

  let body;
  if (account.status === "loading") {
    body = (
      <p role="status" className="m-0 text-body-md font-body-md text-ink-muted">
        Checking your account…
      </p>
    );
  } else if (account.status === "unavailable" || !account.info.enabled) {
    body = (
      <>
        <p className="m-0 text-body-lg font-body-lg text-ink-soft">
          Accounts aren&apos;t set up on this server. Your project is saved in this browser.
        </p>
        <a href="/workspace" className={buttonVariants({ variant: "secondary" })}>
          Go to the Workspace
        </a>
      </>
    );
  } else if (account.info.account) {
    body = (
      <>
        <p className="m-0 text-body-lg font-body-lg text-ink-soft">
          You&apos;re signed in as {account.info.account.name}.
        </p>
        <a href="/projects" className={buttonVariants({ variant: "secondary" })}>
          Go to your projects
        </a>
      </>
    );
  } else {
    body = (
      <>
        <p className="m-0 text-body-lg font-body-lg text-ink-soft">
          Save up to {PLANS.free.savedProjects} projects and open them on any device, with{" "}
          {PLANS.free.dailyExtractions} new extractions a day. The project in this browser is saved
          to your account when you sign in.
        </p>
        <div className="flex flex-col gap-3">
          {account.info.providers.map((provider) => (
            <button
              key={provider}
              type="button"
              disabled={leaving !== null}
              onClick={() => {
                setLeaving(provider);
                setError(null);
                signIn(provider, target).catch((failure: unknown) => {
                  setLeaving(null);
                  setError(failure instanceof Error ? failure.message : "Couldn't sign in.");
                });
              }}
              className={buttonVariants({ variant: "secondary" })}
            >
              {leaving === provider ? "Opening…" : `Continue with ${PROVIDER_LABEL[provider]}`}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="m-0 text-ui-sm font-ui-sm text-danger">
            {error}
          </p>
        )}
        <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">
          Thema gets your name and email from them, nothing else. No password is stored.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline px-6 py-3">
        <a href="/" aria-label="Thema home" className="flex min-h-11 w-fit items-center">
          <Logo size={26} />
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-5 px-6 py-10">
        <h1 className="m-0 text-h2 font-h2">Sign in to Thema</h1>
        {body}
      </main>
    </div>
  );
}
