import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The context modules the 16,210 entity detail pages are built out of.
 *
 * The subject's own numbers are three or four figures, and three or four
 * figures cannot fill a page. Everything else worth saying is CONTEXT: where
 * this entity sits against the field, who it sits beside, and what the numbers
 * refuse to answer. That is also what makes each page different from the
 * 16,209 others, because the context is drawn from the subject's own position
 * and nobody else's.
 *
 * TRUTH DISCIPLINE IS THE POINT OF THIS FILE. Most of these entities are tiny:
 * measured against the live table, 1,240 of the 12,240 employers have exactly
 * three filings, and 3,336 of the first 4,000 have a spotless record. Printing
 * "100% approval" for three cases is the single most misleading thing this
 * product could do, so `rateReliability` decides whether a rate may be shown
 * at all, and `ReliabilityBand` states the doubt ABOVE the figures rather than
 * under them: a number computed from thin input must never read as more
 * authoritative than the warning about it.
 */

/**
 * Decided cases required before an approval rate is published.
 *
 * Chosen from the data, not from taste. Three measurements set it:
 *
 *  1. The field's own denial rate is 2.57% (`permDisclosure` risk baseline
 *     over 248,158 decided cases). At that rate an entity with 29 decided
 *     cases records a spotless file 47% of the time by chance alone
 *     (0.9743^29). Below thirty, "no denials" is the coin landing heads.
 *  2. It is also the modal outcome, so the figure carries no information:
 *     3,336 of the first 4,000 employers have zero denials.
 *  3. Thirty is where the 95% Wilson upper bound on a clean record's denial
 *     rate first falls into single figures (11.4%). It is not where the rate
 *     becomes trustworthy - that takes about 146 decided cases, which only
 *     255 of 12,240 employers reach - it is where the number stops being
 *     pure noise and starts being worth printing with a caveat.
 *
 * The same bar defines the comparison cohort in `permEntities.fieldDistribution`,
 * and the page passes this constant in as that query's argument so the two
 * cannot drift apart.
 */
export const MIN_DECIDED_FOR_RATE = 30;

/**
 * Decided cases required before a median is presented without a caveat.
 *
 * A median over four cases is two numbers, and one over three is the middle
 * one. Lower than the rate bar on purpose: a median is not pinned against a
 * boundary the way a near-100% rate is, so it degrades rather than inverting.
 */
export const MIN_DECIDED_FOR_MEDIAN = 10;

/** 95th-percentile two-sided z. */
const Z = 1.959963984540054;

/**
 * The 95% Wilson upper bound on a proportion, as a percentage.
 *
 * Wilson rather than the textbook normal interval because the counts here sit
 * hard against zero, where the normal interval returns a negative lower bound
 * and an upper bound of exactly zero for a clean record - which would say a
 * three-case employer's denial rate is known to be 0%, the precise falsehood
 * this file exists to prevent.
 */
export function wilsonUpperPct(successes: number, n: number): number {
  if (n <= 0) return 100;
  const p = successes / n;
  const denom = 1 + (Z * Z) / n;
  const centre = (p + (Z * Z) / (2 * n)) / denom;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / denom;
  return Math.min(100, (centre + half) * 100);
}

/**
 * How many decided cases it takes before a spotless record can be told apart
 * from the field baseline at 95%.
 *
 * Solved rather than tabulated, so it stays true when DOL's baseline moves:
 * for zero denials the Wilson upper bound collapses to z^2 / (n + z^2), and
 * the answer is the n at which that drops below the baseline.
 */
export function separationN(baselineDenialPct: number): number {
  if (baselineDenialPct <= 0) return Infinity;
  return Math.ceil((Z * Z) / (baselineDenialPct / 100) - Z * Z);
}

export type RateTier = "withheld" | "soft" | "firm";

export interface RateReliability {
  /** Certified plus denied. Withdrawals are in neither. */
  decided: number;
  /** The approval percentage, or null when the count is too thin to publish. */
  ratePct: number | null;
  tier: RateTier;
  /** 95% Wilson upper bound on this entity's DENIAL rate, in percent. */
  upperDenialPct: number;
  /** Decided cases needed before a clean record separates from the field. */
  needed: number;
}

/**
 * Whether this entity's approval rate may be published, and how loudly.
 *
 * Three tiers, because two would force a false choice. "Withheld" is a count
 * too small for any rate. "Soft" is a rate whose confidence interval still
 * covers the field baseline, which is most of the entities that clear the bar.
 * "Firm" is a rate that genuinely differs from the field.
 */
