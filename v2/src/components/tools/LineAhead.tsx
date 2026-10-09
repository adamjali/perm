import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt } from "@/lib/format";
import type { LineAheadRow } from "@/lib/queueAhead";

/**
 * The line ahead of a case in DOL's ordinary queue, month by month.
 *
 * Oct 8 2026: the case page said "and 6,891 cases in DOL's normal queue" in a
 * sentence, which a reader skims past. Drawn as a bar per filing month it
 * shows what the number is made of: almost all of it is the reader's own and
 * the month before, and a long thin tail of older cases. The rows come from
 * `lineAheadByMonth`, which splits the same count the date is built from, so
 * the bars can never add up to a different figure than the estimate uses.
 */
export function LineAhead({
  rows,
  perDay,
}: {
  rows: readonly LineAheadRow[];
  /** DOL's measured decisions per calendar day, when the pace is known. */
  perDay: number | null;
}) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (total <= 0) return null;
  const max = Math.max(...rows.map((r) => r.n));
  const days = perDay && perDay > 0 ? Math.max(1, Math.round(total / perDay)) : null;
  return (
    <section aria-labelledby="line-ahead" className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="line-ahead" className="font-heading text-2xl font-black">
          The line ahead of you
        </h2>{" "}
        <p className="font-heading text-3xl font-black tabular-nums">
          {formatInt(total)} <span className="text-base font-bold">cases</span>
        </p>
      </div>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
        Filed before yours and still in DOL&apos;s ordinary line.
        {days !== null && perDay
          ? ` DOL decides about ${formatInt(Math.round(perDay))} a day lately, so that's about ${formatInt(days)} ${days === 1 ? "day" : "days"} of work.`
          : ""}
      </p>{" "}
      <ChartTips label="Cases ahead of yours in DOL's line, by filing month" className="mt-5">
        <ol className="space-y-2">
          {rows.map((r) => (
            <Fragment key={r.key}>{" "}
            <li
              className="grid grid-cols-[7.75rem_minmax(0,1fr)_4rem] items-center gap-x-3"
              data-tip={`${r.label}${r.own ? ", your own month, filed before you" : ""}\n${formatInt(r.n)} cases still in line`}
            >
              <span className={`font-mono text-sm ${r.own ? "font-bold" : ""}`}>{r.label}</span>{" "}
              <span className="block h-4 border-2 border-border bg-background" aria-hidden="true">
                <span
                  className={`block h-full ${r.own ? "bg-data-warn-ink" : "bg-foreground"}`}
                  style={{ width: `${Math.max(1, Math.round((r.n / max) * 100))}%` }}
                />
              </span>{" "}
              <span className="text-right font-mono text-sm tabular-nums">{formatInt(r.n)}</span>
            </li>
            </Fragment>
          ))}
        </ol>
      </ChartTips>{" "}
      <p className="mt-4 text-sm leading-relaxed text-foreground/70">
        {rows.some((r) => r.own) ? "The last bar is your own filing month, counting only the days before yours. " : ""}Cases
        on hold, at an RFI or on appeal aren&apos;t in the line and aren&apos;t counted.
      </p>
    </section>
  );
}
