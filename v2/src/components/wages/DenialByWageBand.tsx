import { Fragment } from "react";

import {
  MIN_DECIDED_FOR_BAND_RATE,
  isMonotonicFalling,
  worstBand,
  type WageBandRate,
  type WageBandSeries,
} from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

/**
 * Denial rate by wage band, one panel per fiscal year plus the pooled window.
 *
 * SMALL MULTIPLES BECAUSE THE SHAPE IS THE FINDING. A single pooled chart
 * answers "does a higher wage go with a lower denial rate" with a qualified
 * yes and hides the interesting part. Measured on the disclosure corpus:
 *
 *   FY2024   9.44  5.65  3.87  2.70  1.47   falls at every step
 *   FY2025   2.57  3.61  1.53  1.20  0.82   rises into $60k-$80k, then falls
 *   FY2026   4.94  6.62  3.44  2.44  2.24   rises into $60k-$80k, then falls
 *   pooled   5.22  5.21  2.88  2.04  1.47   reads as a plateau, then a fall
 *
 * The pooled row is not a summary of the three above it. FY2024's very high
 * bottom band almost exactly cancels the later years' hump, so pooling erases
 * a real change rather than averaging it. Four panels on one scale let a
 * reader see both the level and the change of shape.
 *
 * NO CAUSE IS OFFERED. There are several plausible explanations and this data
 * cannot separate them, so the page reports the shape, the populations behind
 * it, and nothing else.
 */

export interface DenialByWageBandProps {
  /** Per-year series, oldest first. */
  byYear: WageBandSeries[];
  /** The pooled window across every year. */
  pooled: WageBandRate[];
  className?: string;
}

function Panel({
  title,
  bands,
  max,
  note,
}: {
  title: string;
  bands: WageBandRate[];
  max: number;
  note: string;
}) {
  const worst = worstBand(bands);
  return (
    <div className="border-2 border-border bg-card p-4">
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
        {title}
      </p>{" "}
      <p className="mt-0.5 text-xs text-foreground/70">{note}</p>{" "}
      <ul className="mt-3 space-y-2">
        {bands.map((b) => {
          const isWorst = worst != null && b.from === worst.from;
          return (
            // Keyed Fragment with a trailing space: array items render with
            // NOTHING between them, so "20,120" glues to "FY2025".
            <Fragment key={b.from}>
            <li>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold">{b.band}</span>{" "}
                <span className="font-mono text-xs font-bold tabular-nums text-foreground/70">
                  {b.deniedPct === null ? "withheld" : `${b.deniedPct.toFixed(2)}%`}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-3 min-w-0 flex-1 border-2 border-border bg-background">
                  {b.deniedPct === null ? null : (
                    <div
                      // The worst band in each panel is outlined rather than
                      // recoloured. A second colour would have to mean a
                      // second thing, and "highest in this panel" is the same
                      // measurement, marked.
                      className={cn(
                        "h-full bg-data-bad",
                        isWorst && "outline-2 outline-offset-0 outline-foreground",
                      )}
                      style={{
                        width: `${Math.min(100, (b.deniedPct / max) * 100)}%`,
                      }}
                    />
                  )}
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground/60">
                  {b.decided.toLocaleString("en-US")}
                </span>
              </div>
            </li>{" "}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

export function DenialByWageBand({
  byYear,
  pooled,
  className,
}: DenialByWageBandProps) {
  const every = [...byYear.flatMap((s) => s.bands), ...pooled];
  const max = Math.max(
    1,
    ...every.map((b) => b.deniedPct ?? 0),
  );
  const recent = byYear.filter((s) => !isMonotonicFalling(s.bands));
  const falling = byYear.filter((s) => isMonotonicFalling(s.bands));

  return (
    <div className={className}>
      {/* The reading goes ABOVE the drawing, because a reader who scrolls past
          the bars has already formed the wrong impression from the pooled
          panel. */}
      <p className="text-base leading-relaxed text-foreground/80">
        Denial rate does not fall in a straight line as the wage rises.{" "}
        {recent.length > 0 ? (
          <>
            In{" "}
            {recent
              .map((s) => `FY${s.fiscalYear}`)
              .join(recent.length === 2 ? " and " : ", ")}{" "}
            the highest rate sits in the middle of the range rather than at the
            bottom of it.{" "}
          </>
        ) : null}
        {falling.length > 0 ? (
          <>
            In{" "}
            {falling.map((s) => `FY${s.fiscalYear}`).join(" and ")} it falls at
            every step.{" "}
          </>
        ) : null}
        Pooling the years cancels most of that out, which is why the years are
        drawn apart. What causes the shape is not established here, and this
        data cannot separate the candidates, so no explanation is offered.
      </p>
      <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byYear.map((s) => (
          <Fragment key={s.fiscalYear}>
            <Panel
              title={`FY${s.fiscalYear}`}
              bands={s.bands}
              max={max}
              note="Denied, of decided"
            />{" "}
          </Fragment>
        ))}
        <Panel
          title="All three years"
          bands={pooled}
          max={max}
          note="The pooled window"
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-foreground/60">
        Bars share one scale across all four panels, so a bar means the same
        length everywhere. The figure on the right of each bar is the number of
        decided cases behind it; withdrawn cases are excluded, because a
        withdrawal is the employer stopping rather than a decision going
        against anyone. A band with fewer than{" "}
        {MIN_DECIDED_FOR_BAND_RATE.toLocaleString("en-US")} decided cases is
        withheld rather than drawn.
      </p>
    </div>
  );
}
