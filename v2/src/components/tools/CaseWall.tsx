import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { Bold } from "@/components/i18n/Bold";
import type { Wall } from "@/lib/casePosition";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n/lang";
import { intLabel, monthLabel, monthShortLabel, percentLabel } from "@/lib/i18n/format";

import { CASE_WALL, type CaseWallText } from "./CaseWall.messages";

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
  /** The wall's words, month labels and number grouping; English by default. */
  lang?: Lang;
}

export function CaseWall({
  wall,
  publishedFront,
  attribution = "case",
  className,
  lang = "en",
}: CaseWallProps) {
  const t: CaseWallText = CASE_WALL[lang];
  const n = (x: number) => intLabel(x, lang);
  const month = (m: string) => monthLabel(m, lang) ?? m;
  const peak = Math.max(...wall.segments.map((s) => s.pending), 1);
  const ownCase = attribution === "case";
  const subjectMark = ownCase ? t.mark.case : t.mark.month;
  const drawn = t.drawn(n(wall.drawnAhead), ownCase);

  return (
    <div className={className}>
      <ChartTips label={t.chartLabel} scroll="-mx-1 px-1">
        <ul className="flex min-w-[560px] items-end gap-1.5">
          {wall.segments.map((s) => {
            const label = monthShortLabel(s.month, lang) ?? s.month;
            return (
              <Fragment key={s.month}>{" "}
              <li
                data-tip={[
                  month(s.month),
                  t.tipUndecided(n(s.pending)),
                  t.tipShare(percentLabel(Math.round(s.share), lang, 0)),
                  s.isSubject ? (ownCase ? t.tipSubject.case : t.tipSubject.month) : null,
                  s.isFront ? t.tipFront : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    s.isSubject ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {n(s.pending)}
                </span>{" "}
                {/* The column. A floor of 3% keeps a thin month visible as a
                    real quantity rather than dropping it out of the drawing,
                    which would read as "nothing was filed then". */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 w-full border",
                    // The fill is what says "this month is yours" against
                    // its neighbours, so it is a graphical object required to
                    // understand the content and owes 3:1. --primary is
                    // 2.05:1 on paper; --data-good-ink is 4.70:1 and is the
                    // same hex as --primary in dark mode.
                    // Neighbours soft yellow, still waiting (round 3, Oct 15
                    // 2026: no grey in charts); yours stays the dark green.
                    s.isSubject
                      ? "border-foreground bg-data-good-ink"
                      : "border-foreground/40 bg-chart-yellow",
                  )}
                  style={{
                    height: `${Math.max(3, (s.pending / peak) * 100) * 1.6}px`,
                  }}
                />
                <span
                  className={cn(
                    "mt-1.5 w-full border-t-2 pt-1.5 text-center text-sm border-border",
                    s.isSubject
                      ? "border-foreground font-bold text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {label}
                </span>{" "}
                <span className="mt-1 min-h-[1.25rem] text-center text-sm font-bold text-primary">
                  {s.isSubject ? subjectMark : s.isFront ? t.dolHere : null}
                </span>
              </li>
              </Fragment>
            );
          })}
        </ul>
      </ChartTips>

      <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-muted-foreground">
        <Bold parts={drawn} />
        {wall.ahead > wall.drawnAhead ? t.earlier(n(wall.ahead - wall.drawnAhead), ownCase, n(wall.ahead)) : null}
        {publishedFront ? <Bold parts={t.published(month(publishedFront), publishedFront === wall.frontMonth)} /> : null}
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
  lang = "en",
}: {
  wall: Wall;
  className?: string;
  lang?: Lang;
}) {
  const t: CaseWallText = CASE_WALL[lang];
  const behind = Math.abs(wall.monthsBehindFront);
  const month = (m: string) => monthLabel(m, lang) ?? m;
  return (
    <div className={className}>
      <p className="text-base leading-relaxed text-soft">
        <Bold parts={t.pastFront(month(wall.frontMonth), behind)} />
        <Bold
          parts={t.pastStillOpen(intLabel(wall.sameMonth, lang), month(wall.subject.month), intLabel(wall.subject.total, lang))}
        />
      </p>{" "}
      <p className="mt-3 text-base leading-relaxed text-soft">{t.pastWhy}</p>
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
  lang = "en",
}: {
  months: readonly { month: string; total: number; pending: number; decidedPct: number | null }[];
  subjectMonth: string;
  /** Same rule as CaseWall: only a FOUND case may be called "Yours". */
  attribution?: "case" | "month";
  className?: string;
  lang?: Lang;
}) {
  const t: CaseWallText = CASE_WALL[lang];
  if (months.length === 0) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {months.map((x) => {
        const isSubject = x.month === subjectMonth;
        return (
          <Fragment key={x.month}>{" "}
          <li
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 pb-2 border-border",
              isSubject ? "border-foreground" : "border-border",
            )}
          >
            <span
              className={cn(
                "text-sm",
                isSubject ? "font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {monthLabel(x.month, lang)}
              {isSubject ? (
                <span className="ml-2 border border-primary px-1.5 py-0.5 text-sm font-bold tracking-[0.1em] text-primary">
                  {attribution === "case" ? t.mark.case : t.mark.month}
                </span>
              ) : null}
            </span>{" "}
            <span className="text-sm tabular-nums text-muted-foreground">
              <Bold parts={t.stillOpen(intLabel(x.pending, lang), intLabel(x.total, lang))} />
              {x.decidedPct !== null ? (
                <span className="ml-2 text-muted-foreground">
                  {t.decidedShare(percentLabel(x.decidedPct, lang, 0))}
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
