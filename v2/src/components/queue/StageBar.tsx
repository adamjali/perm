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
 * WHY EVERY SEGMENT HAS A RIGHT BORDER, MEASURED RATHER THAN ASSUMED.
 *
 * Against the light track (`--muted` #F5F5F5) the fills measure 1.98:1 for
 * amber, 2.35:1 for slate and 3.37:1 for rust. Two of the three are under the
 * 3:1 floor for a graphical object, so where a segment ends would have been
 * genuinely hard to see in light mode, and where two of them meet harder
 * still. Dark mode is fine on all three, which is exactly how this ships
 * unnoticed.
 *
 * The fix is the one already used by the certainty bar on the timeline
 * calculator: the boundary is carried by a 2px `--border` rule rather than by
 * the fills, and that rule measures 3.45:1 on the page and 3.03:1 on a card.
 * Recolouring the fills was the alternative and it is worse, because these
 * three tokens carry the same meanings on every other chart on the site.
 */
const SEGMENT_EDGE = "border-r-2 border-border";

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
    <ul className={`grid gap-3 sm:grid-cols-3 ${className ?? ""}`}>
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
