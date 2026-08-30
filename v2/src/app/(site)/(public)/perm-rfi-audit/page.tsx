/**
 * The review stages: RFI, holds, NORD, supervised recruitment, and appeals.
 *
 * WHY THIS PAGE EXISTS. These are the words DOL puts in front of an applicant
 * with no explanation attached, at the worst possible moment. "RFI ISSUED"
 * reads like a denial to someone who has been waiting a year, and the measured
 * answer is that most of them end in a certification. Nobody publishes a live
 * count of how many cases are at each of these stages, and we can, because the
 * mirror holds pending cases and DOL's own disclosure files do not.
 *
 * WHAT THE PAGE REFUSES TO DO, in one place so it is checkable:
 *   - No probability that a given case gets an RFI. Rates for a group are not
 *     a forecast for a member of it, and the page says so where the rates are.
 *   - No blended risk score. `/perm-denial-risk` already argues this: the
 *     factors are not independent and one letter grade reads as precision the
 *     data cannot support.
 *   - No prediction of when an individual RFI resolves. The 33-day median is
 *     a population figure and is labelled as one.
 *   - No audit RATE. `rfi_funnel.ever_audit` reads 0 and that is a missing
 *     measurement, not a finding. DOL's own processing-times page publishes a
 *     live Audit Review queue, which is the evidence that the 0 is wrong.
 *   - No trend in the stage counts. One observation per case cannot see a
 *     transition, so there is no honest series to draw.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataView } from "@/components/tools/DataView";
import { InsightLede } from "@/components/tools/Insight";
import { OccupationRates } from "@/components/rfi/OccupationRates";
import { RfiOutcomes } from "@/components/rfi/RfiOutcomes";
import { StageCensus, CensusLinks } from "@/components/rfi/StageCensus";
import {
  StageCohortsChart,
  StageCohortsTable,
} from "@/components/rfi/StageCohorts";
import { StageGlossary } from "@/components/rfi/StageGlossary";
import { StageLadder, StageLadderTable } from "@/components/rfi/StageLadder";
import { isReviewStage, reviewStages, stageMeta } from "@/components/rfi/stageMeta";
import { openGraphBase } from "@/lib/openGraphBase";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import type { ReviewStage } from "@/lib/turso/rfi";
import {
  SMALL_STAGE_MAX,
  getReviewStages,
  getBlendedRfiFunnel,
  getRfiOccupations,
  getSmallStageRecords,
  getStageCohorts,
} from "@/lib/turso/rfi";

const TITLE = "PERM RFI, Audits and Appeals";
// 148 characters unescaped. Measure the UNESCAPED text: house style is
// contraction-heavy and every apostrophe is six characters as an entity, so
// reading the rendered attribute reports a false over-length.
const DESCRIPTION =
  "What an RFI, NORD, audit or BALCA appeal means, how many PERM cases sit at each stage right now, and what the data shows happens after an RFI.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-rfi-audit" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-rfi-audit",
  },
};

// The mirror refreshes daily and the census query is a full pass over 412,865
// rows. A day bounds staleness at the data's own cadence and keeps the read
// off the request path.
export const revalidate = 86400;

export default async function PermRfiAuditPage() {
  const [stages, funnel, cohortsRaw, occupations, smallRecords, dol] =
    await Promise.all([
      getReviewStages(),
      getBlendedRfiFunnel(),
      getStageCohorts(REVIEW_STATUSES),
      getRfiOccupations(),
      getSmallStageRecords(),
      getProcessingTimes().catch(() => null),
    ]);

  const pending = stages.reduce((n, s) => n + s.cases, 0);
  // The glossary explained each stage and printed no number, while this page
  // already held the count for every one of them. Built from `stages` rather
  // than a second read: one source, so the definition and the figure beside it
  // cannot disagree.
  //
  // EVERY stage the glossary defines gets a number, defaulting to zero.
  //
  // `getReviewStages` returns a row only for a status that currently HOLDS a
  // pending case, so a stage standing empty had no entry, no count printed,
  // and - once the counts became links - no link either. PENDING AUDIT
  // RESPONSE was exactly that: a page in the sitemap that nothing on the site
  // pointed at, which is an orphan by the same definition used for the entity
  // pages. Zero is also the more honest render on its own terms: no number at
  // all reads as "not measured", and this is measured.
  const stageCounts: Record<string, number> = {};
  for (const { status } of reviewStages()) stageCounts[status] = 0;
  for (const st of stages) stageCounts[st.status] = st.cases;
  // WHEN EACH STAGE'S OWN COUNT WAS LAST OBSERVED. A global maximum dates
  // every number to the freshest stage, which is how the hub came to stamp
  // RFI ISSUED's 965 cases "August 30" while the stage's own page stamped the
  // same 965 "August 27". Both read from `seenTo` now, so they agree by
  // construction rather than by two expressions happening to match.
  const stageAsOf: Record<string, string | null> = {};
  for (const st of stages) stageAsOf[st.status] = st.seenTo;
  // The fallback for a stage holding nothing today, which has no row and so
  // no observation date of its own.
  const censusAsOf = stages.reduce<string | null>(
    (latest, st) =>
      st.seenTo && (latest === null || st.seenTo > latest) ? st.seenTo : latest,
    null,
  );
  const rfi = stages.find((s) => s.status === "RFI ISSUED") ?? null;
  const reviewCases = stages
    .filter((s) => isReviewStage(s.status))
    .reduce((n, s) => n + s.cases, 0);

  // DOL's published position, used twice: as the marker on the ladder and as
  // the corroborating half of the lede. Both read this one value, so they
  // cannot drift apart.
  const analystQueue =
    dol?.permQueues.find((q) => /analyst/i.test(q.queue))?.priorityDate ?? null;
  const analystDays =
    dol?.permAverageDays.find((d) => /analyst/i.test(d.determination))
      ?.calendarDays ?? null;
  const auditQueue =
    dol?.permQueues.find((q) => /audit/i.test(q.queue))?.priorityDate ?? null;

  const rfiMedian = rfi?.ageBand?.median ?? null;

  return (
    <>
      <JsonLdScript
        schema={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: "https://permtracker.app/perm-rfi-audit",
          isPartOf: {
            "@type": "WebSite",
            name: "PERM Tracker",
            url: "https://permtracker.app",
          },
        }}
      />
            <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">        <div className="pt-10 sm:pt-12" />
        <header className="max-w-3xl">
          <h1 className="font-heading text-3xl font-black leading-tight sm:text-5xl">
            RFIs, audits and appeals
          </h1>{" "}
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Every PERM case that gets pulled out of the ordinary queue lands on
            one of a dozen status strings, and DOL prints them with no
            explanation. Here is what each one means, how many cases are at each
            one today, and what the record shows happens next.
          </p>
        </header>

        {rfi && rfiMedian !== null ? (
          <div className="mt-8">
            <InsightLede
              verdict={`${rfi.cases.toLocaleString()} open RFIs`}
              direction="flat"
              source={
                analystQueue
                  ? `Live case mirror, ${rfi.seenTo ?? "latest"} · DOL FLAG processing times, ${dol?.permAsOf ?? ""}`
                  : undefined
              }
            >
              An RFI doesn&rsquo;t arrive at a random point in the wait. The
              median case sitting at one today was filed {rfiMedian} days ago
              {analystDays !== null ? (
                <>
                  , and DOL&rsquo;s own figure for an analyst-review
                  determination is {analystDays} calendar days
                </>
              ) : null}
              . It shows up when a human finally opens the file.
            </InsightLede>
          </div>
        ) : null}

        {/* 1. THE CENSUS ------------------------------------------------- */}
        <Section
          id="census"
          title="How many cases are at each stage"
          lede={
            <>
              {pending.toLocaleString()} PERM cases are waiting on a decision.{" "}
              {reviewCases.toLocaleString()} of them, {share(reviewCases, pending)},
              are at something other than the ordinary queue. DOL&rsquo;s
              quarterly disclosure files contain only decided cases, so these
              counts cannot be built from them at all.
            </>
          }
        >
          {/*
            THE LAG IS DIRECTIONAL AND THE DIRECTION IS THE USEFUL PART.
            Measured: all 1,348 cases at the review and appeal stages were
            re-checked within the last week, so those rows are current. The
            94,432-case analyst-review queue is not: 76,110 of them were last
            read before 1 August or carry no timestamp at all. A case that
            moved from analyst review to an RFI since its last read still
            reads as analyst review here. So the review counts are a FLOOR,
            and saying only "these numbers may be stale" would have got the
            direction wrong as often as right.
          */}
          <p className="mb-6 max-w-3xl border-l-4 border-border bg-secondary px-4 py-3 text-sm leading-relaxed">
            Each case shows the stage it was in when it was last read, and each
            row below carries that date. Every case at a review or appeal stage
            was read within the past week. The 94,000-case analyst queue was
            not, so a case that has moved into one of these stages since its
            own last read is still counted in that queue: treat the review
            counts as a floor rather than a total.
          </p>{" "}
          <StageCensus
            stages={stages}
            smallRecords={smallRecords}
            smallMax={SMALL_STAGE_MAX}
          />
          <CensusLinks />
        </Section>

        {/* 2. THE LADDER (signature) ------------------------------------- */}
        <Section
          id="when"
          title="When each stage happens"
          lede={
            <>
              The stages are ordered by how old the case is, and the order
              holds every time it is measured. Holds land early, RFIs around a
              year in, appeals past two years. Nothing here says how long a
              stage lasts. It says where in a case&rsquo;s life you find it.
            </>
          }
        >
          <DataView
            label="Stage timing"
            chart={
              <StageLadder
                stages={stages}
                marker={
                  analystDays !== null
                    ? {
                        days: analystDays,
                        label: `DOL: analyst review averaging ${analystDays} days`,
                      }
                    : null
                }
              />
            }
            table={<StageLadderTable stages={stages} />}
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            The appeal stages sit late for a mechanical reason rather than an
            interesting one: a case cannot be at BALCA without first being
            filed, reviewed and denied. Read the ladder as a map of the process,
            not as a measure of delay at any one stage.
          </p>
        </Section>

        {/* 3. THE FUNNEL -------------------------------------------------- */}
        <Section
          id="after-an-rfi"
          title="What happens after an RFI"
          lede={
            <>
              This is the one thing a snapshot of today cannot answer, because
              a case that answered its RFI is no longer showing one. It comes
              from a separate outcome tally over a different population, and it
              is the most reassuring true number on this page.
            </>
          }
        >
          {funnel ? (
            <>
              <RfiOutcomes funnel={funnel} />
              <div className="mt-5 grid gap-4 border-2 border-border bg-secondary p-4 sm:p-5">
                {funnel.medianDaysToDecision !== null ? (
                  <p className="text-sm leading-relaxed">
                    <b className="font-bold">
                      Half of the RFIs that resolved did so within{" "}
                      {funnel.medianDaysToDecision} days.
                    </b>{" "}
                    That is a figure about{" "}
                    {funnel.resolved.toLocaleString()} cases and not a schedule
                    for any one of them. Half took longer, and the tally records
                    no upper bound.
                  </p>
                ) : null}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The frozen half of these outcomes covers a watch list of{" "}
                  {funnel.totalTracked.toLocaleString()} cases; the half we
                  observe ourselves comes from our own sweep of every PERM
                  case. Both are different and smaller populations than the{" "}
                  {pending.toLocaleString()} pending cases counted above. None
                  of the three are interchangeable, and the percentages should
                  not be applied to each other.
                </p>
              </div>
            </>
          ) : (
            <EmptyState what="The RFI outcome tally" />
          )}
        </Section>

        {/* 4. THE CONVEYOR ------------------------------------------------ */}
        <Section
          id="cohorts"
          title="Which filing months hold which stage"
          lede={
            <>
              Read across a row and each stage occupies its own slice of the
              backlog, barely overlapping the others.{" "}
              {analystQueue ? (
                <>
                  DOL says its analysts are working{" "}
                  <b className="font-bold text-foreground">
                    {monthName(analystQueue)}
                  </b>{" "}
                  filings, and that is the month holding the most open RFIs.
                </>
              ) : null}
            </>
          }
        >
          <DataView
            label="Stage by filing month"
            chart={
              <StageCohortsChart cohorts={cohortsRaw} statuses={REVIEW_STATUSES} />
            }
            table={
              <StageCohortsTable cohorts={cohortsRaw} statuses={REVIEW_STATUSES} />
            }
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            This counts cases by the month they were filed, not RFIs issued per
            month. The mirror records one observation per case, so it cannot
            see a case enter or leave a stage, and no line through these columns
            would mean anything. Whether DOL issues more RFIs than it used to is
            a question this data cannot answer.
          </p>
        </Section>

        {/* 5. OCCUPATIONS ------------------------------------------------- */}
        {occupations ? (
          <Section
            id="occupations"
            title="Which jobs are carrying the open RFIs"
            lede={
              <>
                Not the ones most people expect. Software roles draw an RFI at
                well under the field rate, and the service occupations that
                make up a small share of PERM filings carry rates several times
                it. These are measured rates for named groups with their sizes
                shown, and a rate for a group you belong to is not a
                probability for your case.
              </>
            }
          >
            <OccupationRates cut={occupations} />
          </Section>
        ) : null}

        {/* 6. CONCENTRATION ----------------------------------------------- */}
        <Section
          id="concentration"
          title="One of these stages is diffuse and the others are not"
        >
          <Concentration stages={stages} smallMax={SMALL_STAGE_MAX} />
        </Section>

        {/* 7. GLOSSARY ---------------------------------------------------- */}
        <Section
          id="glossary"
          title="What each status actually means"
          lede={
            <>
              <b className="font-bold text-foreground">
                DOL publishes no glossary of these statuses.
              </b>{" "}
              Five of the sixteen strings it can show you have no published
              definition anywhere: two independent research passes went looking
              and neither found one. So each entry below either cites the
              regulation that governs it, or says plainly that nothing defines
              it. Nothing here is reconstructed from what an acronym looks like
              it should mean.
            </>
          }
        >
          {/* THE DATE HAS TO BE THE CENSUS'S OWN. This passed
              `dol.permAsOf`, which is the as-of stamp on DOL's PROCESSING
              TIMES page - a different dataset, refreshed on a different
              cadence, about a different thing. Stamping a live stage count
              with it would date the number to whenever DOL last republished
              its queue positions. `seenTo` is when our sweep last saw a case
              at that stage, which is what these counts are actually a
              measurement of. */}
          <StageGlossary
            auditQueue={auditQueue}
            counts={stageCounts}
            asOf={censusAsOf}
            asOfByStatus={stageAsOf}
          />
        </Section>

        {/* 8. THE REFUSALS ------------------------------------------------ */}
        <Section id="limits" title="What this page will not tell you">
          <Limits funnelTracked={funnel?.totalTracked ?? null} auditQueue={auditQueue} />
        </Section>

        {/*
          TWO KINDS OF CLAIM ON ONE PAGE, AND THE READER HAS TO BE ABLE TO TELL
          THEM APART. The regulation citations are first-party federal text
          from the eCFR API: checkable, permanent, and the strongest material
          here. The counts are not. The per-case statuses are read from DOL directly, in batches, every 12 hours. DOL publishes no documented API for it. That is worth
          saying out loud rather than letting a reader discover the chain
          later, which would turn a genuine scoop into a credibility problem.
        */}
        <section className="mt-14 max-w-3xl border-2 border-border bg-card p-5 sm:mt-20">
          <h2 className="font-heading text-lg font-black">
            Where these numbers come from
          </h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The regulations are quoted from the{" "}
            <a
              className="font-bold text-primary underline"
              href="https://www.ecfr.gov/current/title-20/chapter-V/part-656"
              rel="noopener noreferrer"
              target="_blank"
            >
              eCFR text of 20 CFR part 656
            </a>
            , which is the law itself and does not go stale between quarters.
          </p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The per-case counts come from DOL&rsquo;s own case-status search, read in batches every 12 hours. There is no documented API for it, so this is the same endpoint that page uses. DOL&rsquo;s{" "}
            <a
              className="font-bold text-primary underline"
              href="https://flag.dol.gov/processingtimes"
              rel="noopener noreferrer"
              target="_blank"
            >
              own processing-times page
            </a>{" "}
            is the authority, and it is where the queue positions and the
            analyst-review average on this page come from directly.
          </p>{" "}
          <PageBasics page="perm-rfi-audit" />{" "}
          <DataProvenance
            datasets={["perm-case-status", "rfi-funnel", "processing-times"]}
            className="mt-4 border-t-2 border-border pt-3"
          />
        </section>
      </div>
    </>
  );
}

