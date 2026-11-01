import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { CASE_ROW_LINK } from "@/components/entities/caseRows";
import { shortDate } from "@convex/lib/months";
import { CASE_STATUS_FILL, caseStatusTint, prettyStatus } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

/**
 * A short list of filings as an aligned table: case number, job, the wage when
 * the list has one, the day filed, and DOL's status as a tinted chip.
 *
 * From 640px every row shares one set of column widths, so the dates and the
 * chips line up down the list; on a phone a row is two lines, the case number
 * and its day, then the job and its status. Each case number links to its own
 * live status. A list rather than a <table>: the phone layout restacks the
 * cells, which a table can't do without a sideways scroll.
 */

export interface FilingRow {
  caseNumber: string;
  job?: string | null;
  /** The wage as printed, when the list carries wages (wage requests, LCAs). */
  wage?: ReactNode;
  /** ISO day: filed, or decided where the list says so. */
  date?: string | null;
  status?: string | null;
}

const COLS = "sm:grid-cols-[11.5rem_minmax(0,1fr)_6.5rem_12.5rem]";
const COLS_WAGE = "sm:grid-cols-[11.5rem_minmax(0,1fr)_8.5rem_6.5rem_12.5rem]";

export function FilingRows({
  rows,
  withWage = false,
  dateLabel = "Filed",
  className,
}: {
  rows: readonly FilingRow[];
  withWage?: boolean;
  /** The heading over the date column. */
  dateLabel?: string;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const cols = withWage ? COLS_WAGE : COLS;
  return (
    <div className={className}>
      <div aria-hidden="true" className={cn("hidden gap-x-4 border-b-2 border-border pb-1.5 text-sm text-muted-foreground sm:grid", cols)}>
        <span>Case number</span> <span>Job</span> {withWage ? <span className="text-right">Wage</span> : null}{" "}
        <span>{dateLabel}</span> <span className="text-right">Status</span>
      </div>{" "}
      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const tint = caseStatusTint(r.status);
          return (
            <Fragment key={r.caseNumber}>
              {" "}
              <li
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-1.5 sm:py-2",
                  cols,
                )}
              >
                {/* A phone gets two lines: the case number and its day, then the job and its status.
                    From 640px the order is the columns': case, job, wage, day, status. */}
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                  className={cn(CASE_ROW_LINK, "order-1 whitespace-nowrap")}
                >
                  {r.caseNumber}
                </Link>{" "}
                <span className="order-2 whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground sm:order-4 sm:text-left">
                  {shortDate(r.date) ?? ""}
                </span>{" "}
                <span className="order-3 min-w-0 truncate text-base text-soft sm:order-2" title={r.job ?? undefined}>
                  {r.job ?? ""}
                  {withWage && r.wage ? <span className="font-mono text-sm font-bold text-foreground sm:hidden">{" · "}{r.wage}</span> : null}
                </span>{" "}
                {withWage ? (
                  <span className="hidden whitespace-nowrap text-right font-mono text-sm font-bold tabular-nums sm:order-3 sm:block">
                    {r.wage ?? ""}
                  </span>
                ) : null}{" "}
                {r.status ? (
                  <span
                    className={cn(
                      "order-4 justify-self-end whitespace-nowrap px-2 py-0.5 text-sm font-semibold sm:order-5",
                      CASE_STATUS_FILL[tint],
                    )}
                  >
                    {prettyStatus(r.status)}
                  </span>
                ) : (
                  <span className="order-4 sm:order-5" />
                )}
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
