// The legal pages (Privacy, Terms): the text is docs/legal/*.md, bundled at build time
// and rendered by lib/markdown, so editing the Markdown is all it takes to change a page.
import { container } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/markdown";

export function LegalPage({ title, markdown }: { title: string; markdown: string }) {
  return (
    <>
      <SiteHeader />
      <main className="bg-canvas">
        <article className={cn(container, "flex max-w-[760px] flex-col gap-4 py-20")}>
          <h1 className="m-0 mb-2 text-h2 font-h2">{title}</h1>
          {renderMarkdown(markdown)}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
