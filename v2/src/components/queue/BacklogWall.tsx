import { Fragment } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react/ssr";

import { formatMonth, formatMonthShort } from "@/lib/dolFormat";
import type { VolumeAnomaly } from "@/lib/queueAhead";
import { cn } from "@/lib/utils";
import type { BacklogMonth } from "@/lib/turso/backlog";

import { StageBar } from "./StageBar";
import { groupByStage } from "./stages";

/**
 * The wall: every filing month still carrying undecided cases.
 *
 * WHAT THE BAR MEASURES CHANGED, AND THAT IS THE POINT. This list used to
 * draw the share of a month DOL had decided, which put October 2025 (1,261
 * cases, 78% pending) visually ahead of February 2026 (5,219 cases, 3%
 * decided). The bars are now drawn against one shared maximum, so length is
 * case count and the eye reads the backlog's real shape: a thin tail, then
 * the cliff at November 2025. The percentage is still on the row, demoted
 * from the picture to a figure, because it answers a second question.
 *
 * DOL'S OWN POSITION IS DRAWN ON THE SAME LIST. A rule sits at the filing
 * month DOL publishes as its analyst-review priority date, carrying DOL's
 * wording and its as-of stamp. The rule and its label share one coordinate,
 * because a label placed anywhere other than the line it names ends up
 * describing a different row.
 *
 * THE PASSED MONTHS COLLAPSE. Twenty-odd months behind the work front hold
 * well under one percent of the backlog between them. Leaving them expanded
 * buries the nine months that hold the rest. They are inside a `<details>`,
 * which is keyboard operable, needs no JavaScript, and keeps every month link
 * in the document for anything that walks it.
 *
 * A FULLY DECIDED MONTH STAYS ON THE LIST. Nine of them hold nothing at all,
 * and dropping them would tidy the disclosure at the cost of leaving
 * `/perm-queue/2023-08` with no inbound link from anywhere: a page that
 * exists, returns 200, sits in no index and is reachable from nothing. The
 * summary states the month count and the case count as two separate figures
 * so it never implies every month in there is carrying something.
 */

const int = (n: number) => n.toLocaleString("en-US");

export interface BacklogWallProps {
  /** Oldest first. */
  months: readonly BacklogMonth[];
  /** The month DOL publishes as its analyst-review position, or null. */
  frontierMonth: string | null;
  /** DOL's as-of date for that position, already formatted for reading. */
  frontierAsOf: string | null;
  /** The oldest month that is not substantially decided, from `findFront`. */
  frontMonth: string | null;
  /**
   * Months whose filing volume collapsed, from `findVolumeAnomalies`.
   *
   * DETECTED, NEVER HARDCODED. An earlier version of this took a literal map
   * naming October 2025, which is a claim about the future as well as the
   * past: the next collapse would render as an ordinary short bar and read as
   * a bug in the scan. `@/lib/queueAhead` already owns this detection and the
   * chart on the timeline calculator already consumes it.
   */
  anomalies?: readonly VolumeAnomaly[];
  /**
   * Anchor ids for the anomalies that have a sourced explanation on the page.
   *
   * Deliberately separate from detection. A month can be a measured cliff
   * with nothing published about why, and in that case it is still marked, so
   * the reader knows the number is real, but the marker leads nowhere rather
   * than to somebody else's explanation.
   */
  noteAnchors?: Readonly<Record<string, string>>;
}

export function BacklogWall({
  months,
  frontierMonth,
  frontierAsOf,
  frontMonth,
  anomalies = [],
  noteAnchors,
}: BacklogWallProps) {
  if (months.length === 0) return null;

  const anomalyByMonth = new Map(anomalies.map((a) => [a.filingMonth, a]));

  // One shared maximum for every bar on the board. Taken over the months that
  // are actually drawn at full size, so the collapsed tail cannot flatten the
  // whole scale by contributing a maximum nobody sees.
  const wall = frontMonth ? months.filter((m) => m.month >= frontMonth) : [...months];
  const passed = frontMonth ? months.filter((m) => m.month < frontMonth) : [];
  const scale = Math.max(1, ...wall.map((m) => m.pending));
  const passedPending = passed.reduce((n, m) => n + m.pending, 0);

  return (
    <div>
      <Header />

      {passed.length > 0 ? (
        <details className="mt-4 border-2 border-border bg-background">
          <summary className="cursor-pointer px-4 py-3 text-base font-bold marker:text-primary hover:text-primary">
            {passed.length} earlier {passed.length === 1 ? "month" : "months"} DOL
            has worked past. {int(passedPending)}{" "}
            {passedPending === 1 ? "case" : "cases"} across them{" "}
            {passedPending === 1 ? "is" : "are"} still open
          </summary>
          <ol className="space-y-1 border-t-2 border-border px-4 py-3">
            {passed.map((m) => (
              <Fragment key={m.month}>
                {" "}
                <MonthRow
                  month={m}
                  scale={scale}
                  isFront={false}
                  anomaly={anomalyByMonth.get(m.month)}
                  noteId={noteAnchors?.[m.month]}
                />
              </Fragment>
            ))}
          </ol>
        </details>
      ) : null}

      <ol className="mt-4 space-y-1">
        {wall.map((m, i) => {
          const previous = i > 0 ? wall[i - 1] : undefined;
          const crossesFrontier =
            frontierMonth !== null &&
            m.month >= frontierMonth &&
            (previous === undefined || previous.month < frontierMonth);
          return (
            <Fragment key={m.month}>
              {" "}
              {crossesFrontier ? (
                <FrontierRule month={frontierMonth} asOf={frontierAsOf} />
              ) : null}{" "}
              <MonthRow
                month={m}
                scale={scale}
                isFront={m.month === frontMonth}
                anomaly={anomalyByMonth.get(m.month)}
                noteId={noteAnchors?.[m.month]}
              />
            </Fragment>
          );
        })}
        {/* DOL's position can sit past every month we hold, which would be a
            genuine and newsworthy state rather than a bug. Drawn at the end so
            the rule never silently disappears. */}
        {frontierMonth !== null &&
        wall.length > 0 &&
        wall[wall.length - 1]!.month < frontierMonth ? (
          <FrontierRule month={frontierMonth} asOf={frontierAsOf} />
        ) : null}
      </ol>
    </div>
  );
}

