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
          const above = r.rate > baseline;
          return (
            <div key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold">{r.label}</p>{" "}
                <p className="font-mono text-sm font-bold tabular-nums">
                  {r.rate.toFixed(2)}%{" "}
                  <span className="font-normal text-foreground/50">
                    of {r.decided.toLocaleString("en-US")}
                  </span>
                </p>
              </div>
              {/* The track carries the baseline marker, so every bar is read
                  against the field rather than against itself. */}
              <div className="relative mt-2 h-6 border-2 border-border bg-background">
                <div
                  className={above ? "h-full bg-foreground" : "h-full bg-primary"}
                  style={{ width: `${Math.max(1.5, (r.rate / max) * 100)}%` }}
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
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-border bg-foreground" />
          Above baseline
        </span>
      </p>
    </div>
  );
}
