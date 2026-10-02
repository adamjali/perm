/**
 * The parts the three entity detail pages (employers, law firms, occupations)
 * render alike: the figure cards, the position-in-the-field plate, and the
 * notes each page closes with. Each takes the page's own nouns, so the shared
 * markup never says "firm" on an employer's page.
 *
 * @see src/lib/entityPage.ts for the metadata and structured data they share
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { formatDollars, formatInt } from "@/lib/format";
import type { FieldDistribution } from "@/lib/turso/entities";
import type { FacetRow } from "@/lib/turso/entityDetail";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import {
  MIN_DECIDED_FOR_MEDIAN,
  rateReliability,
  type RateReliability,
} from "@/components/tools/EntityContext";

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

// ============================================================================
// STANDING
// ============================================================================

export interface EntityStanding {
  reliability: RateReliability;
  /** Whether the subject is in the field the plate draws (its rate isn't withheld). */
  inCohort: boolean;
  /** Its median days minus the field's, or null when either is missing. */
  daysDelta: number | null;
  /** Too few decided cases for the median to mean much. */
  thinMedian: boolean;
}

/** The middle value (the upper of the two for an even count), or null for none. */
function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
}

/**
 * How the subject stands against its field. The days card and the plate read
 * one number: the median of the cohort's own medians, which is the
 * distribution the plate draws.
 */
export function entityStanding(
  row: { certified: number; denied: number; medianDays: number | null },
  dist: FieldDistribution,
  baselineDenialPct: number,
): EntityStanding {
  const reliability = rateReliability(row.certified, row.denied, baselineDenialPct);
  const fieldDays = median(dist.medianDays);
  return {
    reliability,
    inCohort: reliability.tier !== "withheld",
    daysDelta: row.medianDays != null && fieldDays != null ? row.medianDays - fieldDays : null,
    thinMedian: reliability.decided < MIN_DECIDED_FOR_MEDIAN,
  };
}

// ============================================================================
// FIGURE CARDS
// ============================================================================

export interface StatCard {
  k: string;
  v: string;
  sub: string;
  /** Span both columns on a phone, so an odd last card doesn't leave a hole. */
  wide?: boolean;
}

/** One row from `sm` up. Tailwind only builds classes written out in full. */
const SM_COLUMNS: Record<number, string> = { 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };

