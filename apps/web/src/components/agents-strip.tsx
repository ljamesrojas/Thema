import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./agents-strip.module.css";

/**
 * The agents Thema's exports work with. Generic line icons, never brand logos
 * (docs/landing-white.md → Agents strip). `color` names the DESIGN.md agent-* token.
 */
export const AGENTS: { name: string; color: string; icon: ReactNode }[] = [
  {
    name: "Claude Code",
    color: "agent-claude",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M7.5 10l3 2.5-3 2.5M12.5 15.5h4" />
      </>
    ),
  },
  { name: "Cursor", color: "agent-cursor", icon: <path d="M5 3.5l13.5 7-6 1.8-2.3 6.2z" /> },
  {
    name: "v0",
    color: "agent-v0",
    icon: <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" />,
  },
  {
    name: "Lovable",
    color: "agent-lovable",
    icon: (
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    ),
  },
  {
    name: "Windsurf",
    color: "agent-windsurf",
    icon: <path d="M3 9.5c3-3 6 3 9 0s6 3 9 0M3 15.5c3-3 6 3 9 0s6 3 9 0" />,
  },
  {
    name: "GitHub Copilot",
    color: "agent-copilot",
    icon: <path d="M21 3L3 10.5l7.2 2.8L13 21zM21 3L10.2 13.3" />,
  },
  {
    name: "Google Stitch",
    color: "agent-stitch",
    icon: (
      <>
        <path d="M3 11l3-4.5 3 4.5 3-4.5 3 4.5 3-4.5 3 4.5" />
        <path d="M3 17.5h18" strokeDasharray="2 3" />
      </>
    ),
  },
];

/** "Reads into": every item links to the agents section; hover and focus are CSS only. */
export function AgentsStrip({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-8 gap-y-3", className)}>
      <span
        className={cn(
          styles.label,
          "text-token font-token uppercase tracking-[0.04em] text-ink-subtle",
        )}
      >
        <span className={styles.dot} aria-hidden="true" />
        Reads into
      </span>
      <ul className={styles.items}>
        {AGENTS.map(({ name, color, icon }) => (
          <li key={name}>
            <a
              href="#agents"
              className={cn(styles.item, "text-label-md font-label-md")}
              style={{ "--agent-color": `var(--color-${color})` } as CSSProperties}
            >
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                {icon}
              </svg>
              {name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
