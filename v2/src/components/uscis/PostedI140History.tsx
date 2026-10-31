import { Fragment } from "react";

import { ChartHit, hitSpan } from "@/components/data/ChartHit";
import { ChartTips } from "@/components/data/ChartTips";
import { shortDate } from "@convex/lib/months";
import type { PostedSeries } from "@/lib/uscisPosted";

/**
 * How USCIS's posted I-140 figure moved, one small line per petition subtype, every posting since the subtype was
 * first posted under Service Center Operations. Each line has its own scale (a subtype at 3 months and one at 33
 * share no axis worth reading), so the line shows direction and the numbers at either end say how far.
 *
 * Server markup with the site's hover readout (`ChartTips`); each row says its newest figure and its change in words,
 * so the lines add detail and carry no figure alone.
 */

const W = 220;
const H = 40;
const PAD = 4;

const months = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Spark({ points, name }: { points: [string, number][]; name: string }) {
  const vals = points.map((p) => p[1]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - lo) / span);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" role="group" aria-label={`${name}, posted months over time`}>
      <polyline points={line} fill="none" className="stroke-foreground" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      {last ? <circle cx={x(points.length - 1)} cy={y(last[1])} r={3} className="fill-primary stroke-foreground" strokeWidth={1} /> : null}
      {points.map((p, i) => (
        <ChartHit
          key={p[0]}
          tip={`${name}\nPosted ${shortDate(p[0]) ?? p[0]}: ${months(p[1])} months`}
          {...hitSpan(i, points.length, x, 0, W)}
          y={0}
          height={H}
          cx={x(i)}
          cy={y(p[1])}
          r={3}
        />
      ))}
    </svg>
  );
}

export function PostedI140History({ series }: { series: (PostedSeries & { code: string; name: string })[] }) {
  if (series.length === 0) return null;
  return (
    <div>
      <ChartTips label="USCIS's posted I-140 figure over time, by subtype">
        <ul className="divide-y divide-border border-y-2 border-border">
          {series.map((s) => {
            const first = s.points[0];
            const last = s.points[s.points.length - 1];
            if (!first || !last) return null;
            const change = last[1] - first[1];
            return (
              <Fragment key={s.code}>
                {" "}
                <li className="grid grid-cols-1 items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,9rem)] [&>*]:min-w-0">
                  <span className="text-base">
                    {s.name} <span className="font-mono text-sm text-muted-foreground">({s.code})</span>
                  </span>{" "}
                  <Spark points={s.points} name={`${s.name} (${s.code})`} />{" "}
                  <span className="text-sm tabular-nums sm:text-right">
                    <span className="font-mono font-bold">{months(last[1])} mo</span>{" "}
                    <span className="text-muted-foreground">
                      {change === 0 ? "unchanged" : `${change > 0 ? "up" : "down"} ${months(Math.abs(change))}`} since {shortDate(first[0]) ?? first[0]}
                    </span>
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </ChartTips>
    </div>
  );
}
