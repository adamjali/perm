import { Fragment } from "react";

import { STAGE_META, STAGE_ORDER, type StageGroup } from "./stages";

/**
 * One filing month's pending cases, drawn as a segmented bar.
 *
 * TWO SCALES, AND THE DIFFERENCE IS THE WHOLE POINT.
 *
 * `scale="composition"` fills the track and answers "what is this month made
 * of". `scale={someMax}` draws every bar against one shared maximum and
 * answers "how big is this month next to the others", which is the question a
 * backlog is actually about.
 *
 * The board uses the shared scale because a percentage bar lies about
 * magnitude in the direction that matters here. October 2025 is 78% pending
 * and holds 1,261 cases; February 2026 is 3% decided and holds 5,219. Drawn
 * as percentages the small month looks like the bigger problem. Drawn against
 * a shared maximum, the wall has its real shape.
 *
 * The bar carries no information the row does not also state in words, so it
 * is hidden from assistive technology rather than given a label that repeats
 * the numbers immediately beside it.
 */

export interface StageBarProps {
  stages: readonly StageGroup[];
  /** A number to divide by, or "composition" to fill the track. */
  scale: number | "composition";
  className?: string;
}

/**
 * Below this a segment is invisible, so it is floored instead.
 *
 * A month with three cases under appeal really is a rounding error against
 * 14,467, and the bar should say so. It should not silently drop the segment,
 * because "nothing there" and "too small to draw" are different claims.
 *
 * Four rather than two because each segment carries a 2px right border, and
 * `border-box` sizing takes that out of the declared width: at 2px the border
 * would be the entire segment and the colour would disappear.
 */
const MIN_SEGMENT_PX = 4;

/**
 * WHY EVERY SEGMENT HAS A RIGHT BORDER, AND WHY IT IS THE TRACK COLOUR.
 *
 * A segmented bar has to carry two boundaries and they need different things.
 *
 * WHERE THE BAR ENDS is fill against the empty `--muted` track, and that is
 * now carried by the fills themselves: the `-ink` variants measure 4.61:1
 * (warn), 6.93:1 (none) and 5.98:1 (bad) in light, against 2.07:1 and 2.46:1
 * for two of the three bare tokens, which failed the 3:1 floor outright.
 *
 * WHERE ONE SEGMENT MEETS THE NEXT is a separate problem, and switching to
 * the `-ink` fills made it worse rather than better: three dark colours side
 * by side measure 1.50:1, 1.30:1 and 1.16:1 against each other in light. So
 * the boundary is carried by a rule, exactly as the certainty bar on the
 * timeline calculator does it.
 *
 * The rule is `--muted`, NOT `--border`. `--border` is #666666, which sits
 * between the ink fills in luminance and measures 1.14:1 to 1.32:1 against
 * them in light: a separator nobody can see. The track colour is the one
 * value already proven to contrast with every fill in both themes, because
 * that is the same comparison the bar's own end depends on.
 *
 * The 2px comes out of the segment's painted width under `border-box`, so a
 * bar is up to 6px shorter than its true value across three segments. On a
 * 150px to 400px bar that is under 2%, every count is printed beside it, and
 * the alternative is a bar whose composition cannot be read at all.
 */
const SEGMENT_EDGE = "border-r-2 border-muted";

export function StageBar({ stages, scale, className }: StageBarProps) {
  const own = stages.reduce((n, s) => n + s.count, 0);
  const denominator = scale === "composition" ? own : scale;
  if (denominator <= 0 || own === 0) {
    return (
      <span
        className={`block h-5 w-full border-2 border-border bg-muted ${className ?? ""}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`flex h-5 w-full overflow-hidden border-2 border-border bg-muted ${className ?? ""}`}
      aria-hidden="true"
    >
      {STAGE_ORDER.map((stage) => {
        const group = stages.find((s) => s.stage === stage);
        if (!group || group.count === 0) return null;
        const pct = Math.min(100, (group.count / denominator) * 100);
        return (
          <span
            key={stage}
            className={`block h-full ${SEGMENT_EDGE} ${STAGE_META[stage].fill}`}
            style={{ width: `${pct}%`, minWidth: `${MIN_SEGMENT_PX}px` }}
          />
        );
      })}
    </span>
  );
}

/**
 * What the three colours mean, stated once per surface.
 *
 * A swatch is a square of colour and nothing else, so its meaning has to be
 * printed next to it. Each entry carries a count as well, which makes the
 * legend do a second job: on the board it is the whole-population census in
 * three lines.
 */
export function StageLegend({
  stages,
  className,
}: {
  stages: readonly StageGroup[];
  className?: string;
}) {
  const int = (n: number) => n.toLocaleString("en-US");
  return (
    <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${className ?? ""}`}>
      {STAGE_ORDER.map((stage) => {
        const group = stages.find((s) => s.stage === stage);
        const meta = STAGE_META[stage];
        return (
          // Keyed Fragment with a real space: mapped siblings arrive with
          // nothing between them, and every DOM extractor reads the labels as
          // one run of text.
          <Fragment key={stage}>
            {" "}
            <li className="border-t-2 border-border pt-3">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-3 w-3 shrink-0 border-2 border-border ${meta.fill}`}
                  aria-hidden="true"
                />{" "}
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
                  {meta.label}
                </span>
              </span>{" "}
              <span className="mt-1 block font-heading text-2xl font-black tabular-nums">
                {int(group?.count ?? 0)}
              </span>{" "}
              <span className="mt-1 block text-sm leading-snug text-foreground/70">
                {meta.gloss}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
