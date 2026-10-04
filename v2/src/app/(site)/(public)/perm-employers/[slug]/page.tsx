/**
 * One employer's PERM record.
 *
 * One of 12,240, and the hard part is that the subject's own record is four
 * figures long. Four figures cannot fill a page, and padding them with
 * boilerplate produces 12,240 pages that are 95% the same document, which is
 * the doorway pattern and is also just useless. So the page is built out of
 * CONTEXT instead: where this sponsor sits in the field, who sits beside it,
 * and what its numbers refuse to answer. All of that is drawn from this
 * sponsor's own position, so no two of the pages say the same thing.
 *
 * The rate is the dangerous figure. Most sponsors here are small - 1,240 of
 * them filed exactly three cases - and a spotless three-case record is the
 * field's most common outcome rather than an achievement. `rateReliability`
 * decides whether a percentage may appear at all, and the doubt is printed
 * above the figures, never beneath them.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { hasOwnPage } from "@/lib/entityPayload";
import { notFound } from "next/navigation";
import { firstThatFits } from "@/lib/describe";
import { formatDollars, formatInt } from "@/lib/format";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import {
  DisclosureNote,
  LimitsPanel,
  MIN_DECIDED_FOR_RATE,
  PeerList,
  RankLadder,
  ReliabilityBand,
  entityTitle,
  rateReliability,
} from "@/components/tools/EntityContext";
import {
  DecisionEstimatorCard,
  EntityStatCards,
  FieldPositionPlate,
  approvalCard,
  certifiedCard,
  entityStanding,
  medianDaysCard,
  medianWageCard,
  volumeCard,
  wageIsTheJobLimit,
} from "@/components/entities/EntityPageParts";
import {
  FALLBACK_BASELINE_DENIAL_PCT,
  entityJsonLd,
  entityMetadata,
  entityStaticParams,
} from "@/lib/entityPage";
import { employerHistoryCases, employerYears, workerFacets } from "@/lib/turso/employerHistory";
import { getDisclosureStats, getFreshness } from "@/lib/turso/publicData";
import { LiveQueueBand } from "@/components/entities/LiveQueueBand";
import { EmployerWait } from "@/components/entities/EmployerWait";
import { getEmployerWait, getFieldWait, getFiledTodayEstimate } from "@/lib/turso/employerWait";
import { similarSponsors } from "@/lib/turso/similarSponsors";
import { NameSpellings } from "@/components/entities/NameSpellings";
import { SizeBandNote } from "@/components/entities/SizeBandNote";
import { EmployerYears } from "@/components/entities/EmployerYears";
import { WorkerMix } from "@/components/entities/WorkerMix";
import { CityMix, IndustryMix, OccupationMix, PartyMix, StateMix } from "@/components/entities/FilingMakeup";
import {
  absorbedCount,
  entityFacets,
  entityPending,
  nameVariants,
  resolveEntity,
  sizeBand,
} from "@/lib/turso/entityDetail";
import { recentLiveByEmployer } from "@/lib/turso/cases";
import { searchPwdCases, searchPwdDeterminations } from "@/lib/turso/pwdCases";
import { searchLcaCases, searchLcaDisclosed } from "@/lib/turso/lcaCases";
import { searchSeasonalCases } from "@/lib/turso/seasonalCases";
import { SeasonalFilings } from "@/components/entities/SeasonalFilings";
import { getLcaProfile } from "@/lib/turso/lcaProfile";
import { LcaProfile } from "@/components/entities/LcaProfile";
import { getUscisH1bRecord } from "@/lib/turso/uscisH1b";
import { UscisH1bRecord } from "@/components/entities/UscisH1bRecord";
import { getEmployerLottery } from "@/lib/turso/h1bLotteryFoia";
import { H1bLotteryHistory } from "@/components/entities/H1bLotteryHistory";
import { CapExemptNote } from "@/components/entities/CapExemptNote";
import { unifiedRows } from "@/lib/flagMerge";
import { formatWage } from "@/lib/wageFormat";
import { liveEmployerRecord } from "@/lib/turso/liveEmployers";
import { getEmployerPrograms } from "@/lib/turso/employerPrograms";
import { getEmployerStages } from "@/lib/turso/employerStages";
import { EmployerPrograms } from "@/components/entities/EmployerPrograms";
import { EmployerFollow } from "@/components/employers/EmployerFollow";
import { employerMoves } from "@/lib/employerStages";
import { DebarmentNotice } from "@/components/entities/DebarmentNotice";
import { debarmentsForSlug } from "@/lib/turso/debarments";
import { warnForSlug } from "@/lib/turso/warn";
import { WarnNoticeBand } from "@/components/entities/WarnNotice";
import { UnpublishedEmployer } from "@/components/entities/UnpublishedEmployer";
import { SeasonalEmployer } from "@/components/entities/SeasonalEmployer";
import {
  seasonalEmployerCases,
  seasonalEmployerFigures,
  seasonalEmployerRecord,
} from "@/lib/turso/seasonalEmployers";
import { seasonalVisas } from "@/lib/seasonalForms";
import { DataProvenance } from "@/components/data/DataProvenance";
import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { comparables, fieldDistribution } from "@/lib/turso/entities";

/**
 * THIRTY DAYS, AND THE REASON IS THE SOURCE'S CADENCE.
 *
 * These pages render the QUARTERLY disclosure corpus, and only the busiest
 * are prerendered, so every other one regenerates on its first request after
 * its window expires. A short window means tens of thousands of cold server
 * renders a day, each a React SSR pass plus database reads, almost all of
 * them pages nobody opens and every one triggered by a crawler, to reflect
 * data that changes FOUR TIMES A YEAR. The live band on a tail page moving a
 * few weeks late is invisible, and a quarter that must show sooner belongs to
 * on-demand revalidation, not to a timer.
 */
