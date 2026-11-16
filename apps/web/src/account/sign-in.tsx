"use client";

import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";
import type { Provider } from "@/server/auth";
import { PLANS } from "@/server/plans";
import { CheckIcon } from "@/site/icons";
import { safeNext, signIn } from "./auth-client";
import { useAccount } from "./use-account";

const PROVIDER_LABEL: Record<Provider, string> = { github: "GitHub", google: "Google" };

export type SignInMode = "signin" | "signup";

/** The heading copy per mode (docs/pages.md → Sign in / Create account). Same OAuth flow. */
const COPY: Record<SignInMode, { eyebrow: string; title: string; lead: string }> = {
  signin: {
    eyebrow: "Welcome back",
    title: "Sign in to Thema",
    lead: "Pick up your saved blends where you left them.",
  },
  signup: {
    eyebrow: "Free account",
    title: "Create your account",
    lead: "One click with GitHub or Google. Keep your blends and open them anywhere.",
  },
};

/** What a free account gets, from PLANS, so the page follows SPEC when limits change. */
export const FREE_LINES = [
  `${PLANS.free.savedProjects} saved projects, on any device`,
  `${PLANS.free.dailyExtractions} new extractions a day`,
  "The project in this browser comes with you",
];

/** /sign-in with these query values (mode and where to return), dropping the defaults. */
const signInHref = (mode: SignInMode, next: string | null) => {
  const params = new URLSearchParams();
  if (mode === "signup") params.set("mode", "signup");
  if (next) params.set("next", next);
  const query = params.toString();
  return query ? `/sign-in?${query}` : "/sign-in";
};

/** The logo's three chips (paper, kiln, dark) as slim bars: decoration only. */
const CHIP_BARS = ["bg-band-ink", "bg-primary", "bg-band-chip"] as const;

/**
 * The black brand panel, kept simple (docs/pages.md → Sign in): the logo, "Taste, exported.",
 * one line and three chip bars, vertically centered, with the footer line at the bottom.
 */
function BrandPanel() {
  return (
    <section
      aria-label="Thema"
      className="relative flex flex-col gap-10 overflow-hidden bg-band px-6 py-8 text-band-ink sm:px-14 lg:py-12"
    >
      {/* Faint dot grid. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--color-band-hairline) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <a
        href="/"
        className="relative flex min-h-11 w-fit items-center gap-2.5 text-band-ink no-underline"
      >
        <Logo size={26} inverted />
        <span className="text-h3 font-h3">Thema</span>
      </a>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-7 text-center">
        <p
          className="m-0 text-display font-display text-band-ink"
          style={{ fontSize: "clamp(44px, 5.5vw, 64px)" }}
        >
          Taste,
          <br />
          <span className="border-b-[3px] border-primary font-display-accent font-normal italic tracking-[-0.01em]">
            exported.
          </span>
        </p>
        <p className="m-0 hidden max-w-[440px] text-lead font-lead text-balance text-band-ink-soft lg:block">
          Your blends, saved to your account and ready on any device.
        </p>
        <span aria-hidden="true" data-testid="chip-bars" className="hidden gap-2 lg:flex">
          {CHIP_BARS.map((color) => (
            <span key={color} className={cn("h-1.5 w-10 rounded-full", color)} />
          ))}
        </span>
      </div>

      <p className="relative m-0 hidden min-h-11 items-end justify-center text-caption font-caption text-band-ink-muted lg:flex">
        © 2026 Thema · Inspired by, never cloned.
      </p>
    </section>
  );
}

/** A full-width 52px pill. */
const pill =
  "flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-full px-6 text-body-md font-body-md font-medium disabled:cursor-wait disabled:opacity-70";

/**
 * Sign in / Create account (SPEC: signing in unlocks saved projects; docs/pages.md and
 * docs/mockups/sign-in.png). GitHub or Google, no passwords; `mode` changes the copy only.
 */
export function SignInScreen({
  next,
  mode = "signin",
}: {
  next: string | null;
  mode?: SignInMode;
}) {
  const account = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Provider | null>(null);
  const target = safeNext(next);
  const copy = COPY[mode];

  let body: ReactNode;
  if (account.status === "loading") {
    body = (
      <p role="status" className="m-0 text-body-md font-body-md text-ink-muted">
        Checking your account…
      </p>
    );
  } else if (account.status === "unavailable" || !account.info.enabled) {
    body = (
      <div className="flex flex-col items-start gap-4">
        <p className="m-0 text-body-md font-body-md text-ink-soft">
          Accounts aren&apos;t set up on this server. Your project is saved in this browser.
        </p>
        <a href="/workspace" className={buttonVariants({ variant: "secondary" })}>
          Go to the Workspace
        </a>
      </div>
    );
  } else if (account.info.account) {
    body = (
      <div className="flex flex-col items-start gap-4">
        <p className="m-0 text-body-md font-body-md text-ink-soft">
          You&apos;re signed in as {account.info.account.name}.
        </p>
        <a href="/projects" className={buttonVariants({ variant: "secondary" })}>
          Go to your projects
        </a>
      </div>
    );
  } else {
    body = (
      <>
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
              className={cn(
                pill,
                provider === "github"
                  ? "border-0 bg-ink text-canvas"
                  : "border border-pill-border bg-surface text-ink",
              )}
            >
              {leaving === provider
                ? `Opening ${PROVIDER_LABEL[provider]}…`
                : `Continue with ${PROVIDER_LABEL[provider]}`}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="m-0 text-ui-sm font-ui-sm text-danger">
            {error}
          </p>
        )}
        <section
          aria-label="Free account"
          className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-subtle p-5"
        >
          <span className="text-token font-token text-ink-subtle">Free account</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body-sm font-body-sm text-ink">
            {FREE_LINES.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1 text-success">
                  <CheckIcon />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </section>
        <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">
          Thema only gets your name and email from GitHub or Google. No password is stored. See our{" "}
          <a href="/privacy" className="text-primary-strong underline">
            Privacy notice
          </a>
          .
        </p>
      </>
    );
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col px-6 py-8 sm:px-14 lg:py-12">
        <a
          href="/"
          className="flex min-h-11 w-fit items-center gap-2 text-label-md font-label-md text-ink no-underline"
        >
          <span aria-hidden="true">←</span> Home
        </a>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 py-10">
          <div className="flex flex-col gap-3">
            <p className="m-0 text-eyebrow font-eyebrow text-primary-strong uppercase">
              {copy.eyebrow}
            </p>
            <h1 className="m-0 text-h2 font-h2">
              {copy.title}
              <span className="font-display-accent font-normal italic">.</span>
            </h1>
            <p className="m-0 text-body-md font-body-md text-ink-muted">{copy.lead}</p>
          </div>

          {body}

          <div className="flex flex-col gap-3 border-t border-hairline pt-6">
            <p className="m-0 text-body-md font-body-md text-ink">
              {mode === "signin" ? "New to Thema? " : "Already have an account? "}
              <a
                href={signInHref(mode === "signin" ? "signup" : "signin", next)}
                className="font-semibold text-ink underline"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </a>
            </p>
            <a
              href="/workspace"
              className="flex min-h-11 w-fit items-center text-ui-sm font-ui-sm text-ink-muted no-underline"
            >
              Or keep blending without an account →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
