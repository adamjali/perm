import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One column per filing month: how many filings DOL has decided, and on top
 * of them, how many still wait. Where DOL publishes the month it is working
 * on, that column carries a flag, so the line reads at a glance: everything
 * left of the flag is done, everything right of it is waiting.
 *
 * Months the record holds only a sliver of (the backfill still walking
 * earlier days) are left off the left end rather than drawn as a dip that
 * never happened: a column starts the chart once it holds a quarter of the
 * busiest month.
 */

export interface MonthCount {
  /** "2026-06". */
  month: string;
  total: number;
  pending: number;
}

const MONTH_SHORT = (m: string) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const MONTH_LONG = (m: string) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** The months worth drawing: the newest `limit`, from the first that holds a quarter of the busiest. */
export function chartMonths(months: MonthCount[], limit = 12): MonthCount[] {
  const sorted = [...months].sort((a, b) => (a.month < b.month ? -1 : 1)).slice(-limit);
  const max = Math.max(0, ...sorted.map((m) => m.total));
  const first = sorted.findIndex((m) => m.total >= max / 4);
  return first < 0 ? [] : sorted.slice(first);
}

export function FilingMonthBars({
  months,
  frontier,
  nouns,
  label,
  className,
}: {
  months: MonthCount[];
  /** The filing month DOL says it is working on, "2026-06", where it says one. */
  frontier?: string | null;
  /** "wage requests", "LCAs". */
  nouns: string;
  /** What the chart shows, for the keyboard and the screen-reader table. */
  label: string;
  className?: string;
}) {
  const shown = chartMonths(months);
  if (shown.length < 3) return null;
  const max = Math.max(1, ...shown.map((m) => m.total));
  const flagAt = frontier ? shown.findIndex((m) => m.month === frontier) : -1;

  return (
    <figure className={cn("m-0", className)}>
      <div aria-hidden="true" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 border-2 border-border bg-foreground" /> Decided
        </span>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 border-2 border-border bg-primary" /> Still waiting at DOL
        </span>
      </div>{" "}
      <ChartTips label={label} className="mt-4">
        <div className="relative">
          {/* Room above the columns for the flag, so it never sits on a bar. */}
          <div className="flex h-56 items-end gap-1 pt-9 sm:gap-2">
            {shown.map((m, i) => {
              const h = (m.total / max) * 100;
              const waitShare = m.total > 0 ? (m.pending / m.total) * 100 : 0;
              const flagged = i === flagAt;
              const anchor = i < 2 ? "left-0" : i > shown.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={m.month} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
                  {flagged ? (
                    <span
                      className={cn(
                        "absolute -top-8 z-10 whitespace-nowrap border-2 border-border bg-primary px-1.5 py-0.5 text-sm font-bold text-black",
                        anchor,
                      )}
                    >
                      DOL is here
                    </span>
                  ) : null}
                  <div
                    data-tip={`Filed in ${MONTH_LONG(m.month)}\n${formatInt(m.total)} ${nouns}\n${formatInt(m.total - m.pending)} decided\n${formatInt(m.pending)} still waiting`}
                    className={cn("flex flex-col border-2 border-border", flagged && "outline outline-2 outline-offset-2 outline-primary")}
                    style={{ height: `${Math.max(2, h)}%` }}
                  >
                    {m.pending > 0 ? <div className="bg-primary" style={{ height: `${waitShare}%` }} /> : null}
                    <div className="flex-1 bg-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Hidden from a screen reader, which reads the table below instead. */}
          <div aria-hidden="true" className="mt-1.5 flex gap-1 sm:gap-2">
            {shown.map((m, i) => (
              <Fragment key={m.month}>
                <span className="min-w-0 flex-1 text-center text-sm tabular-nums text-foreground/70">
                  {/* A phone's column is about 26px: the month's first letter there, its three letters from sm up. */}
                  <span className="sm:hidden">{MONTH_SHORT(m.month).charAt(0)}</span>{" "}
                  <span className="hidden sm:inline">{MONTH_SHORT(m.month)}</span>{" "}
                  {i === 0 || m.month.endsWith("-01") ? (
                    <span className="block text-foreground/70">&rsquo;{m.month.slice(2, 4)}</span>
                  ) : null}
                </span>{" "}
              </Fragment>
            ))}
          </div>
        </div>
      </ChartTips>{" "}
      {/* The numbers for a screen reader. `sr-only` on the wrapper, never on
          the table: a table can't shrink, and pushed a phone page sideways. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Filed in{" "}</th>
              <th scope="col">Decided{" "}</th>
              <th scope="col">Still waiting{" "}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <Fragment key={m.month}>
                <tr>
                  <th scope="row">
                    {MONTH_LONG(m.month)}
                    {m.month === frontier ? " (DOL is working this month)" : ""}{" "}
                  </th>
                  <td>{formatInt(m.total - m.pending)}{" "}</td>
                  <td>{formatInt(m.pending)}{" "}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
