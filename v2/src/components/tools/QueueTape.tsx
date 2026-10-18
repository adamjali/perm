import { Fragment, type CSSProperties } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { cn } from "@/lib/utils";
import { MONTH_NAMES, monthTick, shiftMonth } from "@convex/lib/months";

/**
 * The queue, drawn as a measuring tape.
 *
 * PERM's mental model is one line: every case waits in filing-month order and
 * DOL clears it oldest-first. This renders that line as an instrument strip —
 * cleared months in solid primary, waiting months in paper, the frontier
 * marked with a flag, and optionally the reader's own month.
 *
 * Presentational and server-renderable: months in, markup out. The timeline
 * calculator passes `selectedMonth` from its own state; the overview passes
 * none and shows the national picture.
 */

export interface QueueTapeProps {
  /** DOL's analyst-review frontier, "YYYY-MM". */
  frontierMonth: string;
  /** The reader's filing month, "YYYY-MM". Optional. */
  selectedMonth?: string;
  /** Months to draw after the frontier. The wait, visually. */
  monthsAhead?: number;
  /** Months to draw before the frontier. Cleared territory. */
  monthsBehind?: number;
  /**
   * Draw the processed months as fills that TapeReveal can play once, left to
   * right, when the tape first scrolls into view. Off, the tape is drawn
   * filled; on, it is still drawn filled until TapeReveal arms it.
   */
  reveal?: boolean;
  /**
   * Said across the months between DOL's front and the reader's month, so the
   * empty stretch names what fills it ("80,416 cases ahead").
   */
  aheadLabel?: string;
  className?: string;
}

function longLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y ?? 0}`;
}

/** What a month on the tape means, for its hover detail. */
function tipFor(month: string, offset: number, isYou: boolean): string {
  const state =
    offset < 0
      ? "DOL has worked through these filings"
      : offset === 0
        ? "DOL is deciding these filings now"
        : `${offset} ${offset === 1 ? "month" : "months"} behind where DOL is`;
  return `${longLabel(month)}\n${state}${isYou ? "\nYour filing month" : ""}`;
}

export function QueueTape({
  frontierMonth,
  selectedMonth,
  monthsAhead = 10,
  monthsBehind = 8,
  reveal = false,
  aheadLabel,
  className,
}: QueueTapeProps) {
  const months: string[] = [];
  for (let i = -monthsBehind; i <= monthsAhead; i += 1) {
    months.push(shiftMonth(frontierMonth, i));
  }

  // BOTH FLAGS USED THE SAME `-top-7 left-1/2 -translate-x-1/2`, so when the
  // two months are near each other the badges overlap: "DOL is here" is ~90px
  // wide over a column that can be ~30px, and "You" landed on top of it.
  // Reported from a screenshot with the two one month apart.
  //
  // A flag is roughly four columns wide, so anything closer than that collides.
  // When it does, "You" goes up a row rather than being nudged sideways, which
  // would break the tie between a flag and the column it points at. The wrapper
  // reserves the second row's height unconditionally so the tape does not shift
  // when the selection moves.
  const frontierAt = months.indexOf(frontierMonth);
  const youAt = selectedMonth ? months.indexOf(selectedMonth) : -1;
  const flagsCollide =
    frontierAt >= 0 && youAt >= 0 && Math.abs(youAt - frontierAt) < 4;

  return (
    <figure className={cn("m-0", className)}>
      <ChartTips label="DOL's PERM queue by filing month" scroll={cn("-mx-1 px-1", flagsCollide ? "pt-14" : "pt-7")}>
        <div
          className="relative grid min-w-[560px] border-2 border-[var(--object-border)] bg-card shadow-hard-sm"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {aheadLabel && frontierAt >= 0 && youAt - frontierAt > 2 ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-[5] flex items-start justify-center pt-3"
              style={{
                left: `${((frontierAt + 1) / months.length) * 100}%`,
                width: `${((youAt - frontierAt - 1) / months.length) * 100}%`,
              }}
            >
              <span className="bg-card px-2 font-heading text-base font-bold whitespace-nowrap">{aheadLabel}</span>
            </span>
          ) : null}
          {months.map((m) => {
            const cleared = m < frontierMonth;
            const isFrontier = m === frontierMonth;
            const isYou = m === selectedMonth;
            return (
              <Fragment key={m}>{" "}
              <div
                data-href={`/perm-queue/${m}`}
                data-tip={tipFor(m, months.indexOf(m) - frontierAt, isYou)}
                className={cn(
                  "relative flex h-16 items-end justify-center border-r border-foreground/10 pb-1 last:border-r-0",
                  // Still waiting reads soft yellow, not blank (round 3, Oct 15 2026).
                  !cleared && !isFrontier && "bg-soft-wait",
                  !reveal && cleared && "bg-primary",
                  !reveal && isFrontier && "bg-primary/70",
                )}
              >
                {reveal && (cleared || isFrontier) ? (
                  <span
                    aria-hidden="true"
                    className={cn("qt-fill absolute inset-0", isFrontier ? "bg-primary/70" : "bg-primary")}
                    style={{ "--i": months.indexOf(m) } as CSSProperties}
                  />
                ) : null}
                {/* Tick */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 top-0 h-2 w-px",
                    cleared || isFrontier ? "bg-data-good-ink" : "bg-data-warn",
                  )}
                />
                <span
                  className={cn(
                    "relative font-mono text-sm font-bold leading-none",
                    cleared || isFrontier ? "text-black/80" : "text-muted-foreground",
                    // Room is tight: label every other month, ends always.
                    months.indexOf(m) % 2 !== 0 &&
                      !isFrontier && !isYou && "sr-only",
                  )}
                >
                  {(monthTick(m) ?? m)}
                </span>
                {/* Real space: the flag span is adjacent to the label span
                    and would glue for every DOM extractor. */}
                {" "}
                {isFrontier ? (
                  <span
                    className={cn(
                      "dark absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 text-sm font-bold border-2 border-black bg-[#141414] text-foreground",
                      reveal && "qt-flag",
                    )}
                    style={{ "--i": frontierAt } as CSSProperties}
                  >
                    DOL is here
                  </span>
                ) : null}
                {isYou && !isFrontier ? (
                  <span
                    className={cn(
                      "absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-[var(--object-border)] bg-primary px-1.5 py-px text-sm font-bold text-black",
                      flagsCollide ? "-top-14" : "-top-7",
                    )}
                  >
                    You
                  </span>
                ) : null}
                {isYou && !isFrontier && flagsCollide ? (
                  // The raised flag is a row away from its column, so a hairline
                  // keeps them tied together.
                  <span
                    aria-hidden="true"
                    className="absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-input"
                  />
                ) : null}
              </div>
              </Fragment>
            );
          })}
        </div>
      </ChartTips>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 border border-foreground/40 bg-primary" />
          Processed
        </span>{" "}
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 border border-foreground/40 bg-soft-wait" />
          Still pending
        </span>
      </figcaption>
    </figure>
  );
}
