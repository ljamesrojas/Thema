import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";

/** Placeholder until Session 11 builds the Workspace. */
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>;
}) {
  const { url } = await searchParams;
  const site = typeof url === "string" ? url : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col items-start justify-center gap-6 px-8">
      <Logo size={40} />
      <h1 className="m-0 text-h2 font-h2">The workspace is on its way.</h1>
      <p className="m-0 text-body-lg font-body-lg text-ink-soft">
        {site ? (
          <>
            You asked for <code className="text-token font-token">{site}</code>. Extraction,
            borrowing and the live blend arrive in the next sessions.
          </>
        ) : (
          "Extraction, borrowing and the live blend arrive in the next sessions."
        )}
      </p>
      <a href="/" className={buttonVariants({ variant: "ghost" })}>
        Back to the start
      </a>
    </main>
  );
}
