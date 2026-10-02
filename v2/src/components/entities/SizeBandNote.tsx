import { ChartTips } from "@/components/data/ChartTips";
import type { SizeBand } from "@/lib/turso/entityDetail";
import { FinePrint } from "@/components/data/FinePrint";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/**
 * How this entity's wait compares with the entities filing at its own rate.
 *
 * The distribution figure above it compares the subject with everyone whose
 * case count can carry a rate, which is the right population for a RATE and
 * the wrong one for a wait: it puts a four-filing sponsor on the same axis as
 * one with four thousand. Rank is assigned by volume, so a rank window is a
 * size band, and "the 121 sponsors filing about as often as you" is the
 * comparison that actually applies to a small filer.
 *
 * ONE FIGURE, AND IT IS DAYS. A band is a slice of the volume ranking, not a
 * population selected for having enough decided cases, so a band approval
 * rate would be solid around rank 20 and pure noise around rank 40,000 while
 * wearing one heading. Restricting the band to members that could carry a
 * rate would quietly turn it back into the field. A median wait degrades
 * rather than inverting, so it is the one number the band is asked for.
 */

export function SizeBandNote({
  band,
  subjectMedianDays,
  subject,
  unit,
  className,
}: {
  band: SizeBand;
  /** The subject's own median days, or null when it has none. */
  subjectMedianDays: number | null;
  /** Plural of what one of these is: "sponsors", "firms". */
  subject: string;
  /** What one row is: "filings", "cases". */
  unit: string;
  className?: string;
}) {
  if (band.medianDays == null) return null;
  const delta =
    subjectMedianDays != null ? Math.round(subjectMedianDays - band.medianDays) : null;
  const range =
    band.minTotal === band.maxTotal
      ? `${formatInt(band.minTotal)} ${unit} each`
      : `between ${formatInt(band.minTotal)} and ${formatInt(band.maxTotal)} ${unit}`;

  return (
    <section
      className={cn("border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6", className)}
    >
      <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Against the {subject} ranked nearest
      </p>{" "}
      {/* DRAWN, NOT WRITTEN: the two medians as bars on one
          scale, the range in one line, the method behind "Why no rate". Not
          "at a similar rate": rank is dense at the tail and sparse at the
          head, so the range is printed and the reader judges how alike they
          are. */}
      <p className="mt-2 max-w-3xl text-base text-foreground/80">
        The {formatInt(band.n)} {subject} ranked nearest filed {range}.
      </p>{" "}
      <ChartTips label="Median wait, this one against those ranked nearest" className="mt-4 max-w-xl">
      <dl className="space-y-3">
        {[
          {
            k: `Their median wait`,
            v: band.medianDays,
            strong: false,
            tip: `The ${formatInt(band.n)} ${subject} ranked nearest\nMedian wait ${formatInt(band.medianDays)} days\nFiled ${range}`,
          },
          ...(subjectMedianDays != null
            ? [
                {
                  k: "This one",
                  v: Math.round(subjectMedianDays),
                  strong: true,
                  tip: `This one\nMedian wait ${formatInt(Math.round(subjectMedianDays))} days${
                    delta == null || delta === 0 ? "" : `\n${formatInt(Math.abs(delta))} days ${delta > 0 ? "behind" : "ahead of"} them`
                  }`,
                },
              ]
            : []),
        ].map((row) => {
          const max = Math.max(band.medianDays ?? 1, subjectMedianDays ?? 0, 1);
          return (
            <div key={row.k} data-tip={row.tip} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
              <dt className="text-sm font-bold text-foreground/75">{row.k}</dt>{" "}
              <dd className="m-0 h-4 border-2 border-border bg-background">
                <span
                  className={cn("block h-full", row.strong ? "bg-primary" : "bg-foreground/45")}
                  style={{ width: `${Math.max(2, ((row.v ?? 0) / max) * 100)}%` }}
                />
              </dd>{" "}
              <dd className="m-0 font-mono text-sm font-bold tabular-nums">{formatInt(row.v ?? 0)} days</dd>
            </div>
          );
        })}
      </dl>
      </ChartTips>{" "}
      <p className="mt-3 text-base text-foreground/80">
        {delta == null
          ? "This one has too few decided cases to place against them."
          : delta === 0
            ? "Exactly where this one sits."
            : `This one sits ${formatInt(Math.abs(delta))} days ${delta > 0 ? "behind" : "ahead of"} them.`}
      </p>{" "}
      <FinePrint summary="Why no approval rate" className="mt-1">
        <p>
          A band is a slice of the volume ranking rather than a population
          picked for having enough decided cases, so a band rate would be solid
          at the top of the list and noise at the bottom, under one heading.
        </p>
      </FinePrint>
    </section>
  );
}
