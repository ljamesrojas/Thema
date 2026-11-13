import { buttonVariants } from "@/components/button";
import { TopBar } from "@/workspace/top-bar";

/** Placeholder until Session 12 builds the Preview screen. */
export default function PreviewPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar name="Untitled system" current="/preview" saved />
      <main className="mx-auto flex max-w-[720px] flex-1 flex-col items-start justify-center gap-6 px-8">
        <h2 className="m-0 text-h2 font-h2">Preview is on its way.</h2>
        <p className="m-0 text-body-lg font-body-lg text-ink-soft">
          Your system on a landing page, a dashboard and a settings form, in light and dark, arrives
          in the next session.
        </p>
        <a href="/workspace" className={buttonVariants({ variant: "ghost" })}>
          Back to the workspace
        </a>
      </main>
    </div>
  );
}