export function rateReliability(
  certified: number,
  denied: number,
  baselineDenialPct: number,
): RateReliability {
  const decided = certified + denied;
  const needed = separationN(baselineDenialPct);
  if (decided < MIN_DECIDED_FOR_RATE) {
    return { decided, ratePct: null, tier: "withheld", upperDenialPct: 100, needed };
  }
  const upperDenialPct = wilsonUpperPct(denied, decided);
  const lowerDenialPct = 100 - wilsonUpperPct(certified, decided);
  // "Soft" whenever the interval still straddles the field's own rate: the
  // entity cannot be said to differ from it in either direction.
  const straddles = lowerDenialPct <= baselineDenialPct && upperDenialPct >= baselineDenialPct;
  return {
    decided,
    ratePct: (certified / decided) * 100,
    tier: straddles ? "soft" : "firm",
    upperDenialPct,
    needed,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** What Google shows before it truncates, in characters. */
export const TITLE_LIMIT = 60;
/** `title.template` in `src/app/layout.tsx`. Changing that must change this. */
export const TITLE_SUFFIX = " | PERM Tracker";

export interface EntityTitle {
  title: string;
  /** True when the brand template must be dropped to keep the title short. */
  absolute: boolean;
}

/**
 * The longest title that still fits in what Google shows.
 *
 * The old rule read `title.length > 60 ? absolute : title`, which measures the
 * BASE and not what Next renders. The template adds 15 characters, so a
 * 59-character base sailed under the test and came out at 74. Measured over
 * every real name: 15.0% of employer titles and 11.8% of firm titles rendered
 * past 60, with a maximum of 93.
 *
 * The fix is a priority list rather than a threshold, because there are two
 * things to drop and they are not equally valuable. The brand suffix goes
 * first - a reader who is looking at our result already knows whose it is -
 * and the qualifier ("PERM Filings") goes second. DOL's printed name is never
 * cut: it is the phrase people search, and it is the page's stated contract.
 *
 * Same rule, three kinds, one copy. `qualifiers` is longest first. Measured
 * after, over every real name: employers max 80, 29 of 12,240 still over;
 * firms max 80, 6 of 3,208; occupations max 80, 61 of 762. Every one of those
 * residuals is a NAME that exceeds 60 characters by itself, so the only way
 * to satisfy the limit would be to cut it.
 */
export function entityTitle(name: string, qualifiers: string[]): EntityTitle {
  const withQualifier = qualifiers.map((q) => `${name} ${q}`);
  for (const base of withQualifier) {
    if (base.length + TITLE_SUFFIX.length <= TITLE_LIMIT) {
      return { title: base, absolute: false };
    }
  }
  for (const base of withQualifier) {
    if (base.length <= TITLE_LIMIT) return { title: base, absolute: true };
  }
  return { title: name, absolute: true };
}

/**
 * The warning band, rendered ABOVE the figures it qualifies.
 *
 * Measured, because the doctrine is to measure rather than eyeball: this sits
 * on `bg-card`, where `--data-warn-ink` is 4.81:1 in light and 10.43:1 in
 * dark. Do NOT move it onto `bg-tint-primary`, which is the one surface it
 * fails on - the tint drops it to 4.38:1 in light, under the floor.
 *
 * Position is not decoration. A caveat printed under a number reads as a
 * footnote to a fact; printed over it, the doubt is the first thing read and
 * the number arrives already qualified. This project's standing doctrine, and
 * the reason the deadline calculator's warnings sit where they do.
 */
export function ReliabilityBand({
  reliability,
  baselineDenialPct,
  unit,
  subject,
  className,
}: {
  reliability: RateReliability;
  baselineDenialPct: number;
  /** What one row is: "filings", "cases". */
  unit: string;
  /** What the page is about: "sponsor", "firm", "occupation". */
  subject: string;
  className?: string;
}) {
  const { decided, tier, upperDenialPct, needed } = reliability;
  if (tier === "firm") return null;

  const withheld = tier === "withheld";
  return (
    <section
      className={cn(
        "border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6",
        withheld ? "border-l-8 border-l-data-warn" : "border-l-8 border-l-data-none",
        className,
      )}
      aria-label="How far these numbers can be read"
    >
      <p
        className={cn(
          "font-mono text-xs font-bold uppercase tracking-[0.14em]",
          withheld ? "text-data-warn-ink" : "text-foreground/60",
        )}
      >
        {withheld ? "Too few cases for a rate" : "This rate is level with the field"}
      </p>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        {withheld ? (
          <>
            {fmt(decided)} decided {decided === 1 ? unit.replace(/s$/, "") : unit}, so
            there&apos;s no approval rate here. Across every PERM case DOL decided
            in this window, {baselineDenialPct.toFixed(2)}% were denied. At that
            rate a file this size comes back clean most of the time whatever the{" "}
            {subject} did, so a percentage would be a fact about how few cases
            there are. Telling a clean record apart from the field takes about{" "}
            {fmt(needed)} decided cases.
          </>
        ) : (
          <>
            Computed over {fmt(decided)} decided {unit}. The 95% interval runs up
            to a {upperDenialPct.toFixed(1)}% denial rate, which still covers
            the {baselineDenialPct.toFixed(2)}% the field as a whole records, so
            this record can&apos;t be told apart from the field in either
            direction. Reading it as better or worse than average is reading
            the sample size.
          </>
        )}
      </p>
    </section>
  );
}

export interface PeerEntity {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
  state: string | null;
}

/**
 * Comparable entities, as real links.
 *
 * The highest-value module on these pages and the one that stops them being
 * 16,210 orphans: a visitor who reached one sponsor almost always wants the
 * next one along. Peers are chosen by rank, and rank is assigned by volume, so
 * the nearest ranks are the entities filing at a similar rate.
 */
export function PeerList({
  heading,
  note,
  items,
  hrefBase,
  unit,
  className,
}: {
  heading: string;
  note: ReactNode;
  items: PeerEntity[];
  /** e.g. "/perm-employers". */
  hrefBase: string;
  unit: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={cn("", className)}>
      <h2 className="font-heading text-2xl font-black">{heading}</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">{note}</p>{" "}
      <ul className="mt-5 grid list-none grid-cols-1 gap-4 p-0 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          // React renders array items with nothing between them, so the
          // separator has to be part of each iteration or every card's text
          // glues to the next one for anything walking the DOM.
          <Fragment key={p.slug}>
            {" "}
            <li className="min-w-0">
              <Link
                href={`${hrefBase}/${p.slug}`}
                className="flex h-full min-h-[44px] flex-col border-2 border-border bg-card p-4 no-underline shadow-hard-sm transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/60">
                  #{fmt(p.rank)}
                  {p.state ? ` · ${p.state}` : ""}
                </span>{" "}
                <span className="mt-1 text-base font-bold leading-snug">{p.name}</span>{" "}
                <span className="mt-2 font-mono text-xs tabular-nums text-foreground/70">
                  {fmt(p.total)} {unit}
                  {p.denied > 0 ? ` · ${fmt(p.denied)} denied` : " · none denied"}
                </span>
              </Link>
            </li>
          </Fragment>
        ))}
      </ul>
    </section>
  );
}

