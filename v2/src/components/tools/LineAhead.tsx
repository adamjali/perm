import { Fragment } from "react";

import { PageSection } from "@/components/data/PageSection";
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
    <PageSection
      id="line-ahead"
      title="The line ahead of you"
      aside={
        <p className="font-heading text-3xl font-bold tabular-nums">
          {formatInt(total)} <span className="text-base font-semibold">cases</span>
        </p>
      }
      lede={
        <>
          Filed before yours and still in DOL&apos;s ordinary line.
          {days !== null && perDay
            ? ` DOL decides about ${formatInt(Math.round(perDay))} a day lately, so that's about ${formatInt(days)} ${days === 1 ? "day" : "days"} of work.`
            : ""}
        </>
      }
    >
      <ChartTips label="Cases ahead of yours in DOL's line, by filing month">
        <ol className="space-y-2">
          {rows.map((r) => (
            <Fragment key={r.key}>{" "}
            <li
              className="grid grid-cols-[7.75rem_minmax(0,1fr)_4rem] items-center gap-x-3"
              data-tip={`${r.label}${r.own ? ", your own month, filed before you" : ""}\n${formatInt(r.n)} cases still in line`}
              data-href={r.key.startsWith("before:") ? undefined : `/perm-queue/${r.key}`}
            >
              <span className={`font-mono text-sm ${r.own ? "font-semibold" : "text-soft"}`}>{r.label}</span>{" "}
              {/* Soft colours, no black or grey (round 3, Oct 15 2026): the
                  line ahead of you soft green, your own month lime. */}
              <span className="block h-4 border border-foreground/30 bg-card" aria-hidden="true">
                <span
                  className={`block h-full border-r-2 border-foreground/50 ${r.own ? "bg-primary" : "bg-chart-green"}`}
                  style={{ width: `${Math.max(1, Math.round((r.n / max) * 100))}%` }}
                />
              </span>{" "}
              <span className="text-right font-mono text-sm tabular-nums">{formatInt(r.n)}</span>
            </li>
            </Fragment>
          ))}
        </ol>
      </ChartTips>{" "}
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {rows.some((r) => r.own) ? "The last bar is your own filing month, counting only the days before yours. " : ""}Cases
        on hold, at an RFI or on appeal aren&apos;t in the line and aren&apos;t counted.
      </p>
    </PageSection>
  );
}
