import { BarRows, type BarRow } from "@/components/data/BarRows";
import type { SizeBand } from "@/lib/db/entityDetail";
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

  const rows: BarRow[] = [
    {
      key: "band",
      label: `The ${formatInt(band.n)} ranked nearest`,
      sub: `filed ${range}`,
      value: band.medianDays,
      text: `${formatInt(band.medianDays)} days`,
      tone: "blue",
      tip: `The ${formatInt(band.n)} ${subject} ranked nearest\nMedian wait ${formatInt(band.medianDays)} days\nFiled ${range}`,
    },
    ...(subjectMedianDays != null
      ? [
          {
            key: "this",
            label: "This one",
            value: Math.round(subjectMedianDays),
            text: `${formatInt(Math.round(subjectMedianDays))} days`,
          } satisfies BarRow,
        ]
      : []),
  ];
  return (
    <section className={cn("flex flex-col border-2 border-border bg-card p-5 shadow-hard-sm", className)}>
      {/* DRAWN, NOT WRITTEN: the two medians as bars on one scale, the range
          under the band's bar, the method behind "Why no rate". Not "at a
          similar rate": rank is dense at the tail and sparse at the head, so
          the range is printed and the reader judges how alike they are. */}
      <h3 className="font-heading text-lg font-bold">Against the {subject} ranked nearest</h3>{" "}
      <BarRows label="Median wait, this one against those ranked nearest" className="mt-4" rows={rows} />{" "}
      <p className="mt-3 text-base text-soft">
        {delta == null
          ? "This one has too few decided cases to place against them."
          : delta === 0
            ? "Exactly where this one sits."
            : `This one sits ${formatInt(Math.abs(delta))} days ${delta > 0 ? "behind" : "ahead of"} them.`}
      </p>{" "}
      <div className="mt-auto pt-2">
        <FinePrint summary="Why no approval rate">
          <p>
            A band is a slice of the volume ranking rather than a population
            picked for having enough decided cases, so a band rate would be solid
            at the top of the list and noise at the bottom, under one heading.
          </p>
        </FinePrint>
      </div>
    </section>
  );
}
