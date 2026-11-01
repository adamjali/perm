/**
 * The parts the three entity detail pages (employers, law firms, occupations)
 * render alike: the figure cards, the position-in-the-field plate, and the
 * notes each page closes with. Each takes the page's own nouns, so the shared
 * markup never says "firm" on an employer's page.
 *
 * @see src/lib/entityPage.ts for the metadata and structured data they share
 */

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { formatDollars, formatInt } from "@/lib/format";
import type { FieldDistribution } from "@/lib/db/entities";
import type { FacetRow } from "@/lib/db/entityDetail";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  FilesIcon,
  HourglassMediumIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/ssr";
import { Figure, FigureRow, type FigureTrend } from "@/components/data/FigureRow";
import {
  rateReliability,
  type RateReliability,
} from "@/components/tools/EntityContext";
import { MIN_DECIDED_FOR_MEDIAN } from "@/lib/entityPayload";


// ============================================================================
// STANDING
// ============================================================================

export interface EntityStanding {
  reliability: RateReliability;
  /** Whether the subject is in the field the plate draws (its rate isn't withheld). */
  inCohort: boolean;
  /** Its median days minus the field's, or null when either is missing. */
  daysDelta: number | null;
  /** The field's median days, the yardstick daysDelta is measured against. */
  fieldDays: number | null;
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
    fieldDays,
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
  /** What the figure is, as one icon before its label. */
  icon?: keyof typeof CARD_ICON;
  /** The figure against its yardstick: the field, or the year before. */
  trend?: FigureTrend;
}

/** One icon per kind of figure, the same on every entity page. */
const CARD_ICON = {
  filings: FilesIcon,
  certified: SealCheckIcon,
  approval: CheckCircleIcon,
  wage: CurrencyDollarIcon,
  days: HourglassMediumIcon,
} as const;

/** The entity's headline figures, one plain row. The page places it, below its ReliabilityBand. */
export function EntityStatCards({ cards: given }: { cards: (StatCard | null)[] }) {
  const cards = given.filter((c): c is StatCard => c !== null);
  return (
    <FigureRow>
      {cards.map((d) => {
        const Icon = d.icon ? CARD_ICON[d.icon] : null;
        return (
          <Fragment key={d.k}>
            {" "}
            <Figure
              label={d.k}
              value={d.v}
              note={d.sub || undefined}
              icon={Icon ? <Icon weight="bold" className="text-primary-text" /> : undefined}
              trend={d.trend}
            />
          </Fragment>
        );
      })}
    </FigureRow>
  );
}

/**
 * How a count moved from one complete fiscal year to the next, as a chip:
 * "Up 127% in FY2025". A change in volume is neither good nor bad, so it
 * draws in the information colour. Null without two complete years, or when
 * the earlier year is too small for a share to mean anything (under 20).
 */
export function yearTrend(years: readonly { fy: number; certified: number; denied: number; withdrawn: number }[], partialFy: number | null): FigureTrend | undefined {
  const done = years.filter((y) => y.fy !== partialFy).sort((a, b) => a.fy - b.fy);
  const last = done[done.length - 1];
  const prev = done[done.length - 2];
  if (!last || !prev || prev.fy !== last.fy - 1) return undefined;
  const a = prev.certified + prev.denied + prev.withdrawn;
  const b = last.certified + last.denied + last.withdrawn;
  if (a < 20) return undefined;
  const pct = Math.round(((b - a) / a) * 100);
  if (Math.abs(pct) < 5) return { text: `About level in FY${last.fy}`, dir: "level", tone: "neutral" };
  return { text: `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% in FY${last.fy}`, dir: pct > 0 ? "up" : "down", tone: "info" };
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
    icon: "filings",
  };
}

export function certifiedCard(row: { certified: number; denied: number }): StatCard {
  return { k: "Certified", v: formatInt(row.certified), sub: `${formatInt(row.denied)} denied`, icon: "certified" };
}

/** The approval rate, or the reason it's withheld, beside the field's. */
export function approvalCard(reliability: RateReliability, baselineDenialPct: number): StatCard {
  const field = 100 - baselineDenialPct;
  if (reliability.ratePct == null) {
    return { k: "Approval", v: "Not shown", sub: `withheld: ${formatInt(reliability.decided)} decided`, icon: "approval" };
  }
  // Against the field's rate: within half a point is level, above is good, below is bad.
  const gap = reliability.ratePct - field;
  const fieldText = `${field.toFixed(1)}%`;
  const trend: FigureTrend =
    Math.abs(gap) < 0.5
      ? { text: `Level with the field's ${fieldText}`, dir: "level", tone: "neutral" }
      : { text: `${gap > 0 ? "Above" : "Below"} the field's ${fieldText}`, dir: gap > 0 ? "up" : "down", tone: gap > 0 ? "good" : "bad" };
  return {
    k: "Approval",
    v: `${reliability.ratePct.toFixed(1)}%`,
    sub: `of ${formatInt(reliability.decided)} decided`,
    icon: "approval",
    trend,
  };
}

/** The median offered wage, or no card at all: a tile reading "not on file" says nothing. */
export function medianWageCard(medianAnnualWage: number | null): StatCard | null {
  if (medianAnnualWage == null) return null;
  return {
    k: "Median wage",
    v: formatDollars(medianAnnualWage),
    sub: "offered, per year",
    icon: "wage",
  };
}

/** Median days to decision, against the field's when the sample can carry it. */
export function medianDaysCard(medianDays: number | null, standing: EntityStanding): StatCard {
  const { reliability, daysDelta, thinMedian, fieldDays } = standing;
  const card: StatCard = {
    k: "Median days",
    v: medianDays == null ? "—" : formatInt(Math.round(medianDays)),
    sub: thinMedian ? `middle of ${formatInt(reliability.decided)} decided` : "days, filing to decision",
    icon: "days",
  };
  if (thinMedian || daysDelta == null) return card;
  // Days against the field's median: within 5% of it is level; slower is bad, faster good.
  const d = Math.round(daysDelta);
  const base = fieldDays && fieldDays > 0 ? fieldDays : medianDays ?? 0;
  const level = d === 0 || (base > 0 && Math.abs(d) / base < 0.05);
  const field = fieldDays ? `the field's ${formatInt(Math.round(fieldDays))}` : "the field";
  card.trend = level
    ? { text: `Near ${field}`, dir: "level", tone: "neutral" }
    : { text: `${formatInt(Math.abs(d))} ${d > 0 ? "slower" : "faster"} than ${field}`, dir: d > 0 ? "up" : "down", tone: d > 0 ? "bad" : "good" };
  return card;
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
      className="mt-8"
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
        <Link href="/perm-wages" className="link">
          wages page
        </Link>
        .
      </>
    ),
  };
}

/**
 * Why the newest filings are missing here: DOL names the firm and the
 * occupation only when it publishes a case, while the live list carries the
 * employer from the day of filing.
 */
export function UnpublishedFilingsNote({ subject }: { subject: string }) {
  return (
    <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
      {`Filings newer than DOL's last published file can't be attributed to this ${subject} until DOL publishes them. The `}
      <Link href="/perm-cases#live" className="link">live list</Link>
      {" on the case search page carries them by employer."}
    </p>
  );
}