/** Newest live filings shown on the page; the case search holds the rest. */
const RECENT_LIVE_SHOWN = 8;

export const revalidate = 2592000;

const KIND = "employer" as const;
const BASE = "/perm-employers";

interface Subject {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
}

/**
 * The subject, or `null` when this slug names nothing.
 *
 * A read that FAILS is deliberately not a third outcome any more. It used
 * to become an "unavailable" state that rendered an empty page with a 200,
 * which is the exact shape that let a disabled backend look like a quiet
 * page and pass every status check. It throws now, and Next's error
 * boundary decides what the reader sees.
 */
async function loadSubject(
  slug: string,
): Promise<{ subject: Subject; canonicalSlug: string } | null> {
  const found = await resolveEntity(KIND, slug);
  if (!found) return null;
  const { row, canonicalSlug } = found;
  return { canonicalSlug, subject: {
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    total: row.total,
    certified: row.certified,
    denied: row.denied,
    medianDays: row.medianDays,
    medianAnnualWage: row.medianAnnualWage,
  } };
}

/**
 * How many individual cases a live-only page lists.
 *
 * The list IS the page - there are no statistics to fill it out with - so the
 * cap is generous. It is also a real cap: 5 of these employers hold more than
 * 100 cases, and an unbounded list would put a thousand rows in the RSC
 * payload of a page nobody is meant to index.
 */
const LIVE_ONLY_CASE_LIMIT = 50;

/** How many filings a seasonal-only page lists; the rest are a link to the case search. */
const SEASONAL_CASE_LIMIT = 25;

/**
 * The reduced page's data, or null when this slug names nothing anywhere.
 *
 * Reached ONLY after `resolveEntity` has missed, so it never runs for an
 * employer that has a published record. Deliberately NOT wrapped in a catch:
 * a Turso failure would already have thrown out of `resolveEntity` on the
 * same client a moment earlier, so swallowing here could not rescue an
 * outage - it could only turn a real employer into a 404.
 */
async function loadLiveOnly(slug: string) {
  const record = await liveEmployerRecord(slug);
  if (!record) return null;
  const cases = await recentLiveByEmployer(slug, LIVE_ONLY_CASE_LIMIT);
  return { record, cases };
}

