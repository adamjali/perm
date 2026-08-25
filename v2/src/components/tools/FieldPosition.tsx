import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Where one entity sits inside the whole field, drawn.
 *
 * This is the entity pages' own question - "is this employer fast, slow,
 * clean, unusual?" - and a stat card cannot answer it, because a number has
 * no context. The strip shows the real distribution of every entity on the
 * same measure, with this one marked, so "483 days" becomes "just past the
 * middle of the pack" without anyone having to say it.
 *
 * Doctrine notes: geometry comes from the real values, never from a guess;
 * the label sits in its own row above the strip rather than inside a
 * data-driven shape, so a short bar can never swallow it; and the strip is
 * a histogram of the actual population, not a decorative gradient.
 *
 * TIES ARE COUNTED SEPARATELY, and that was a real defect rather than a
 * refinement. Measured on the live table, 679 of the 924 employers with
 * enough decided cases to carry a rate have a spotless one, so a percentile
 * over approval rate is dominated by ties: the old code reported "ahead of
 * 73% of the field" for an employer that was level with 73% of it. A tie is
 * not an advantage and the sentence now says so.
 *
 * `value` may be null, for a figure that is withheld outright. The field is
 * still drawn - it is the shape of the answerable version of the question -
 * and the header says plainly that this subject is not on it, rather than the
 * drawing quietly vanishing.
 *
 * `subjectInPopulation` is the separate, weaker case, and it earns its keep on
 * the small entities that most of these pages are about. A sponsor with three
 * decided cases has a real median-days figure and a real offered wage; what it
 * does not have is membership of the population those axes are drawn from. So
 * the marker IS drawn - the reader gets to see where three cases landed
 * against the busy field, which is what they came to find out - and the
 * percentile is replaced by `note`, because "ahead of 91% of the field" over
 * three cases is a precision the number does not have.
 */

export interface FieldPositionProps {
  /** Every entity's value on this measure, including the subject's. */
  population: number[];
  /** The subject's own value, or null when it is not in the population. */
  value: number | null;
  /** Rendered beside the measure, e.g. "483 days". */
  valueLabel: string;
  /** What the axis measures, e.g. "Median days to decision". */
  measure: string;
  /** Lower values are better (days) or worse (approval rate). */
  betterWhen?: "lower" | "higher";
  /** Formats an axis end label. */
  format?: (n: number) => string;
  /**
   * Whether the subject's own value is one of the numbers in `population`.
   * When false the marker is still drawn but no percentile is claimed, because
   * a percentile is a statement about membership.
   */
  subjectInPopulation?: boolean;
  /**
   * How to word the comparison. "ahead of" suits a rate or a speed; a wage is
   * not better or worse than another wage, it is simply higher, so the wage
   * page passes "above".
   */
  aheadVerb?: string;
  /** Shown in place of a percentile when no percentile may be claimed. */
  note?: ReactNode;
  className?: string;
}

const BINS = 28;
/** Two floats built from the same integers can differ in the last bit. */
const EPS = 1e-9;

export function FieldPosition({
  population,
  value,
  valueLabel,
  measure,
  betterWhen = "lower",
  format = (n) => String(Math.round(n)),
  subjectInPopulation = true,
  aheadVerb = "ahead of",
  note,
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

  const placed = value != null && Number.isFinite(value);
  const pct = placed ? ((value - min) / (max - min)) * 100 : 0;
  const clampedPct = Math.min(98, Math.max(2, pct));
  const subjectBin = placed
    ? Math.min(BINS - 1, Math.max(0, Math.floor(((value - min) / (max - min)) * BINS)))
    : -1;

  // Strictly worse, strictly tied. Counting them apart is the whole point:
  // "ahead of 73%" and "level with 73%" are opposite readings of one number.
  let worse = 0;
  let tied = 0;
  const ranked = placed && subjectInPopulation;
  if (ranked) {
    for (const n of clean) {
      if (Math.abs(n - value) < EPS) tied++;
      else if (betterWhen === "lower" ? n > value : n < value) worse++;
    }
    tied = Math.max(0, tied - 1);
  }
  const aheadPct = ranked ? (worse / clean.length) * 100 : 0;
  const tiedShare = ranked ? tied / clean.length : 0;

  return (
    <div className={cn("", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/60">
          {measure}
        </p>{" "}
        <p className="font-mono text-xs font-bold tabular-nums">
          {valueLabel}
          <span className="ml-2 font-normal text-foreground/70">
            {ranked ? (
              <>
                {aheadVerb} {aheadPct.toFixed(aheadPct >= 99 || aheadPct < 1 ? 1 : 0)}%
                {tiedShare >= 0.05
                  ? `, level with ${tied.toLocaleString("en-US")} more`
                  : ""}
              </>
            ) : (
              (note ?? "not placed on this axis")
            )}
          </span>
        </p>
      </div>

      {/* The field, as its own distribution. */}
      <div className="relative mt-2 flex h-14 items-end gap-px border-b-2 border-border">
        {counts.map((c, i) => {
          const binMid = min + ((i + 0.5) / BINS) * (max - min);
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn("flex-1", i === subjectBin ? "bg-primary" : "bg-foreground/25")}
              style={{ height: `${Math.max(4, (c / peak) * 100)}%` }}
              title={format(binMid)}
            />
          );
        })}
        {/* The marker rides above the bars so it is never hidden by one. */}
        {placed ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 top-[-6px] w-0.5 bg-foreground"
            style={{ left: `${clampedPct}%` }}
          />
        ) : null}
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-foreground/60">
        <span>{format(min)}</span>{" "}
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
