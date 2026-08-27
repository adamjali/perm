import { Fragment } from "react";

import { formatMonth, formatMonthShort } from "@/lib/dolFormat";
import type { Wall } from "@/lib/casePosition";
import { cn } from "@/lib/utils";

/**
 * The wall in front of one case, drawn as mass rather than as progress.
 *
 * WHY THIS IS NOT THE CHART WE ALREADY HAVE. `QueueMonthChart` plots how far
 * through each filing month DOL has got: a percentage, which answers "is my
 * month being worked". This plots the COUNT still undecided in each month
 * between DOL's front and the reader's own, which answers a different
 * question: how much is actually in the way, and is it evenly spread. It is
 * not: November and December 2025 hold roughly 14,000 apiece against 1,261
 * for October, so the wait in front of a 2026 filer is dominated by two
 * months. A percentage chart cannot show that and a single "63,603 ahead"
 * figure hides it completely.
 *
 * The height is the only variable encoding magnitude. Colour encodes position
 * relative to the reader (ahead, or theirs), because doubling two variables
 * onto one channel is how a chart ends up saying one thing twice.
 *
 * Every figure is also real text inside the drawing rather than an SVG label
 * or a title attribute, so the chart reads correctly to a screen reader
 * without a duplicated table underneath it.
 */

export interface CaseWallProps {
  wall: Wall;
  /**
   * WHOSE month the marked column is.
   *
   * "case" when the reader's own case was found and this really is their
   * position. "month" when the case was NOT found and the column is only the
   * month decoded from the number: labelling that one "Yours" contradicts the
   * heading above it, which says in as many words that none of this was
   * measured on their case. The possessive phrasing in the caption moves
   * with it, because "the total filed before yours" is the same claim in
   * prose.
   */
  attribution?: "case" | "month";
  /**
   * DOL's own published analyst-review priority date, when we hold one.
   * Drawn beside our measured front: the two agreeing is the strongest
   * evidence this page has that the mirror is describing the real queue.
   */
  publishedFront?: string | null;
  className?: string;
}

const int = (n: number) => n.toLocaleString("en-US");

export function CaseWall({
  wall,
  publishedFront,
  attribution = "case",
  className,
}: CaseWallProps) {
  const peak = Math.max(...wall.segments.map((s) => s.pending), 1);
  const ownCase = attribution === "case";
  const subjectMark = ownCase ? "Yours" : "This month";

  return (
    <div className={className}>
      <div className="-mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-[560px] items-end gap-1.5">
          {wall.segments.map((s) => {
            const label = formatMonthShort(s.month) ?? s.month;
            return (
              <Fragment key={s.month}>{" "}
              <li className="flex min-w-0 flex-1 flex-col items-center">
                <span
                  className={cn(
                    "font-mono text-[11px] font-bold tabular-nums",
                    s.isSubject ? "text-foreground" : "text-foreground/60",
                  )}
                >
                  {int(s.pending)}
                </span>{" "}
                {/* The column. A floor of 3% keeps a thin month visible as a
                    real quantity rather than dropping it out of the drawing,
                    which would read as "nothing was filed then". */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 w-full border-2",
                    s.isSubject
                      ? "border-foreground bg-primary"
                      : "border-border bg-foreground/20",
                  )}
                  style={{
                    height: `${Math.max(3, (s.pending / peak) * 100) * 1.6}px`,
                  }}
                />
                <span
                  className={cn(
                    "mt-1.5 w-full border-t-2 pt-1.5 text-center font-mono text-[11px] uppercase tracking-wider",
                    s.isSubject
                      ? "border-foreground font-bold text-foreground"
                      : "border-border text-foreground/60",
                  )}
                >
                  {label}
                </span>{" "}
                <span className="mt-1 min-h-[1.25rem] text-center font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                  {s.isSubject ? subjectMark : s.isFront ? "DOL here" : null}
                </span>
              </li>
              </Fragment>
            );
          })}
        </ul>
      </div>

      <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-foreground/70">
        <b className="font-bold text-foreground">
          {int(wall.drawnAhead)} undecided cases
        </b>{" "}
        sit in the months drawn here, between the month DOL is working and{" "}
        {ownCase ? "yours" : "this one"}.
        {wall.ahead > wall.drawnAhead ? (
          <>
            {" "}
            Another {int(wall.ahead - wall.drawnAhead)} were filed earlier still
            and remain open: cases held up in an audit, an appeal or a request
            for information, in months DOL has otherwise finished. Counting
            them takes the total filed before{" "}
            {ownCase ? "yours" : "that month"} to {int(wall.ahead)}.
          </>
        ) : null}
        {publishedFront ? (
          publishedFront === wall.frontMonth ? (
            <>
              {" "}
              DOL publishes its own analyst-review position as{" "}
              <b className="font-bold text-foreground">
                {formatMonth(publishedFront)}
              </b>
              , which is the same month this count puts the front in.
            </>
          ) : (
            <>
              {" "}
              DOL publishes its own analyst-review position as{" "}
              <b className="font-bold text-foreground">
                {formatMonth(publishedFront)}
              </b>
              , a month apart from where these counts put the front. Both are
              shown rather than one being picked.
            </>
          )
        ) : null}
      </p>
    </div>
  );
}

