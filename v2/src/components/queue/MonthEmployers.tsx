import { Fragment } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { entityHref } from "@/lib/entityPayload";
import { formatInt } from "@/lib/format";
import type { MonthEmployer } from "@/lib/monthDetail";

/**
 * The employers that filed the most PERM cases in one filing month, each as
 * one bar as long as its filings, split into what DOL has decided (green)
 * and what is still waiting (yellow). The first ten show; the rest fold.
 * From the nightly sweep's record of every case (`fold_month_employers`).
 */

const SHOWN = 10;

function Rows({ rows, max, start }: { rows: readonly MonthEmployer[]; max: number; start: number }) {
  return (
    <ol className="space-y-3" start={start}>
      {rows.map((r) => {
        const waiting = r.filed - r.decided;
        const width = Math.max(1, (r.filed / max) * 100);
        return (
          <Fragment key={`${r.slug ?? ""}|${r.name}`}>
            {" "}
            <li data-tip={`${r.name}\n${formatInt(r.filed)} filed\n${formatInt(r.decided)} decided\n${formatInt(waiting)} waiting`}>
              <div className="flex items-baseline justify-between gap-3">
                {r.slug ? (
                  // A 44px tap target, its extra height taken back by the margin.
                  <span className="-my-3 flex min-w-0 text-base">
                    <Link href={entityHref("employer", r.slug)} className="link truncate py-3">
                      {r.name}
                    </Link>
                  </span>
                ) : (
                  <span className="min-w-0 truncate text-base">{r.name}</span>
                )}{" "}
                <span className="shrink-0 font-heading text-lg font-bold tabular-nums">{formatInt(r.filed)}</span>
              </div>{" "}
              <div className="mt-1 h-3 w-full bg-muted" aria-hidden="true">
                <div className="flex h-full" style={{ width: `${width}%` }}>
                  {r.decided > 0 ? (
                    <div className="h-full border-r-2 border-data-good-ink bg-chart-green" style={{ width: `${(r.decided / r.filed) * 100}%` }} />
                  ) : null}
                  {waiting > 0 ? <div className="h-full flex-1 bg-chart-yellow" /> : null}
                </div>
              </div>{" "}
              <p className="mt-1 text-sm text-muted-foreground">
                {r.decided === 0
                  ? "None decided yet"
                  : waiting === 0
                    ? "All decided"
                    : `${formatInt(r.decided)} decided, ${formatInt(waiting)} waiting`}
              </p>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

export function MonthEmployers({ label, top, total }: { label: string; top: readonly MonthEmployer[]; total: number }) {
  if (top.length === 0) return null;
  const max = Math.max(1, ...top.map((r) => r.filed));
  const shown = top.slice(0, SHOWN);
  const rest = top.slice(SHOWN);
  return (
    <section aria-labelledby="month-employers" className="mt-8">
      <h2 id="month-employers" className="font-heading text-xl font-bold">
        {`Who filed the most in ${label}`}
      </h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-soft">
        {`The ${formatInt(top.length)} busiest of the ${formatInt(total)} employers that filed PERM cases in ${label}, by our daily check of DOL's case status.`}
      </p>{" "}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 border border-foreground bg-chart-green" /> Decided
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="inline-block size-3 border border-foreground bg-chart-yellow" /> Still waiting
        </span>
      </div>{" "}
      <ChartTips label={`The employers that filed the most PERM cases in ${label}`} className="mt-4">
        <Rows rows={shown} max={max} start={1} />
      </ChartTips>{" "}
      {rest.length > 0 ? (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold">{`${formatInt(rest.length)} more`}</summary>{" "}
          <ChartTips label={`More employers that filed PERM cases in ${label}`} className="mt-3">
            <Rows rows={rest} max={max} start={SHOWN + 1} />
          </ChartTips>
        </details>
      ) : null}
    </section>
  );
}
