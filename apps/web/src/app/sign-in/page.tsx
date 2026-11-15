import { SignInScreen } from "@/account/sign-in";

/** Sign in with GitHub or Google. `?next=` is where to return (same-site paths only). */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignInScreen next={typeof next === "string" ? next : null} />;
}
