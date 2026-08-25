import { cn } from "@/lib/utils";

/**
 * Where one entity sits inside the whole field, drawn.
 *
 * This is the entity pages' own question — "is this employer fast, slow,
 * clean, unusual?" — and a stat card cannot answer it, because a number has
 * no context. The strip shows the real distribution of every entity on the
 * same measure, with this one marked, so "483 days" becomes "just past the
 * middle of the pack" without anyone having to say it.
 *
 * Doctrine notes: geometry comes from the real values, never from a guess;
 * the label sits in its own row above the strip rather than inside a
 * data-driven shape, so a short bar can never swallow it; and the strip is
 * a histogram of the actual population, not a decorative gradient.
 */

export interface FieldPositionProps {
  /** Every entity's value on this measure, including the subject's. */
  population: number[];
  /** The subject's own value. */
  value: number;
  /** Rendered under the marker, e.g. "483 days". */
  valueLabel: string;
  /** What the axis measures, e.g. "Median days to decision". */
  measure: string;
  /** Lower values are better (days) or worse (approval rate). */
  betterWhen?: "lower" | "higher";
  /** Formats an axis end label. */
  format?: (n: number) => string;
  className?: string;
}

const BINS = 28;

export function FieldPosition({
  population,
  value,
  valueLabel,
  measure,
  betterWhen = "lower",
  format = (n) => String(Math.round(n)),
  className,
}: FieldPositionProps) {
  const clean = population.filter((n) => Number.isFinite(n));
  if (clean.length < 8) return null;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max <= min) return null;

  // A real histogram of the field, so the shape carries information.
  const counts = new Array<number>(BINS).fill(0);
  for (const n of clean) {
    const i = Math.min(BINS - 1, Math.floor(((n - min) / (max - min)) * BINS));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  const peak = Math.max(...counts, 1);

  const pct = ((value - min) / (max - min)) * 100;
  const clampedPct = Math.min(98, Math.max(2, pct));

  // Rank among the field, which is the sentence the reader wants.
  const below = clean.filter((n) => n < value).length;
  const percentile = Math.round((below / clean.length) * 100);
  const better = betterWhen === "lower" ? 100 - percentile : percentile;

  return (
    <div className={cn("", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">
          {measure}
        </p>{" "}
        <p className="font-mono text-xs font-bold tabular-nums">
          {valueLabel}
          <span className="ml-2 font-normal text-foreground/55">
            ahead of {better}% of the field
          </span>
        </p>
      </div>

      {/* The field, as its own distribution. */}
      <div className="relative mt-2 flex h-14 items-end gap-px border-b-2 border-border">
        {counts.map((c, i) => {
          const binMid = min + ((i + 0.5) / BINS) * (max - min);
          const isSubject =
            Math.floor(((value - min) / (max - min)) * BINS) === Math.min(BINS - 1, i);
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn("flex-1", isSubject ? "bg-primary" : "bg-foreground/15")}
              style={{ height: `${Math.max(4, (c / peak) * 100)}%` }}
              title={format(binMid)}
            />
          );
        })}
        {/* The marker rides above the bars so it is never hidden by one. */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 top-[-6px] w-0.5 bg-foreground"
          style={{ left: `${clampedPct}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-foreground/50">
        <span>{format(min)}</span>{" "}
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
