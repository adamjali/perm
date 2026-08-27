import { Fragment } from "react";

import {
  MIN_DECIDED_FOR_BAND_RATE,
  coarsenBands,
  reversals,
  worstBand,
  type WageBandRate,
  type WageBandSeries,
} from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

/**
 * Denial rate by wage band, at the resolution the data actually supports.
 *
 * AN EARLIER VERSION OF THIS COMPONENT SHIPPED A FINDING THAT WAS A BINNING
 * ARTEFACT, and the retraction is the reason it now looks like this. With five
 * wide bands the pooled corpus reads 5.22 / 5.21 / 2.88 / 2.04 / 1.47 and each
 * fiscal year appeared to tell a tidy story, including "FY2024 falls at every
 * step". At eleven bands over the same cases, FY2024 goes 9.47% then 12.18%:
 * it does not fall at every step, it never did, and the claim was a property of
 * where the edges were drawn rather than of the filings.
 *
 * So the coarse view is no longer a finding. It is a SUMMARY, drawn second,
 * derived by summing the fine buckets so it cannot disagree with them, and
 * labelled as the thing that hides the structure above it.
 *
 * WHAT SURVIVES EVERY RESOLUTION, and is therefore all this figure claims:
 *   - the rate broadly falls as the wage rises, roughly 5% to roughly 1.4%
 *   - it does not fall smoothly, at any binning tried
 *   - the top is not the floor: over $160k is higher than $130k-$160k in
 *     EVERY fiscal year (1.63 vs 1.37, 0.91 vs 0.74, 2.38 vs 2.11), on tens of
 *     thousands of cases each, which a single "over $130k" band erases
 *
 * NO CAUSE IS OFFERED, and the reason is the same one the site gives for
 * refusing a blended risk score: wage, occupation and employer are entangled,
 * the low bands are dominated by particular occupations, and nothing here can
 * separate them. Naming a cause would be narrating a story over a correlation.
 */

export interface DenialByWageBandProps {
  /** Per-year series at FINE resolution, oldest first. */
  byYear: WageBandSeries[];
  /** The pooled window across every year, at FINE resolution. */
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
                        "h-full bg-data-bad-ink",
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
              {/* The interval sits with its own rate, not in a footnote. It is
                  what separates "this band is worse" from "this band looks
                  worse": in FY2025 and FY2026 the $60k-$80k interval clears
                  the sub-$60k interval entirely, so the hump is a measurement
                  rather than an impression. */}
              {b.interval ? (
                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground/55">
                  95% interval {b.interval.lo.toFixed(2)} to{" "}
                  {b.interval.hi.toFixed(2)}%
                </p>
              ) : null}
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
  const max = Math.max(1, ...every.map((b) => b.deniedPct ?? 0));
  // Summed from the fine bands rather than queried, so the summary and the
  // structure are the same numbers at two resolutions by construction.
  const coarse = coarsenBands(pooled);
  const coarseMax = Math.max(1, ...coarse.map((b) => b.deniedPct ?? 0));

  const known = pooled.filter((b) => b.deniedPct !== null);
  const lowest = known[0];
  const highest = known[known.length - 1];
  const peak = worstBand(pooled);
  const bumps = reversals(pooled);

  return (
    <div className={className}>
      {/* The reading goes ABOVE the drawing. A reader who forms an impression
          from the bars first and meets the caveat afterwards has already been
          misled, which is exactly how the retracted version worked. */}
      <p className="text-base leading-relaxed text-foreground/80">
        The denial rate broadly falls as the offered wage rises
        {lowest && highest ? (
          <>
            , from {(lowest.deniedPct as number).toFixed(1)}% in the{" "}
            {lowest.band.toLowerCase()} band to{" "}
            {(highest.deniedPct as number).toFixed(1)}% in the{" "}
            {highest.band.toLowerCase()} band
          </>
        ) : null}
        . It does not fall smoothly.{" "}
        {peak ? (
          <>
            The highest rate here is {peak.band.toLowerCase()} at{" "}
            {(peak.deniedPct as number).toFixed(2)}%, not the bottom of the
            range.{" "}
          </>
        ) : null}
        {bumps.length > 0 ? (
          <>
            {bumps.length === 1 ? "One pair of neighbouring bands goes" : `${bumps.length} pairs of neighbouring bands go`}{" "}
            the wrong way.{" "}
          </>
        ) : null}
        Where those bumps sit moves with the band edges, so the bumps are not a
        finding and no cause is offered for them: wage, occupation and employer
        are entangled in these filings and nothing here separates them.
      </p>{" "}
      <p className="mt-6 font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
        Eleven bands, by fiscal year and pooled
      </p>
      <div className="mt-3 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* The summary comes SECOND and says what it costs. */}
      <div className="mt-8 border-2 border-border bg-muted p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          The same cases in five wide bands
        </p>{" "}
        <p className="mt-1 text-sm leading-relaxed text-foreground/70">
          Summed from the eleven above, not measured separately. Read it as a
          scanning aid: it averages the{" "}
          {peak ? peak.band.toLowerCase() : "peak"} band together with its
          quieter neighbours, which is how a plateau appears at the bottom of
          the range where the finer view has a peak.
        </p>
        <div className="mt-4">
          <Panel
            title="Pooled summary"
            bands={coarse}
            max={coarseMax}
            note="Derived from the eleven-band view"
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/60">
        Bars share one scale within each block. The figure on the right of each
        bar is the number of decided cases behind it; withdrawn cases are
        excluded, because a withdrawal is the employer stopping rather than a
        decision going against anyone. A band with fewer than{" "}
        {MIN_DECIDED_FOR_BAND_RATE.toLocaleString("en-US")} decided cases is
        withheld rather than drawn.
      </p>
    </div>
  );
}