function Header() {
  return (
    <div
      className="grid grid-cols-[5rem_1fr_3.5rem_3rem] items-end gap-2 border-b-2 border-border pb-2 [&>*]:min-w-0 sm:grid-cols-[7rem_1fr_5rem_4rem] sm:gap-3"
      aria-hidden="true"
    >
      <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
        Filed
      </span>{" "}
      {/* "Still pending" everywhere, not "Still waiting". One vocabulary for
          one state: the queue tape legend, the month page heading and this
          column header all describe the same cases, and three wordings for one
          idea is drift a reader has to translate. */}
      <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
        Still pending
      </span>{" "}
      <span className="text-right font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
        Cases
      </span>{" "}
      <span className="text-right font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
        Decided
      </span>
    </div>
  );
}

function MonthRow({
  month,
  scale,
  isFront,
  anomaly,
  noteId,
}: {
  month: BacklogMonth;
  scale: number;
  isFront: boolean;
  anomaly?: VolumeAnomaly;
  noteId?: string;
}) {
  const { stages } = groupByStage(month.statuses);
  // The long form is the accessible name and the short form is the visible
  // one. Rendering BOTH behind responsive utilities was the first shape of
  // this and it was wrong twice over: every extractor reads a hidden element,
  // so the rendered page served "Jun 2023June 2023" on 39 rows, and even
  // spaced it would have been the same month printed twice.
  const label = formatMonth(month.month) ?? month.month;
  const short = formatMonthShort(month.month) ?? month.month;
  const pct = month.decidedPct ?? 0;

  return (
    <li
      // 44px minimum row height. The row's only control is the month link, and
      // at `text-sm` its box is 20px tall: with `space-y-1` between rows that
      // put 39 targets on a 24px pitch, which is the floor of WCAG 2.5.8 and
      // well under this project's own. The bar stays 20px; the ROW grew.
      className="grid min-h-11 grid-cols-[5rem_1fr_3.5rem_3rem] items-center gap-2 [&>*]:min-w-0 sm:grid-cols-[7rem_1fr_5rem_4rem] sm:gap-3"
      aria-label={`${label}: ${int(month.pending)} of ${int(month.total)} still waiting, ${pct.toFixed(0)} percent decided`}
    >
      <span className="flex min-h-11 items-center gap-1 truncate">
        {anomaly ? (
          <AnomalyMark label={label} anomaly={anomaly} noteId={noteId} />
        ) : null}{" "}
        <Link
          href={`/perm-queue/${month.month}`}
          className={cn(
            "flex min-h-11 items-center truncate text-sm underline underline-offset-2 hover:text-primary",
            isFront ? "font-black" : "text-foreground/80",
          )}
        >
          {short}
        </Link>
      </span>{" "}
      <StageBar stages={stages} scale={scale} />{" "}
      <span
        className={cn(
          "text-right text-sm tabular-nums",
          isFront ? "font-black" : "text-foreground/80",
        )}
      >
        {int(month.pending)}
      </span>{" "}
      <span className="text-right text-sm tabular-nums text-foreground/70">
        {pct.toFixed(0)}%
      </span>
    </li>
  );
}

/**
 * DOL's published position, drawn across the list it describes.
 *
 * The label and the rule are one flex row, so they resolve to the same
 * vertical coordinate by construction rather than by two numbers that have to
 * be kept in step.
 */
function FrontierRule({ month, asOf }: { month: string; asOf: string | null }) {
  const label = formatMonth(month) ?? month;
  return (
    <li className="flex items-center gap-3 pb-1 pt-4">
      <span className="shrink-0 border-2 border-primary bg-primary px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground">
        DOL is working {label}
      </span>{" "}
      <span className="h-0 flex-1 border-t-4 border-primary" aria-hidden="true" />{" "}
      {asOf ? (
        <span className="shrink-0 font-mono text-xs text-foreground/70">
          as of {asOf}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Marks a month whose filing volume collapsed against both its neighbours.
 *
 * A short bar between two tall ones reads as a bug in the scan, so it is
 * always marked. Whether the mark is a LINK depends on whether the page
 * actually has something sourced to say: October 2025 does, and anything the
 * detector finds later gets the mark and an honest accessible description of
 * the measurement, with nothing claimed about why.
 */
function AnomalyMark({
  label,
  anomaly,
  noteId,
}: {
  label: string;
  anomaly: VolumeAnomaly;
  noteId?: string;
}) {
  const measured = `${label} holds ${int(anomaly.total)} filings against a neighbouring average of ${int(Math.round(anomaly.neighbourMean))}`;
  const icon = <Warning className="h-4 w-4" weight="fill" aria-hidden="true" />;
  if (noteId) {
    return (
      <Link
        href={`#${noteId}`}
        className="flex min-h-11 w-5 shrink-0 items-center justify-center text-data-warn-ink hover:text-primary"
        aria-label={`${measured}. Read why.`}
      >
        {icon}
      </Link>
    );
  }
  return (
    <span
      className="flex min-h-11 w-5 shrink-0 items-center justify-center text-data-warn-ink"
      title={measured}
    >
      <span className="sr-only">{measured}.</span>
      {icon}
    </span>
  );
}