/**
 * The entities immediately above and below in the ranking.
 *
 * Cheap, exactly true, and different on every one of the 16,210 pages. It also
 * gives the ranking a direction: a number like "#4,112" means nothing without
 * knowing what sits on either side of it.
 */
export function RankLadder({
  rank,
  kindTotal,
  above,
  below,
  hrefBase,
  unit,
  className,
}: {
  rank: number;
  kindTotal: number;
  above: PeerEntity | null;
  below: PeerEntity | null;
  hrefBase: string;
  unit: string;
  className?: string;
}) {
  if (!above && !below) return null;
  // Stated as counts, not as a percentile, and that is a correctness fix
  // rather than a style choice. Rank is assigned by volume with ties broken
  // arbitrarily, and 1,240 employers are tied on exactly three filings, so
  // "more filings than 2% of them" is false for every one of them. What rank
  // DOES guarantee is the direction of the comparison: everything above filed
  // at least as many, everything below filed no more. That holds through any
  // number of ties.
  const above_ = Math.max(0, rank - 1);
  const below_ = Math.max(0, kindTotal - rank);
  const rows: Array<{ label: string; item: PeerEntity }> = [];
  if (above) rows.push({ label: "Just above", item: above });
  if (below) rows.push({ label: "Just below", item: below });

  return (
    <section className={cn("border-2 border-border bg-card p-6 shadow-hard-sm", className)}>
      <h2 className="font-heading text-lg font-black">Where this sits in the ranking</h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-foreground/70">
        Ranked {fmt(rank)} of {fmt(kindTotal)} by volume: {fmt(above_)} filed at
        least as many {unit}, and {fmt(below_)} filed no more.
      </p>{" "}
      <dl className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
        {rows.map((r) => (
          <Fragment key={r.label}>
            {" "}
            <div className="min-w-0">
              <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/60">
                {r.label}
              </dt>{" "}
              <dd className="mt-1 min-w-0">
                <Link
                  href={`${hrefBase}/${r.item.slug}`}
                  className="inline-flex min-h-[44px] items-center text-base font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {r.item.name}
                </Link>{" "}
                <span className="block font-mono text-xs tabular-nums text-foreground/70">
                  {fmt(r.item.total)} {unit}
                </span>
              </dd>
            </div>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

/**
 * What the numbers on this page do not say.
 *
 * Every page names its own limits, in its own terms. This is not a disclaimer
 * bolted on for cover: the entity identity problem is real and measurable
 * (Fragomen is printed under six spellings and ranks at 1, 9, 23, 31, 50 and
 * 57), and a reader who does not know it will read six mid-sized practices
 * where there is one large one.
 */
export function LimitsPanel({
  items,
  className,
}: {
  items: Array<{ head: string; body: ReactNode }>;
  className?: string;
}) {
  return (
    <section
      className={cn("border-2 border-border bg-tint-primary p-6 shadow-hard-sm sm:p-8", className)}
    >
      <h2 className="font-heading text-xl font-black">What these numbers don&apos;t say</h2>{" "}
      <dl className="mt-4 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-2">
        {items.map((i) => (
          <Fragment key={i.head}>
            {" "}
            <div className="min-w-0">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
                {i.head}
              </dt>{" "}
              <dd className="mt-1.5 text-base leading-relaxed text-foreground/80">{i.body}</dd>
            </div>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

/**
 * Which DOL files these figures came out of, and where the method is written.
 *
 * Every page states its own window. A figure whose vintage is not on the page
 * is a figure a reader has to take on trust, and this product's whole claim is
 * that they do not have to.
 */
export function DisclosureNote({
  sourceFiles,
  uniqueCases,
  className,
}: {
  sourceFiles: string[];
  uniqueCases: number | null;
  className?: string;
}) {
  const files = sourceFiles
    .map((f) => f.replace(/^PERM_Disclosure_Data_/, "").replace(/\.xlsx$/, "").replace(/_/g, " "))
    .join(" and ");
  return (
    <section
      className={cn("border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6", className)}
    >
      <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-foreground/60">
        The window these figures cover
      </p>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        {files
          ? `DOL's ${files} PERM disclosure files`
          : "DOL's PERM disclosure files"}
        , unioned and de-duplicated by case number
        {uniqueCases ? `: ${fmt(uniqueCases)} cases` : ""}. Every case in them
        carries a decision, so nothing here counts what’s still pending. How
        each figure is built, and what it can and can&apos;t answer, is set out in
        the{" "}
        <Link
          href="/methodology"
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          methodology
        </Link>
        .
      </p>
    </section>
  );
}

/**
 * What a detail page shows when its query came back with nothing.
 *
 * The deploy-skew window is real: a frontend deployed ahead of its backend, or
 * an ISR revalidation landing mid-ingest, returns an empty payload for a page
 * that is otherwise fine. Rendering a page of dashes reads as "this entity has
 * no record", which is a different and false claim.
 */
export function EntityDataGap({
  what,
  backHref,
  backLabel,
}: {
  what: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="border-2 border-border bg-card p-6 shadow-hard-sm sm:p-8">
      <h2 className="font-heading text-xl font-black">The figures didn’t load</h2>{" "}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
        {what} is in DOL&apos;s disclosure files, but this page couldn’t read
        the current figures. That’s usually a few minutes around a data
        refresh rather than anything missing. Reload, or start from{" "}
        <Link
          href={backHref}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          {backLabel}
        </Link>
        . The source files are on{" "}
        <a
          href="https://www.dol.gov/agencies/eta/foreign-labor/performance"
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          rel="noopener noreferrer"
        >
          DOL&apos;s own performance page
        </a>
        .
      </p>
    </section>
  );
}
