// The browser side of sign-in (Better Auth's client): start a GitHub/Google sign-in, sign out.
import { createAuthClient } from "better-auth/client";
import type { Provider } from "@/server/auth";
import { browserStorage, loadProject, STORAGE_KEY } from "@/workspace/project";

// fetch is looked up per call, not captured at import (tests and polyfills swap it).
const client = createAuthClient({
  fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) },
});

/** Only same-site paths, so a crafted ?next= can't send people elsewhere after signing in. */
export const safeNext = (next: string | null | undefined): string =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/workspace";

/** Leaves for GitHub or Google; comes back to `next`. */
export async function signIn(provider: Provider, next: string): Promise<void> {
  const result = await client.signIn.social({ provider, callbackURL: safeNext(next) });
  if (result.error) throw new Error(result.error.message ?? "Couldn't start signing in.");
}

/**
 * Sign out. A project saved to the account is removed from this browser (it's in the account),
 * so the next person here starts fresh; a project that was never saved stays.
 */
export async function signOut(): Promise<void> {
  await client.signOut();
  const storage = browserStorage();
  if (loadProject(storage)?.account) storage?.removeItem(STORAGE_KEY);
}
