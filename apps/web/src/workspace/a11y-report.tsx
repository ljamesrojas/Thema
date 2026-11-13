import { CHECKED_PAIRS, type ColorRole, type ThemaSystem } from "@thema/engine";
import { wcagContrast } from "culori";
import { pairLockPath, type BlendReport } from "./project";

const ROLE_NAME: Partial<Record<ColorRole, string>> = {
  "ink-muted": "muted",
  "primary-ink": "label",
  "surface-raised": "raised",
};
const pairName = ([fg, bg]: [ColorRole, ColorRole]) =>
  `${ROLE_NAME[fg] ?? fg} / ${ROLE_NAME[bg] ?? bg}`;

/** Checked pairs that pass WCAG AA in one theme of the system. */
export function passingPairs(system: ThemaSystem, theme: "light" | "dark"): number {
  const colors = system.color[theme];
  return CHECKED_PAIRS.filter(({ fg, bg, min }) => wcagContrast(colors[fg], colors[bg]) >= min)
    .length;
}

/**
 * The accessibility report: the fixer's changes (a11y.fixes) and the pairs it couldn't fix, with
 * why. A pair a lock blocks says so and offers to unlock it.
 */
export function A11yReport({
  system,
  report,
  locks,
  onUnlock,
}: {
  system: ThemaSystem | undefined;
  report: BlendReport | undefined;
  locks: readonly string[];
  onUnlock: (path: string) => void;
}) {
  const total = CHECKED_PAIRS.length;
  const light = system ? passingPairs(system, "light") : 0;
  const dark = system ? passingPairs(system, "dark") : 0;
  const allPass = system !== undefined && light === total && dark === total;
  const fixes = system?.a11y.fixes ?? [];
  const unresolved = report?.unresolved ?? [];

  return (
    <section
      aria-labelledby="a11y-heading"
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4.5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="a11y-heading" className="m-0 text-label-md font-label-md font-semibold">
          Accessibility
        </h2>
        {system && (
          <span className={`text-token font-token ${allPass ? "text-success" : "text-danger"}`}>
            {allPass ? "✓ " : ""}
            {light}/{total} light · {dark}/{total} dark
          </span>
        )}
      </div>

      {!system ? (
        <p className="m-0 text-ui-sm font-ui-sm text-ink-muted">
          Every text and background pair is checked against WCAG 2.2 AA once your system is ready.
        </p>
      ) : (
        <>
          <p className="m-0 text-ui-sm font-ui-sm text-ink-soft">
            {fixes.length === 0
              ? "Every pair passed as borrowed."
              : `${fixes.length} ${fixes.length === 1 ? "pair" : "pairs"} adjusted to pass.`}
            {locks.length > 0 ? " Locked tokens were left alone." : ""}
          </p>
          {(fixes.length > 0 || unresolved.length > 0) && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-token font-token">
              {unresolved.map((pair) => {
                const path = pairLockPath(pair);
                const blockedByLock = pair.reason === "locked" && locks.includes(path);
                return (
                  <li
                    key={`u-${pair.theme}-${pair.pair.join("-")}`}
                    className="flex flex-col gap-1.5 rounded-sm border border-hairline bg-surface-subtle px-2.5 py-2"
                  >
                    <span className="flex justify-between gap-2">
                      <span>
                        {pairName(pair.pair)}
                        {pair.theme === "dark" ? " (dark)" : ""}
                      </span>
                      <span className="whitespace-nowrap text-danger">
                        {pair.ratio.toFixed(1)} &lt; {pair.min}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 text-danger">
                      {pair.reason === "locked" ? "locked: can't fix" : "no lightness passes"}
                      {blockedByLock && (
                        <button
                          type="button"
                          onClick={() => onUnlock(path)}
                          className="min-h-11 cursor-pointer rounded-full border border-pill-border bg-surface px-3 text-ui-sm font-ui-sm text-ink"
                        >
                          Unlock {ROLE_NAME[pair.pair[0]] ?? pair.pair[0]}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
              {fixes.map((fix) => (
                <li
                  key={`f-${fix.theme}-${fix.pair.join("-")}`}
                  className="flex justify-between gap-2 rounded-sm border border-hairline bg-surface-subtle px-2.5 py-2"
                >
                  <span>
                    {pairName(fix.pair)}
                    {fix.theme === "dark" ? " (dark)" : ""}
                  </span>
                  <span className="whitespace-nowrap text-success">
                    {fix.before.toFixed(1)} → {fix.after.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between pt-1 text-ui-sm font-ui-sm">
            <span>{report?.generated === "light" ? "Light mode" : "Dark mode"}</span>
            <span className="text-ink-muted">
              {report?.generated ? "Generated" : "From the sources"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
