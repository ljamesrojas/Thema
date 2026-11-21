import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import { container } from "./parts";
import { GitHubLink, SITE_PAGES } from "./site-header";

const link = "flex min-h-11 items-center gap-1 text-band-link";

/**
 * The black footer (docs/pages.md → Shared), with the legal pages (docs/legal/*.md, which Paddle
 * needs to see before it approves selling Pro).
 */
export function SiteFooter() {
  return (
    <footer className="bg-band text-band-ink-muted">
      <div
        className={cn(
          container,
          "flex flex-wrap items-center justify-between gap-4 py-8 text-caption font-caption",
        )}
      >
        <span className="flex items-center gap-3">
          <Logo size={24} inverted />
          <span>© 2026 Thema · Inspired by, never cloned.</span>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          {SITE_PAGES.map(([href, label]) => (
            <a key={href} href={href} className={link}>
              {label}
            </a>
          ))}
          <GitHubLink className={link} />
          {[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/refunds", "Refunds"],
          ].map(([href, label]) => (
            <a key={href} href={href} className={link}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