/**
 * What the wall says when there is no wall: DOL has already moved past this
 * filing month and the case is still open.
 *
 * A separate component rather than a branch inside the drawing, because the
 * answer is prose, not geometry. Drawing a one-column chart here would imply
 * a queue that is not what is holding the case up.
 */
export function PastFrontNote({
  wall,
  className,
}: {
  wall: Wall;
  className?: string;
}) {
  const behind = Math.abs(wall.monthsBehindFront);
  return (
    <div className={className}>
      <p className="text-base leading-relaxed text-foreground/80">
        DOL is working{" "}
        <b className="font-bold text-foreground">
          {formatMonth(wall.frontMonth)}
        </b>
        , which is {behind} {behind === 1 ? "month" : "months"} newer than this
        case&apos;s filing month. So filing order is no longer what this case
        is waiting on.{" "}
        <b className="font-bold text-foreground">
          {int(wall.sameMonth)} cases
        </b>{" "}
        filed in{" "}
        {formatMonth(wall.subject.month)} are still open, out of{" "}
        {int(wall.subject.total)} filed that month.
      </p>{" "}
      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        A case that stays open past its month is usually in one of the queues
        that takes it out of filing order: a request for information, an
        audit, supervised recruitment, or an appeal. The split below shows
        which of those the rest of the month is sitting in.
      </p>
    </div>
  );
}

/**
 * The reader's own month against its immediate neighbours.
 *
 * The point is comparative and narrow: a month is not slow or fast on its
 * own, and two months either side is enough to see whether this one is
 * ordinary. Anything wider is the queue overview, which is a link away.
 */
export function CohortNeighbours({
  months,
  subjectMonth,
  attribution = "case",
  className,
}: {
  months: readonly { month: string; total: number; pending: number; decidedPct: number | null }[];
  subjectMonth: string;
  /** Same rule as CaseWall: only a FOUND case may be called "Yours". */
  attribution?: "case" | "month";
  className?: string;
}) {
  if (months.length === 0) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {months.map((x) => {
        const isSubject = x.month === subjectMonth;
        return (
          <Fragment key={x.month}>{" "}
          <li
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 pb-2",
              isSubject ? "border-foreground" : "border-border",
            )}
          >
            <span
              className={cn(
                "font-mono text-sm uppercase tracking-wider",
                isSubject ? "font-bold text-foreground" : "text-foreground/60",
              )}
            >
              {formatMonth(x.month)}
              {isSubject ? (
                <span className="ml-2 border border-primary px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-primary">
                  {attribution === "case" ? "Yours" : "This month"}
                </span>
              ) : null}
            </span>{" "}
            <span className="font-mono text-sm tabular-nums text-foreground/70">
              <b className="font-bold text-foreground">{int(x.pending)}</b> of{" "}
              {int(x.total)} still open
              {x.decidedPct !== null ? (
                <span className="ml-2 text-foreground/60">
                  ({x.decidedPct.toFixed(0)}% decided)
                </span>
              ) : null}
            </span>
          </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