/**
 * The stages this page charts.
 *
 * Listed explicitly rather than derived from the census, because the charts
 * need a stable row ORDER and "whatever came back largest first" reorders the
 * rows whenever two stages swap size. The census itself is still derived from
 * `is_final`, so a new status appears there without anyone editing this list.
 */
const REVIEW_STATUSES = [
  "APPLICATION ON HOLD",
  "RFI ISSUED",
  "NORD ISSUED",
  "RECONSIDERATION APPEALS",
  "BALCA APPEALS",
];

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-32 sm:mt-20">
      <h2 className="font-heading text-2xl font-black leading-tight sm:text-3xl">
        {title}
      </h2>{" "}
      {lede ? (
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
          {lede}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The contrast between a stage spread across hundreds of filers and one that
 * is a single company.
 *
 * Derived from the census rather than written out, so the sentence cannot go
 * stale against the numbers above it.
 */
function Concentration({
  stages,
  smallMax,
}: {
  stages: ReviewStage[];
  smallMax: number;
}) {
  // Only stages big enough for a share to mean something, and only the review
  // ones: the analyst-review queue is concentrated in nobody by construction,
  // and including it would win "most spread out" every time while saying
  // nothing about review.
  const sized = stages.filter(
    (s) => s.cases >= smallMax && s.topEmployer !== null && isReviewStage(s.status),
  );
  const ranked = [...sized].sort(
    (a, b) => b.topEmployerCases / b.cases - a.topEmployerCases / a.cases,
  );
  const most = ranked[0];
  const least = ranked[ranked.length - 1];
  if (!most || !least || most === least) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="border-2 border-border bg-card p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Most concentrated
        </p>{" "}
        <p className="mt-2 font-heading text-xl font-black leading-snug">
          {pctInt(most.topEmployerCases, most.cases)} of the{" "}
          {stageMeta(most.status).phrase} are one employer
        </p>{" "}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {most.topEmployerCases.toLocaleString()} of{" "}
          {most.cases.toLocaleString()} are filed by {most.topEmployer}, and the
          stage carries {most.employerNames.toLocaleString()} employer names in
          total. A count that reads as a programme-wide pattern is one
          company&rsquo;s filings.
        </p>
      </div>
      <div className="border-2 border-border bg-card p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Most spread out
        </p>{" "}
        <p className="mt-2 font-heading text-xl font-black leading-snug">
          {least.employerNames.toLocaleString()} employers hold the{" "}
          {least.cases.toLocaleString()} {stageMeta(least.status).phrase}
        </p>{" "}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The largest single filer has {least.topEmployerCases}. Whatever
          triggers an RFI, it is not concentrated in a handful of companies the
          way the other stages are.
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground lg:col-span-2">
        Both figures count distinct employer NAMES, which overstates how many
        separate organisations are involved: DOL prints one practice under
        several spellings, and the BALCA rows carry PricewaterhouseCoopers and
        PwC entities under eight of them. Merging them properly needs an entity
        resolver, and a half-built one silently merges two genuinely different
        companies, so nothing here attempts it.
      </p>
    </div>
  );
}

function Limits({
  funnelTracked,
  auditQueue,
}: {
  funnelTracked: number | null;
  auditQueue: string | null;
}) {
  return (
    <ul className="grid max-w-3xl gap-4">
      <Limit head="Whether your case will get an RFI">
        Nothing on this page is a probability for an individual case. The rates
        here describe named groups with their sizes shown, and belonging to a
        group with a 9% rate does not make your case 9% likely to be pulled.
      </Limit>
      <Limit head="A single risk score">
        The factors are not independent, so blending them into one number would
        read as precision the data cannot support. The same argument is made at
        greater length on{" "}
        <Link href="/perm-denial-risk" className="font-bold text-primary underline">
          denial rates
        </Link>
        .
      </Limit>
      <Limit head="How many PERM cases get audited">
        The outcome tally records zero audits ever, and zero is wrong rather
        than surprising: DOL&rsquo;s processing-times page publishes a live
        Audit Review queue
        {auditQueue ? <>, currently working {monthName(auditQueue)} filings</> : null}
        . An audit rate is not published anywhere we can source, so this page
        defines the term and gives no number.
      </Limit>
      <Limit head="Whether RFIs are becoming more common">
        Each case is observed once, so the data cannot see a case enter or
        leave a stage. Counting how many are at a stage today is possible.
        Counting how many arrived last month is not.
      </Limit>
      <Limit head="How long your RFI will take to resolve">
        The median in the outcome tally covers{" "}
        {funnelTracked !== null
          ? `a watch list of ${funnelTracked.toLocaleString()} cases`
          : "a separate population"}
        , and half of those took longer than it. It is a description of a
        group, not a date for a case.
      </Limit>
    </ul>
  );
}

function Limit({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <li className="border-l-4 border-border pl-4">
      <h3 className="font-heading text-base font-bold">{head}</h3>{" "}
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </li>
  );
}

function EmptyState({ what }: { what: string }) {
  return (
    <p className="border-2 border-border bg-secondary p-5 text-sm leading-relaxed">
      {what} is not loading right now. DOL publishes the underlying case
      statuses at{" "}
      <a
        href="https://flag.dol.gov/processingtimes"
        className="font-bold text-primary underline"
        rel="noopener noreferrer"
        target="_blank"
      >
        flag.dol.gov
      </a>
      .
    </p>
  );
}

function share(n: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (n / total) * 100;
  return `${p >= 10 ? p.toFixed(0) : p.toFixed(1)}%`;
}

function pctInt(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";
}

/** `2025-09` to `September 2025`. */
function monthName(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const names = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  return `${names[Number(m[2]) - 1] ?? ym} ${m[1]}`;
}
