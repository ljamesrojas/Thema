import type { Metadata } from "next";
import { buttonVariants } from "@/components/button";
import { container, Eyebrow } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Page not found · Thema" };

/** Any address Thema doesn't have: the site's header and footer, and two ways back. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="bg-canvas">
        <section className={cn(container, "flex flex-col items-start gap-6 py-26")}>
          <Eyebrow tone="kiln">404</Eyebrow>
          <h1 className="m-0 text-h2 font-h2">This page doesn&apos;t exist.</h1>
          <p className="m-0 max-w-[560px] text-body-lg font-body-lg text-ink-soft">
            The address may be mistyped, or the page has moved. Your projects are safe.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/" className={buttonVariants({ variant: "secondary" })}>
              Go to the home page
            </a>
            <a href="/workspace" className={buttonVariants({ variant: "ghost" })}>
              Open the Workspace
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
