import type { Metadata } from "next";
import { SignInScreen } from "@/account/sign-in";

export const metadata: Metadata = { title: "Sign in · Thema" };

/**
 * Sign in or create an account with GitHub or Google. `?mode=signup` shows the "Create your
 * account" copy (same OAuth flow); `?next=` is where to return (same-site paths only).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; mode?: string | string[] }>;
}) {
  const { next, mode } = await searchParams;
  return (
    <SignInScreen
      next={typeof next === "string" ? next : null}
      mode={mode === "signup" ? "signup" : "signin"}
    />
  );
}