/** The figure cards, one bordered grid. The page places it, below its ReliabilityBand. */
export function EntityStatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div
      className={`grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border ${SM_COLUMNS[cards.length] ?? ""}`}
    >
      {cards.map((d) => (
        <div
          key={d.k}
          className={
            d.wide ? "bg-card p-5 col-span-2 sm:col-span-1" : "bg-card p-5"
          }
        >
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/60">
            {d.k}
          </p>{" "}
          <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">{d.v}</p>{" "}
          {d.sub ? <p className="mt-1 text-sm text-foreground/70">{d.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

/** The filing count, with the rank when the kind's size is known. */
export function volumeCard(
  label: string,
  row: { total: number; rank: number },
  kindTotal: number,
): StatCard {
  return {
    k: label,
    v: formatInt(row.total),
    sub: kindTotal > 0 ? `#${formatInt(row.rank)} of ${formatInt(kindTotal)}` : "",
  };
}

export function certifiedCard(row: { certified: number; denied: number }): StatCard {
  return { k: "Certified", v: formatInt(row.certified), sub: `${formatInt(row.denied)} denied` };
}

/** The approval rate, or the reason it's withheld, beside the field's. */
export function approvalCard(reliability: RateReliability, baselineDenialPct: number): StatCard {
  return {
    k: "Approval",
    v: reliability.ratePct == null ? "—" : `${reliability.ratePct.toFixed(1)}%`,
    sub:
      reliability.ratePct == null
        ? `withheld: ${formatInt(reliability.decided)} decided`
        : `field ${(100 - baselineDenialPct).toFixed(1)}%`,
  };
}

/** The median offered wage; wide, because it's the fifth card. */
export function medianWageCard(medianAnnualWage: number | null): StatCard {
  return {
    k: "Median wage",
    v: medianAnnualWage == null ? "—" : formatDollars(medianAnnualWage),
    sub: medianAnnualWage == null ? "not on file" : "offered, per year",
    wide: true,
  };
}

/** Median days to decision, against the field's when the sample can carry it. */
export function medianDaysCard(medianDays: number | null, standing: EntityStanding): StatCard {
  const { reliability, daysDelta, thinMedian } = standing;
  return {
    k: "Median days",
    v: medianDays == null ? "—" : formatInt(Math.round(medianDays)),
    sub: thinMedian
      ? `middle of ${formatInt(reliability.decided)} decided`
      : daysDelta == null
        ? ""
        : Math.round(daysDelta) === 0
          ? "at the field median"
          : `${formatInt(Math.abs(Math.round(daysDelta)))} ${daysDelta > 0 ? "slower" : "faster"} than the field`,
  };
}

// ============================================================================
// POSITION IN THE FIELD
// ============================================================================

/** A field this small is a handful of points, not a distribution, so no plate. */
const MIN_COHORT_FOR_PLATE = 8;

/**
 * Where the subject sits among every entity of its kind with enough decided
 * cases to carry a rate: approval and median days, plus any measure the page
 * puts `first`. Entities under the bar are left out of the population, and a
 * subject under it is marked but not ranked.
 */
export function FieldPositionPlate({
  n,
  singular,
  plural,
  dist,
  standing,
  medianDays,
  lead,
  inCohortNote = "The line marks this one.",
  outOfCohortNote,
  first,
}: {
  n: string;
  /** The kind's noun: "sponsor". */
  singular: string;
  /** Its plural: "sponsors". */
  plural: string;
  dist: FieldDistribution;
  standing: EntityStanding;
  medianDays: number | null;
  /** The caption's opening, before the line about this subject. */
  lead: ReactNode;
  inCohortNote?: string;
  outOfCohortNote: string;
  /** A measure drawn before approval and days. */
  first?: ReactNode;
}) {
  if (dist.cohort < MIN_COHORT_FOR_PLATE) return null;
  const { reliability, inCohort } = standing;
  return (
    <FigurePlate
      n={n}
      title="Position in the field"
      subject={`${formatInt(dist.cohort)} ${plural} with ${dist.minDecided}+ decided`}
      caption={
        <>
          {lead}{" "}
          {inCohort ? inCohortNote : outOfCohortNote}{" "}
          {dist.complete
            ? ""
            : `The scan behind this cohort didn’t reach past the last qualifying ${singular}, so read it as the busiest part of the field rather than all of it. `}
        </>
      }
      source="DOL PERM disclosure files"
      className="mt-10"
    >
      <div className={`grid [&>*]:min-w-0 grid-cols-1 gap-8 ${first ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {first}
        <FieldPosition
          population={dist.approval}
          value={inCohort ? reliability.ratePct : null}
          valueLabel={
            reliability.ratePct == null ? "not shown" : `${reliability.ratePct.toFixed(1)}%`
          }
          measure="Approval rate"
          betterWhen="higher"
          format={(x) => `${x.toFixed(0)}%`}
          note={`under ${dist.minDecided} decided`}
        />
        {/* The days figure is real whatever the case count is, so the
            marker is drawn even for a subject outside the population. What
            is withheld is the PERCENTILE, because a percentile is a claim
            about membership and this subject is not a member. */}
        <FieldPosition
          population={dist.medianDays}
          value={medianDays}
          subjectInPopulation={inCohort}
          valueLabel={medianDays == null ? "—" : `${Math.round(medianDays)} days`}
          measure="Median days to decision"
          betterWhen="lower"
          format={(x) => `${Math.round(x)}d`}
          note={`middle of ${formatInt(reliability.decided)} decided, too few to rank`}
        />
      </div>
    </FigurePlate>
  );
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * The limits-panel caveat that an offered wage measures the job mix rather
 * than the filer, so the page draws it against no field.
 */
export function wageIsTheJobLimit({
  topOccupation,
  total,
  filers,
}: {
  topOccupation: FacetRow | undefined;
  total: number;
  /** Who chooses the roles: "they", or "their clients" for a law firm. */
  filers: string;
}): { head: string; body: ReactNode } {
  return {
    head: "The wage is the job, not the payer",
    body: (
      <>
        {topOccupation ? (
          <>
            Their filings are led by {topOccupation.label}, {formatInt(topOccupation.n)} of{" "}
            {formatInt(total)}.{" "}
          </>
        ) : null}
        {`The median offered wage moves almost entirely with what roles ${filers}`}
        {" "}
        file. A software developer and a poultry cutter are different
        numbers wherever they are filed, so this figure is not plotted
        against the field and no percentile is given for it: that
        comparison would rank occupation mix and call it pay. Wages by
        occupation are on the{" "}
        <Link href="/perm-wages" className={LINK}>
          wages page
        </Link>
        .
      </>
    ),
  };
}

/** A closing card that sends a reader with a case at this entity to the estimator. */
export function DecisionEstimatorCard({ heading }: { heading: string }) {
  return (
    <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
      <h2 className="font-heading text-lg font-black">{heading}</h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-foreground/70">
        The{" "}
        <Link href="/tools/perm-timeline-calculator" className={LINK}>
          decision estimator
        </Link>{" "}
        reads your filing month against where DOL is now.
      </p>
    </div>
  );
}

/**
 * Why the newest filings are missing here: DOL names the firm and the
 * occupation only when it publishes a case, while the live list carries the
 * employer from the day of filing.
 */
export function UnpublishedFilingsNote({ subject }: { subject: string }) {
  return (
    <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/70">
      {`Filings newer than DOL's last published file can't be attributed to this ${subject} until DOL publishes them. The `}
      <Link href="/perm-cases#live" className={LINK}>live list</Link>
      {" on the case search page carries them by employer."}
    </p>
  );
}
