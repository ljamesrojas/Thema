// The marketing pages' header (docs/pages.md → Shared): logo, the four pages, GitHub, Sign in and
// Start blending. The current page's link carries aria-current="page" and a Kiln underline.
import { buttonVariants } from "@/components/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import { container } from "./parts";

export const GITHUB_URL = "https://github.com/ljamesrojas/Thema";

export const SITE_PAGES = [
  ["/how-it-works", "How it works"],
  ["/exports", "Exports"],
  ["/agents", "For agents"],
  ["/pricing", "Pricing"],
] as const;

export type SitePage = (typeof SITE_PAGES)[number][0];

/** Arrow up-right: marks a link that leaves Thema. */
export function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 11 11 5M6 5h5v5" />
    </svg>
  );
}

/** The repo link: opens in a new tab and says so to screen readers. */
export function GitHubLink({
  className,
  label = "GitHub",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a href={GITHUB_URL} target="_blank" rel="noopener" className={className}>
      {label}
      <ExternalIcon />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const navLink =
  "flex min-h-11 items-center gap-1 border-b-2 text-label-md font-label-md no-underline";

export function SiteHeader({ current }: { current?: SitePage }) {
  return (
    <header className="border-b border-hairline bg-canvas">
      <nav
        aria-label="Main"
        className={cn(container, "flex flex-wrap items-center justify-between gap-4 py-4")}
      >
        <a href="/" className="flex min-h-11 items-center gap-2.5 text-ink no-underline">
          <Logo />
          <span className="text-h3 font-h3">Thema</span>
        </a>
        <div className="flex flex-wrap gap-x-7 gap-y-1">
          {SITE_PAGES.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={href === current ? "page" : undefined}
              className={cn(
                navLink,
                href === current
                  ? "border-primary font-medium text-ink"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </a>
          ))}
          <GitHubLink className={cn(navLink, "border-transparent text-ink-soft hover:text-ink")} />
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/sign-in"
            className="flex min-h-11 items-center px-3.5 text-label-md font-label-md text-ink no-underline"
          >
            Sign in
          </a>
          <a href="/" className={buttonVariants({ variant: "secondary" })}>
            Start blending
          </a>
        </div>
      </nav>
    </header>
  );
}