export async function generateStaticParams() {
  return entityStaticParams(KIND);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadSubject(slug);
  // A miss is decided at the earliest point, and the segment has NO loading
  // boundary above it - both halves matter. Measured on the wire: with the
  // old (public)/loading.tsx in place, Next streamed a 200 before ANY page
  // code ran, and notFound() thrown anywhere (metadata included) could swap
  // the UI but never the status - junk slugs answered 200, a soft 404 and a
  // cold render per crawler guess. With the boundary gone the response waits
  // for this decision and a miss is a real 404.
  //
  // A miss in the PUBLISHED corpus is no longer the end of it. The live feed
  // knows 21,495 employers the disclosure files have never named, and those
  // get a reduced page - see loadLiveOnly. A slug in NEITHER is still a real
  // 404, decided here, before the first byte.
  if (!found) {
    const record = await liveEmployerRecord(slug);
    if (!record) {
      // Third and last: an employer whose only filings are H-2A, H-2B or CW-1
      // (seasonal_employer_index, built nightly). Indexable, and listed in the
      // sitemap, by the owner's decision (Oct 3 2026).
      const seasonal = await seasonalEmployerRecord(slug);
      if (!seasonal) notFound();
      const visas = seasonalVisas(seasonal);
      const { title, absolute } = entityTitle(seasonal.name, [
        `${visas} Filings: ${formatInt(seasonal.cases)}`,
        `${visas} Filings`,
      ]);
      const noun = seasonal.cases === 1 ? "filing" : "filings";
      const stem = `${seasonal.name}: ${formatInt(seasonal.cases)} ${visas} ${noun}`;
      const description = firstThatFits([
        `${stem}, with DOL's status on each, the workers certified and the wage offered, from DOL's own records.`,
        `${stem}, with DOL's status, workers and wage.`,
        `${stem}.`,
        `${seasonal.name.slice(0, 120)}: ${visas} ${noun}.`,
      ]);
      return entityMetadata({ title, absolute, description, path: `${BASE}/${slug}` });
    }
    // INDEXABLE, BY THE SITE OWNER'S DECISION, with the cost stated. Most
    // live-only employers hold exactly one case, so the page is a heading and
    // one row, and tens of thousands of those is the thin-content shape
    // Google's policy names. Google already declines much of the published
    // tail, so the realistic outcome is a larger "discovered, not indexed"
    // figure rather than a larger index, and no penalty either way. The
    // sitemap lists these
    // from `perm_live_only_index`, rebuilt nightly with the live remainder,
    // so the page and the sitemap read one source and cannot disagree.
    // Same title rule as the published pages: DOL's printed name is never
    // cut, the brand suffix goes first and the qualifier second. A legal
    // entity name can run past what Google shows on its own, and these names
    // are the least curated in the corpus - they come straight off the
    // application with no merge pass behind them.
    const { title, absolute } = entityTitle(record.name, [
      // SINGULAR WHEN THERE IS ONE, and there usually is: about four in
      // five live-only employers hold exactly one case, so "1 Live Cases"
      // would be the title on most of this family.
      `PERM Filings: ${formatInt(record.cases)} Live Case${record.cases === 1 ? "" : "s"}`,
      "PERM Filings",
    ]);
    // No rate, no median, no rank - not even as a phrase. A snippet is where
    // a caveat cannot follow a number, so the description states only what
    // the page states: a count, and the absence of everything else.
    //
    // A PRIORITY LIST, NOT A THRESHOLD, for the same reason entityTitle uses
    // one: anything past ~155 characters is cut mid-sentence in a SERP, and
    // these names are the least curated in the corpus - straight off the
    // application, no merge pass behind them - so the longest of them will
    // blow any single template. The clauses drop in order of what a reader
    // loses least by not seeing.
    const noun = record.cases === 1 ? "case" : "cases";
    const stem = `${record.name}: ${formatInt(record.cases)} PERM ${noun} in DOL's live record`;
    const description =
      [
        `${stem}, none in a published disclosure file yet, so no outcome figures exist for them.`,
        `${stem}, none in a published disclosure file yet.`,
        `${stem}.`,
        // Every clause gone and the NAME alone is still too long. Cutting the
        // name is the last resort because it is the phrase people search.
        `${record.name.slice(0, 140)}: PERM cases in DOL's live record.`,
      ].find((d) => d.length <= 155) ?? "PERM cases in DOL's live record.";
    // The same metadata the published branch builds: without its own Open
    // Graph block the page inherits the root layout's, and a share of it
    // renders as the homepage card.
    return entityMetadata({ title, absolute, description, path: `${BASE}/${slug}` });
  }
  const row = found.subject;
  const reliability = rateReliability(
    row.certified,
    row.denied,
    FALLBACK_BASELINE_DENIAL_PCT,
  );
  // THE COUNT, NOT THE RATE. A specific number in the title is the difference
  // between a generic label and a result someone recognises as the page they
  // wanted in the SERP. But only the count is safe to put here: these pages
  // WITHHOLD the
  // approval rate whenever the sample is too small to support one, and a title
  // has nowhere to carry that caveat - a snippet claiming a perfect rate over
  // three cases is exactly the claim the whole ReliabilityBand exists to
  // prevent. Every entity has a truthful filing count.
  //
  // (This comment deliberately does NOT spell the percent-approved phrase.
  // EntityContext.test.tsx greps each page for it and then demands the
  // ratePct guard beside it; the first draft of this note tripped that gate on
  // the wages page, which publishes a wage and no rate at all.)
  //
  // entityTitle takes the first qualifier that fits under the 62-char limit and
  // falls back through the rest, so a long name simply keeps the short form.
  const { title, absolute } = entityTitle(row.name, [
    `PERM Filings: ${formatInt(row.total)} Cases`,
    "PERM Filings",
  ]);
  // The rate is left out of the description whenever the page itself is
  // withholding it. A SERP snippet reading "100.0% approved" over three cases
  // is the same claim the page refuses to make, made somewhere nobody can see
  // the warning next to it.
  const ratePart =
    reliability.ratePct != null ? `, ${reliability.ratePct.toFixed(1)}% approved` : "";
  // Measured over all 12,240: with the source clause always attached, exactly
  // one name (Verizon's 68-character legal entity) pushed the description to
  // 159 and got cut mid-sentence in the SERP. Dropping the clause when the
  // head runs long caps it at 126. Same trick the occupation page uses.
  //
  // A PRIORITY LIST, like the live-only branch: the longest that fits 155
  // wins. A two-way choice leaves a small employer at about 90 characters
  // ("Name: 3 PERM filings, ranked 40,123 by volume, from DOL's own
  // disclosure files."), most employer pages under 110, a snippet with
  // room for the page's own wage and
  // what the page holds. Only facts the page itself prints go in.
  const filings = `${formatInt(row.total)} PERM filing${row.total === 1 ? "" : "s"}`;
  const head = `${row.name}: ${filings}${ratePart}, ranked ${formatInt(row.rank)} by volume`;
  const wage =
    row.medianAnnualWage != null && row.medianAnnualWage > 0
      ? `, median offered wage ${formatDollars(row.medianAnnualWage)}`
      : "";
  const description = firstThatFits([
    `${head}${wage}. Jobs, wages and case status, from DOL's own records.`,
    `${head}${wage}, from DOL's own disclosure files.`,
    `${head}, from DOL's own disclosure files.`,
    `${head}.`,
  ]);
  // A legal entity name can run past what Google shows on its own
  // ("VERIZON COMMUNICATIONS INC AND ALL ITS SUBSIDIARIES AND AFFILIATES"),
  // so `entityTitle` drops the brand suffix, then the qualifier, rather than
  // crowding out the name. It measures the RENDERED length.
  return entityMetadata({
    title,
    absolute,
    description,
    path: `${BASE}/${found.canonicalSlug}`,
    noindex: !hasOwnPage(row),
  });
}

