import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import type { OutcomeQuarter } from "@/lib/activityStats";
import { ScrollBox } from "@/components/ui/scroll-box";

/**
 * What happened to the cases DOL decided, quarter by quarter.
 *
 * SHARES, NOT COUNTS. A count moves with how many cases DOL happened to clear
 * that quarter, and the question here is what happened to them.
 *
 * CERTIFIED IS NOT DRAWN. It stays near nine in ten every quarter, so a
 * stacked bar would be one enormous band and two slivers, and the two slivers
 * are the whole story. Certified is in each column's detail and in the table.
 *
 * TWO STRIPS ON ONE SCALE. Each quarter used to be a row with two bars and two
 * lines of figures, about 110 px apiece, so forty-five quarters ran to some
 * five thousand pixels. As two strips of columns, denied above withdrawn and
 * both against the same top, the whole record fits in one view and the two
 * trends read against each other. Every figure stays in the column's detail
 * and in the folded table.
 *
 * TWO MEANINGS, TWO COLOURS. Denied and withdrawn are different events and
 * neither is a dimmer version of the other, so they are drawn in the palette's
 * "bad" and "in progress" ink tokens rather than at two opacities of one hue.
 */

const SERIES = [
  // -ink on both: --data-warn measures 2.07:1 on the page and fails the 3:1
  // graphic floor, and a legend swatch that does not match its bar is worse
  // than either alone.
  { key: "deniedPct", label: "Denied", bg: "bg-data-bad-ink" },
  { key: "withdrawnPct", label: "Withdrawn by the employer", bg: "bg-data-purple-ink" },
] as const;

const tip = (q: OutcomeQuarter) =>
  `${q.quarter}\n${q.deniedPct.toFixed(2)}% denied\n${q.withdrawnPct.toFixed(2)}% withdrawn\n${q.certifiedPct.toFixed(1)}% certified\n${q.total.toLocaleString("en-US")} decided`;

export function OutcomeMix({
  quarters,
  className,
}: {
  quarters: OutcomeQuarter[];
  className?: string;
}) {
  if (quarters.length === 0) return null;
  const max = Math.max(1, ...quarters.map((q) => Math.max(q.deniedPct, q.withdrawnPct)));
  const newest = quarters[quarters.length - 1]!;
  const firstQ1 = quarters.findIndex((q) => q.quarter.endsWith("-Q1"));
  return (
    <div className={className}>
      <ChartTips label="Denied and withdrawn shares by quarter">
        <div className="space-y-5">
          {SERIES.map((s) => {
            const values = quarters.map((q) => q[s.key]);
            const low = quarters[values.indexOf(Math.min(...values))]!;
            const high = quarters[values.indexOf(Math.max(...values))]!;
            return (
              <div key={s.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  {/* The strip's own label is its legend: the swatch beside the name. */}
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <span aria-hidden="true" className={`h-3 w-8 border border-input ${s.bg}`} />{" "}
                    <span>{s.label}</span>
                  </p>{" "}
                  <p className="font-mono text-sm tabular-nums text-muted-foreground">
                    {`${newest[s.key].toFixed(2)}% in ${newest.quarter}; lowest ${low[s.key].toFixed(2)}% (${low.quarter}), highest ${high[s.key].toFixed(2)}% (${high.quarter})`}
                  </p>
                </div>{" "}
                <div className="mt-2 flex h-24 items-end gap-[2px] border-b-2 border-border sm:gap-1">
                  {quarters.map((q) => (
                    <div
                      key={q.quarter}
                      data-tip={tip(q)}
                      className={`min-w-0 flex-1 ${s.bg}`}
                      style={{ height: `${Math.max((q[s.key] / max) * 100, 1)}%` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>{" "}
        {/* Years under their first quarters; the first column too when no
            first quarter is close enough to crowd it. */}
        <div aria-hidden="true" className="mt-1.5 flex gap-[2px] sm:gap-1">
          {quarters.map((q, i) => (
            <Fragment key={q.quarter}>
              <span className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                {q.quarter.endsWith("-Q1") || (i === 0 && (firstQ1 < 0 || firstQ1 >= 3))
                  ? `’${q.quarter.slice(2, 4)}`
                  : ""}
              </span>{" "}
            </Fragment>
          ))}
        </div>
      </ChartTips>{" "}
      <details className="mt-4 border-t-2 border-[var(--object-border)]">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold">
          Every quarter&apos;s figures
        </summary>
        <ScrollBox label="Every quarter's figures" className="border-t border-border">
          <table className="w-full min-w-[30rem] text-left text-sm tabular-nums">
            <caption className="sr-only">Decided PERM cases by quarter: certified, denied and withdrawn shares</caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Quarter{" "}</th>
                <th scope="col" className="px-3 py-2">Certified{" "}</th>
                <th scope="col" className="px-3 py-2">Denied share{" "}</th>
                <th scope="col" className="px-3 py-2">Withdrawn share{" "}</th>
                <th scope="col" className="px-3 py-2 text-right">Decided{" "}</th>
              </tr>
            </thead>
            <tbody>
              {[...quarters].reverse().map((q) => (
                <tr key={q.quarter} className="border-t border-border/40">
                  <th scope="row" className="px-3 py-1.5 font-mono font-bold">{q.quarter}{" "}</th>
                  <td className="px-3 py-1.5">{q.certifiedPct.toFixed(1)}% certified{" "}</td>
                  <td className="px-3 py-1.5">{q.deniedPct.toFixed(2)}%{" "}</td>
                  <td className="px-3 py-1.5">{q.withdrawnPct.toFixed(2)}%{" "}</td>
                  <td className="px-3 py-1.5 text-right">{q.total.toLocaleString("en-US")} decided{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      </details>{" "}
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Both strips share one scale. Each quarter is when DOL decided, not when the cases were filed, and the
        quarters at the ends are partial.
      </p>
    </div>
  );
}
