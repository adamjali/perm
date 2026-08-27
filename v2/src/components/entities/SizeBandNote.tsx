import type { SizeBand } from "@/lib/turso/entityDetail";
import { cn } from "@/lib/utils";

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

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

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
      ? `${fmt(band.minTotal)} ${unit} each`
      : `between ${fmt(band.minTotal)} and ${fmt(band.maxTotal)} ${unit}`;

  return (
    <section
      className={cn("border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6", className)}
    >
      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Against the {subject} ranked nearest
      </p>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        {/* Not "at a similar rate". Rank is dense at the tail and sparse at
            the head, so the same rank window that means "3 to 4 filings each"
            around rank 40,000 means "424 to 6,875" around rank 23. The range
            is printed and the reader judges how alike they are. */}
        The {fmt(band.n)} {subject} ranked nearest this one filed {range}.
        Their median wait is{" "}
        <span className="font-bold tabular-nums">{fmt(band.medianDays)} days</span>
        {delta == null ? (
          <>. This one has too few decided cases to place against them.</>
        ) : delta === 0 ? (
          <>, which is exactly where this one sits.</>
        ) : (
          <>
            , and this one sits{" "}
            <span className="font-bold tabular-nums">{fmt(Math.abs(delta))} days</span>{" "}
            {delta > 0 ? "behind" : "ahead of"} that.
          </>
        )}{" "}
        No approval rate is given for the band. A band is a slice of the
        volume ranking rather than a population picked for having enough
        decided cases, so a band rate would be solid at the top of the list
        and noise at the bottom, under one heading.
      </p>
    </section>
  );
}