export default async function EmployerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await loadSubject(slug);
  if (!found) {
    // No published record. The live feed may still know them - see the note
    // in generateMetadata. Everything below this point reads the disclosure
    // corpus and would produce zeros for these employers, which is why the
    // reduced page is a different component rather than this one with
    // sections switched off.
    const live = await loadLiveOnly(slug);
    if (!live) {
      const seasonal = await seasonalEmployerRecord(slug);
      if (!seasonal) notFound();
      const [figures, list, fresh] = await Promise.all([
        seasonalEmployerFigures(slug),
        seasonalEmployerCases(slug, SEASONAL_CASE_LIMIT),
        getFreshness(),
      ]);
      // The breadcrumb bar ends at "Employers", so the trail ending in this
      // page's own name is emitted here, as the published page does.
      return (
        <>
          <JsonLdScript schema={breadcrumbSchema(`${BASE}/${slug}`, seasonal.name)} />
          <SeasonalEmployer
            record={seasonal}
            figures={figures}
            cases={list.cases}
            more={list.more}
            asOf={fresh["seasonal-status"]?.asOf ?? null}
          />
        </>
      );
    }
    const [fresh, liveStages, liveWait, fieldWait, filedToday, liveSeasonal] = await Promise.all([
      getFreshness(),
      getEmployerStages().catch(() => null),
      getEmployerWait(slug).catch(() => ({ n: 0, p25: null, p50: null, p75: null })),
      getFieldWait().catch(() => null),
      getFiledTodayEstimate().catch(() => null),
      searchSeasonalCases({ text: live.record.name, limit: 5 }).catch(() => []),
    ]);
    return (
      <>
        <JsonLdScript schema={breadcrumbSchema(`${BASE}/${slug}`, live.record.name)} />
        <UnpublishedEmployer
          record={live.record}
          cases={live.cases}
          seasonal={<SeasonalFilings name={live.record.name} rows={liveSeasonal} className="mt-8" />}
          asOf={fresh["perm-case-status"]?.asOf ?? null}
          follow={
            <EmployerFollow
              slug={slug}
              name={live.record.name}
              row={liveStages?.employers.find((e) => e.slug === slug) ?? null}
              moves={liveStages ? employerMoves(liveStages).filter((m) => m.slug === slug) : []}
              logFrom={liveStages?.logFrom ?? null}
              asOf={liveStages?.asOf ?? null}
              docMissing={!liveStages}
            />
          }
          wait={
            <EmployerWait
              name={live.record.name}
              mine={liveWait}
              field={fieldWait}
              today={filedToday}
              className="mt-8"
            />
          }
        />
      </>
    );
  }
  const row = found.subject;
  // Every read below keys on the SURVIVING slug, not the URL: a retired
  // spelling has no rows of its own in the facet or pending tables.
  const canonicalSlug = found.canonicalSlug;
  // Below the page threshold the page still RENDERS - an attorney searched a
  // two-case firm she knows, found it, and a result that 404s on click is
  // worse than absence. The doorway-page defense moved to metadata: sub-floor
  // pages are noindex (set in generateMetadata) and the sitemap omits them,
  // so crawlers are told exactly what these are while people get the page.

  // The three context reads run together. `fieldDistribution` takes the same
  // arguments on every page of this kind, and memoises on them, so all 16,305
  // sponsor pages share one cohort read rather than each re-reading 1,338 rows.
  const [stats, dist, near, pending, facets, variants, absorbed, freshness, recentLive, wageLive, lcaLive, wageDets, lcaDets, programs, stagesDoc, debarments, warn, empWait, fieldWait, filedToday, years, historyCases, workers, seasonalRows, lcaProfile, uscisH1b, lottery] =
    await Promise.all([
      getDisclosureStats(),
      fieldDistribution(KIND, MIN_DECIDED_FOR_RATE),
      comparables({
        kind: KIND,
        rank: row.rank,
        span: 60,
        limit: 6,
      }),
      entityPending(KIND, canonicalSlug),
      entityFacets(KIND, canonicalSlug),
      nameVariants(KIND, canonicalSlug),
      absorbedCount(KIND, canonicalSlug),
      getFreshness(),
      // Filings newer than the last disclosure file, from the live feed -
      // without it, a known case was invisible on its own sponsor's page until
      // DOL's quarterly publication. Indexed point
      // read over the small remainder table; degrades to an absent band.
      // One over what the box shows, so it can say more exist and link them.
      recentLiveByEmployer(canonicalSlug, RECENT_LIVE_SHOWN + 1).catch(() => []),
      // The steps BEFORE the PERM: the wage requests and H-1B LCAs this
      // employer has filed. Two halves each: the live table from DOL's daily
      // check (status, pending included) and DOL's quarterly file (decided,
      // with the wage). Matched by name prefix (those tables carry
      // name-derived slugs), indexed, five each; merged newest-first below.
      searchPwdCases({ text: row.name, limit: 5 }).catch(() => []),
      searchLcaCases({ text: row.name, limit: 5 }).catch(() => []),
      searchPwdDeterminations({ text: row.name, limit: 5 }).catch(() => []),
      searchLcaDisclosed({ text: row.name, limit: 5 }).catch(() => []),
      getEmployerPrograms(canonicalSlug).catch(() => null),
      getEmployerStages().catch(() => null),
      debarmentsForSlug(canonicalSlug).catch(() => []),
      warnForSlug(canonicalSlug).catch(() => []),
      getEmployerWait(canonicalSlug).catch(() => ({ n: 0, p25: null, p50: null, p75: null })),
      getFieldWait().catch(() => null),
      getFiledTodayEstimate().catch(() => null),
      // FY2008 onward, and the FY2020 to FY2023 cases: one PK read and one
      // indexed read (scripts/ingest_perm_history.py writes both tables).
      employerYears(canonicalSlug),
      employerHistoryCases(canonicalSlug, 25),
      workerFacets("employer", canonicalSlug),
      // H-2A and H-2B, live record only (no quarterly file is loaded): the
      // band shows only when the sponsor has any.
      searchSeasonalCases({ text: row.name, limit: 5 }).catch(() => []),
      // What the LCAs were for (new hires vs transfers, OES level, Section H),
      // over the same slug range as the program ledger.
      getLcaProfile(canonicalSlug).catch(() => null),
      // What USCIS then decided on the H-1B petitions (its Employer Data Hub).
      getUscisH1bRecord(canonicalSlug).catch(() => null),
      // Lottery registrations FY2021 to FY2024 (USCIS's FOIA release).
      getEmployerLottery(canonicalSlug).catch(() => null),
    ]);
  const wageReqs = unifiedRows(wageLive, wageDets, 5);
  const lcas = unifiedRows(lcaLive, lcaDets, 5);
  const band = await sizeBand(KIND, row.rank);
  const mirrorAsOf = freshness["perm-case-status"]?.asOf ?? null;
  const disclosedThrough = freshness["perm-cases"]?.asOf ?? null;
  const throughMonth = disclosedThrough
    ? new Date(`${disclosedThrough.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long", year: "numeric", timeZone: "UTC",
      })
    : null;

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;

  const schema = entityJsonLd({
    path: `${BASE}/${slug}`,
    name: row.name,
    dataset: {
      name: `${row.name} PERM labor certification filings`,
      description: `PERM filing record for ${row.name} from DOL disclosure data.`,
      variableMeasured: ["filings", "certified", "denied", "median days to decision"],
    },
    freshness,
  });

  const standing = entityStanding(row, dist, baselineDenialPct);
  const { reliability, thinMedian } = standing;
  // Each caveat leads with THIS sponsor's own figure. See the note on the
  // attorney page: 721 words of every entity page were byte-identical, and the
  // entity long tail is what GSC has discovered and never crawled.
  const topOcc = facets.occupation?.[0];
  const topState = facets.state?.[0];
  // Depends on the facets above, so it runs after them: one small indexed
  // read per occupation (two at most).
  const similar = await similarSponsors(canonicalSlug, facets.occupation ?? []).catch(() => ({
    occupation: null,
    sponsors: [],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <h1 translate="no" className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {formatInt(row.total)} PERM filings in DOL&apos;s current disclosure window,{" "}
          {formatInt(row.certified)} certified and {formatInt(row.denied)} denied. Name as
          DOL prints it, which is the legal entity on the form.
        </p>
      </header>

      {/* The doubt goes ABOVE the figures. A caveat under a number reads as a
          footnote to a fact; over it, the number arrives already qualified. */}
      <DebarmentNotice rows={debarments} pageName={row.name} today={new Date().toISOString().slice(0, 10)} />{" "}
      <WarnNoticeBand rows={warn} pageName={row.name} />{" "}
      <ReliabilityBand
        reliability={reliability}
        baselineDenialPct={baselineDenialPct}
        subject="sponsor"
        unit="filings"
        className="mt-8"
      />

      <section className="pop mt-8">
        <EntityStatCards
          cards={[
            volumeCard("Filings", row, kindTotal),
            certifiedCard(row),
            approvalCard(reliability, baselineDenialPct),
            medianWageCard(row.medianAnnualWage),
            medianDaysCard(row.medianDays, standing),
          ]}
        />
      </section>

      {/* The live queue, before the history. Every figure above this point
          comes from decided cases; this is the only module that can see a
          case that is still waiting, and it is the thing a reader with a
          case at this sponsor came for. */}
      {pending ? (
        <LiveQueueBand
          pending={pending}
          subject="sponsor"
          n="01"
          asOf={mirrorAsOf}
          className="mt-10"
        />
      ) : null}{" "}
      <EmployerWait name={row.name} mine={empWait} field={fieldWait} today={filedToday} className="mt-10" />{" "}
      <EmployerPrograms
        name={row.name}
        perm={
          programs
            ? { ...programs.perm, pending: pending ? pending.pending : programs.perm.pending }
            : {
                program: "perm",
                published: row.total,
                pending: pending ? pending.pending : null,
                medianAnnualWage: row.medianAnnualWage,
                wageN: row.certified + row.denied,
              }
        }
        pwd={programs?.pwd ?? null}
        lca={programs?.lca ?? null}
        seasonal={programs?.seasonal ?? null}
        stages={stagesDoc?.employers.find((e) => e.slug === canonicalSlug) ?? null}
        logFrom={stagesDoc?.logFrom ?? null}
        searchHref={`/case-search?q=${encodeURIComponent(row.name)}`}
        matchedPrefix={programs?.matchedPrefix ?? null}
      />{" "}
      <EmployerFollow
        slug={canonicalSlug}
        name={row.name}
        row={stagesDoc?.employers.find((e) => e.slug === canonicalSlug) ?? null}
        moves={stagesDoc ? employerMoves(stagesDoc).filter((m) => m.slug === canonicalSlug) : []}
        logFrom={stagesDoc?.logFrom ?? null}
        asOf={stagesDoc?.asOf ?? null}
        docMissing={!stagesDoc}
      />

      {/* The newest individual filings, live from DOL - visible here months
          before the disclosure files publish them. Firm and wage arrive
          with publication; until then the case number carries the reader
          to its own live status. */}
      {recentLive.length > 0 ? (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            Latest filings, live from DOL
          </h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Newer than DOL&apos;s published files, so the wage and law firm
            aren&apos;t known yet. Each case links to its live status.
          </p>{" "}
          <ul className="mt-4 divide-y divide-border/60">
            {/* Keyed Fragment + space: mapped siblings glue their text for
                every extractor. Third instance of this class tonight. */}
            {recentLive.slice(0, RECENT_LIVE_SHOWN).map((c) => (
              <Fragment key={c.caseNumber}>{" "}
              <li
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base"
              >
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                  className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {c.caseNumber}
                </Link>{" "}
                {c.jobTitle ? (
                  <span className="text-foreground/70">{c.jobTitle}</span>
                ) : null}{" "}
                <span className="ml-auto text-sm text-foreground/70">
                  {c.filingDate ? `filed ${c.filingDate}` : ""}
                  {c.status ? ` · ${c.status}` : ""}
                </span>
              </li>
              </Fragment>
            ))}
          </ul>{" "}
          <p className="mt-3 text-sm">
            {recentLive.length > RECENT_LIVE_SHOWN
              ? `The ${RECENT_LIVE_SHOWN} newest. `
              : ""}
            <Link
              href={`/case-search?q=${encodeURIComponent(row.name)}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              Every filing by this employer
            </Link>{" "}
            is in the case search, live and published together.
          </p>
        </section>
      ) : null}

      {/* The two filings that come BEFORE a PERM, from the same daily DOL
          check: the wage request and, for H-1B holders, the LCA. Five each,
          newest first; every number links to its live status. */}
      {wageReqs.length > 0 || lcas.length > 0 ? (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            Before the PERM: wage requests and LCAs
          </h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Filed by {row.name}. Pending ones are DOL&apos;s daily check; decided
            ones carry the wage from DOL&apos;s quarterly files.
          </p>{" "}
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 [&>*]:min-w-0">
            {[
              { label: "Wage requests", rows: wageReqs, href: `/pwd-cases?q=${encodeURIComponent(row.name)}` },
              { label: "H-1B LCAs", rows: lcas, href: `/lca-cases?q=${encodeURIComponent(row.name)}` },
            ].map((col) => (
              <Fragment key={col.label}>{" "}
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">
                  {col.label}
                </h3>{" "}
                {col.rows.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border/60">
                    {col.rows.map((r) => (
                      <Fragment key={r.caseNumber}>{" "}
                      <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base">
                        <Link
                          href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                          className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2"
                        >
                          {r.caseNumber}
                        </Link>{" "}
                        {r.jobTitle ? <span className="text-foreground/80">{r.jobTitle}</span> : null}{" "}
                        {formatWage(r.wage, r.wageUnit) ? (
                          <span className="font-mono text-sm font-bold">
                            {formatWage(r.wage, r.wageUnit)}
                            <YearlyPayNote wage={r.wage} unit={r.wageUnit} short />
                          </span>
                        ) : null}{" "}
                        <span className="ml-auto font-mono text-sm font-bold uppercase text-foreground/70">
                          {r.date ? `${r.date} · ` : ""}
                          {r.status}
                        </span>
                      </li>
                      </Fragment>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-foreground/70">None confirmed yet.</p>
                )}{" "}
                <p className="mt-2 text-sm">
                  <Link href={col.href} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                    All {col.label.toLowerCase()} by this employer
                  </Link>
                </p>
              </div>
              </Fragment>
            ))}
          </div>
        </section>
      ) : null}

      <CapExemptNote industry={facets.industry} />{" "}
      <LcaProfile name={row.name} profile={lcaProfile} />{" "}
      <UscisH1bRecord record={uscisH1b} through={freshness["uscis-h1b-hub"]?.asOf ?? null} />{" "}
      <H1bLotteryHistory years={lottery} />{" "}
      <SeasonalFilings name={row.name} rows={seasonalRows} />{" "}

      {/* Where does this sponsor sit in the field? A stat card states a
          number; only the distribution says whether that number is unusual. The population is every sponsor whose
          case count can carry a rate, which is the only denominator these two
          measures can honestly be read against. */}
      <FieldPositionPlate
        n={pending ? "02" : "01"}
        singular="sponsor"
        plural="sponsors"
        dist={dist}
        standing={standing}
        medianDays={row.medianDays}
        lead={
          <>
            Each bar counts sponsors at that value. Sponsors with fewer than{" "}
            {dist.minDecided} decided cases are left out of the population
            rather than plotted, because a rate over a handful of cases lands
            wherever the handful landed.
          </>
        }
        outOfCohortNote={`This sponsor has ${formatInt(reliability.decided)} decided cases, so its median days is marked but left unranked, and no approval rate is drawn at all.`}
      />

      {facets.occupation || facets.state || facets.attorney || facets.city || facets.industry ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-black">
            What they file, and where
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base text-foreground/70">
            A rank says how much. It says nothing about what the work is, which
            is the part a job offer from this sponsor actually turns on.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            {facets.occupation ? (
              <OccupationMix
                rows={facets.occupation}
                total={row.total}
                className="lg:row-span-2"
              />
            ) : null}
            {facets.industry ? <IndustryMix rows={facets.industry} /> : null}
            {facets.state ? <StateMix rows={facets.state} total={row.total} /> : null}
            {facets.city ? <CityMix rows={facets.city} total={row.total} /> : null}
            {facets.attorney ? (
              <PartyMix
                rows={facets.attorney}
                total={row.total}
                title="Who files for them"
                note="The law firm named on the application."
                hrefBase="/perm-attorneys"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <EmployerYears
        years={years}
        cases={historyCases}
        lastYearPartial={throughMonth ? `DOL's newest file runs through ${throughMonth}` : undefined}
      />

      <WorkerMix facets={workers} subject="employer" />

      {band ? (
        <SizeBandNote
          band={band}
          subjectMedianDays={row.medianDays}
          subject="sponsors"
          unit="filings"
          className="mt-10"
        />
      ) : null}

      <RankLadder
        rank={row.rank}
        kindTotal={kindTotal}
        above={near.above}
        below={near.below}
        hrefBase={BASE}
        unit="filings"
        className="mt-10"
      />

      <PeerList
        heading="Sponsors filing at the same rate"
        note={
          <>
            Ranked either side of this one: they file about as many PERM cases.
          </>
        }
        items={near.peers}
        hrefBase={BASE}
        unit="filings"
        className="mt-12"
      />

      {similar.occupation && similar.sponsors.length > 0 ? (
        <PeerList
          heading="Sponsors hiring for the same work"
          note={
            <>
              The employers filing the most PERM cases for{" "}
              <Link
                href={`/perm-wages/${similar.occupation.slug}`}
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                {similar.occupation.label}
              </Link>
              , the occupation this sponsor files for most.
            </>
          }
          items={similar.sponsors}
          hrefBase={BASE}
          unit="filings"
          className="mt-12"
        />
      ) : null}

      <NameSpellings
        variants={variants}
        absorbed={absorbed}
        subject="sponsor"
        hrefBase={BASE}
        rank={row.rank}
        className="mt-12"
      />

      <LimitsPanel
        className="mt-12"
        items={[
          wageIsTheJobLimit({ topOccupation: topOcc, total: row.total, filers: "they" }),
          {
            head: "Volume doesn’t change the wait",
            body: (
              <>
                DOL works a single national queue, oldest first, whoever filed
                the case, so these {formatInt(row.total)} filings bought no priority:
                a company with four thousand waits exactly as long as one with
                three.
              </>
            ),
          },
          {
            head: "The name is a legal entity",
            body: (
              <>
                DOL prints whatever went on the form, and here that name ranks{" "}
                {formatInt(row.rank)}. A group that files
                through several subsidiaries appears as several rows, and one
                that files everything through a parent appears once, so a rank
                is a rank among printed names rather than among companies.
              </>
            ),
          },
          {
            head: `A median over ${formatInt(reliability.decided)} decided cases`,
            body: (
              <>
                {thinMedian
                  ? "That’s a middle of a handful, and it moves entirely with which months those few cases were filed in."
                  : "The queue is national and first in, first out, so this figure follows when the cases were filed as much as it follows the sponsor."}
              </>
            ),
          },
          {
            head: "Two sources, and they do not add up",
            body: (
              <>
                The filing counts come from DOL&apos;s disclosure files, where
                every row already carries a decision date, so nothing pending
                is in them. The queue figures come from a live per-case
                tracker with its own coverage and its own as-of date.
                Subtracting one from the other gives a number that means
                nothing.{topState ? ` The worksite on most of these is ${topState.label}.` : ""}{" "}
                Where the queue stands overall is on the{" "}
                <Link
                  href="/perm-processing-times"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  processing times page
                </Link>
                .
              </>
            ),
          },
        ]}
      />

      <DisclosureNote
        sourceFiles={stats?.sourceFiles ?? []}
        uniqueCases={stats?.uniqueCases ?? null}
        className="mt-8"
      />

      <section className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <DecisionEstimatorCard heading="Your case is with them?" />
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Comparing sponsors?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link
              href={BASE}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              full ranking
            </Link>{" "}
            sorts every column, and{" "}
            <Link
              href="/perm-wages"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              wages by occupation
            </Link>{" "}
            covers what the roles pay.
          </p>
        </div>
      </section>
      <DataProvenance
        datasets={
          pending
            ? ["perm-cases", "entities", "perm-case-status"]
            : ["perm-cases", "entities"]
        }
      />
    </div>
  );
}
