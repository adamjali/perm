import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt, formatShareOf } from "@/lib/format";
import { outcomeTotal, type LayoffOutcomes as Outcomes } from "@/lib/layoffDisclosures";

/**
 * How the applications that said yes ended, beside those that said no, in the
 * site's status colours (certified green, denied red, withdrawn purple). Two
 * bars on one length, each split by outcome; the legend carries the figures.
 */

const PARTS = [
  { key: "certified", label: "Certified", bg: "bg-chart-green" },
  { key: "denied", label: "Denied", bg: "bg-data-bad-ink" },
  { key: "withdrawn", label: "Withdrawn by the employer", bg: "bg-data-purple-ink" },
] as const;

function Row({ title, o }: { title: string; o: Outcomes }) {
  const total = outcomeTotal(o);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-heading text-lg font-bold">{title}</h3>{" "}
        <p className="font-mono text-sm tabular-nums text-muted-foreground">{formatInt(total)} decided</p>
      </div>{" "}
      <div className="mt-2 flex h-7 w-full overflow-hidden border border-input" aria-hidden="true">
        {PARTS.map((p) => (
          <div
            key={p.key}
            data-tip={`${title}\n${p.label}: ${formatInt(o[p.key])}\n${formatShareOf(o[p.key], total)} of ${formatInt(total)}`}
            className={p.bg}
            style={{ width: total > 0 ? `${(o[p.key] / total) * 100}%` : "0%" }}
          />
        ))}
      </div>{" "}
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {PARTS.map((p) => (
          <Fragment key={p.key}>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 border border-input ${p.bg}`} />{" "}
              <span>{p.label}</span>{" "}
              <span className="font-mono font-bold tabular-nums">{formatShareOf(o[p.key], total)}</span>
            </li>{" "}
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

export function LayoffOutcomes({ yes, no, fyLabel }: { yes: Outcomes; no: Outcomes; fyLabel: string }) {
  return (
    <ChartTips label={`How the applications that reported a layoff ended, against the rest, ${fyLabel}`}>
      <div className="space-y-6">
        <Row title="Said yes to a layoff" o={yes} />{" "}
        <Row title="Said no" o={no} />
      </div>
    </ChartTips>
  );
}
