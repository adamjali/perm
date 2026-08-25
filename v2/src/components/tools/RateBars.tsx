/**
 * A denial-rate bar row set, with the baseline drawn through it.
 *
 * The baseline line is the point of the drawing: a rate means nothing on its
 * own, and "above or below the field" is the only reading that survives
 * without a statistics lecture. Bars scale to the largest rate in the set, so
 * a 54% flag does not squash a 1.5% one into invisibility, and every row
 * carries its own denominator because a rate over 300 cases and a rate over
 * 80,000 are not the same claim.
 */

import { BaselineMultiple } from "./Insight";

export interface RateRow {
  label: string;
  /** Optional one-line explanation of what the bucket means. */
  note?: string;
  /** Percent, e.g. 3.53. */
  rate: number;
  decided: number;
}

export function RateBars({ rows, baseline }: { rows: RateRow[]; baseline: number }) {
  if (rows.length === 0) return null;
  const max = Math.max(baseline, ...rows.map((r) => r.rate)) * 1.08;

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
      <div className="space-y-5">
        {rows.map((r) => {
          const ratio = baseline > 0 ? r.rate / baseline : 1;
          // Three bands, not two: at the field, above it, and far above it.
          // A lime/black binary made a 1.2x and a 21x look identical.
          const fill =
            ratio >= 2
              ? "var(--data-bad)"
              : ratio >= 1.2
                ? "var(--data-warn)"
                : "var(--primary)";
          return (
            <div key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold">{r.label}</p>{" "}
                <p className="flex items-baseline gap-2 font-mono text-sm font-bold tabular-nums">
                  <BaselineMultiple rate={r.rate} baseline={baseline} />
                  <span>
                    {r.rate.toFixed(2)}%{" "}
                    <span className="font-normal text-foreground/50">
                      of {r.decided.toLocaleString("en-US")}
                    </span>
                  </span>
                </p>
              </div>
              {/* The track carries the baseline marker, so every bar is read
                  against the field rather than against itself. */}
              <div className="relative mt-2 h-6 border-2 border-border bg-background">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(1.5, (r.rate / max) * 100)}%`,
                    background: fill,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-foreground/40"
                  style={{ left: `${(baseline / max) * 100}%` }}
                />
              </div>
              {r.note ? (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">{r.note}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground/40" />
          Field baseline, {baseline.toFixed(2)}%
        </span>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-border" style={{ background: "var(--data-warn)" }} />
          Above the field
        </span>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-border" style={{ background: "var(--data-bad)" }} />
          Twice the field or more
        </span>
      </p>
    </div>
  );
}
