/**
 * One occupation's PERM record.
 *
 * 762 of these, and the wage is the reason anyone arrives, so it leads with
 * the national ladder beside it: a salary figure without its field is exactly
 * the kind of number that misleads.
 *
 * The occupation pages get the strongest peer set of the three kinds, because
 * the SOC code carries a major group in its first two digits. "Other computer
 * and mathematical roles" is a real axis a reader wants and it is already in
 * the data, so `socGroups` turns a code into a group and the comparables query
 * filters the rank window by it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { FinePrint } from "@/components/data/FinePrint";
import { hasOwnPage } from "@/lib/entityPayload";
import { notFound } from "next/navigation";
import { firstThatFits } from "@/lib/describe";
import { formatDollars, formatInt } from "@/lib/format";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { socGroup } from "@/lib/socGroups";
import {
  DisclosureNote,
  LimitsPanel,
  MIN_DECIDED_FOR_RATE,
  PeerList,
  RankLadder,
  ReliabilityBand,
  entityTitle,
} from "@/components/tools/EntityContext";
import {
  EntityStatCards,
  FieldPositionPlate,
  UnpublishedFilingsNote,
  approvalCard,
  entityStanding,
  medianDaysCard,
  volumeCard,
} from "@/components/entities/EntityPageParts";
import {
  FALLBACK_BASELINE_DENIAL_PCT,
  entityJsonLd,
  entityMetadata,
  entityStaticParams,
} from "@/lib/entityPage";
import { getDisclosureStats, getFreshness } from "@/lib/turso/publicData";
import { getLadderByYear, getOccupationStateLadders } from "@/lib/turso/wages";
import { LadderCombViews, LadderYearViews } from "@/components/wages/LadderViews";
import { DataProvenance } from "@/components/data/DataProvenance";
import { CityMix, PartyMix, StateMix } from "@/components/entities/FilingMakeup";
import { WorkerMix } from "@/components/entities/WorkerMix";
import { workerFacets } from "@/lib/turso/employerHistory";
import { aliasTarget, entityFacets } from "@/lib/turso/entityDetail";
import { comparables, fieldDistribution, getBySlug } from "@/lib/turso/entities";

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
export const revalidate = 2592000;

const KIND = "occupation" as const;
const BASE = "/perm-wages";
/**
 * DOL leaves the job-title cell unusable on 15 of the 762 occupation rows and
 * prints "N/A". Those rows are real filings with real SOC codes, so the pages
 * exist; they just have to be introduced by their code rather than by a title
 * that says nothing.
 */
const UNUSABLE_TITLE = "N/A";

interface Subject {
  slug: string;
  title: string;
  code: string | null;
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
async function loadSubject(slug: string): Promise<Subject | null> {
  const row = await getBySlug(KIND, slug);
  if (!row) return null;
  return {
    slug: row.slug,
    // The table stores every entity's label as `name`; an occupation's
    // label is its job title. One mapping, at the boundary.
    title: row.name,
    code: row.code ? row.code : null,
    rank: row.rank,
    total: row.total,
    certified: row.certified,
    denied: row.denied,
    medianDays: row.medianDays,
    medianAnnualWage: row.medianAnnualWage ?? null,
  };
}

/** What to call this occupation when DOL's own title cell is unusable. */
function displayTitle(row: { title: string; code: string | null }): string {
  if (row.title !== UNUSABLE_TITLE) return row.title;
  return row.code ? `SOC ${row.code}` : "Occupation with no title on file";
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
  const row = await loadSubject(slug);
  if (!row) {
    const target = await aliasTarget(KIND, slug);
    // A miss must be decided HERE, not in the page body: the (public)
    // loading.tsx streams a 200 before the body runs, so a notFound() thrown
    // later can swap the UI but never the status - measured live as junk
    // slugs answering 200 (a soft 404, and a cold render per crawler guess).
    // Metadata resolves before the first byte; throwing here yields a real 404.
    if (!target) notFound();
    return { alternates: { canonical: `${BASE}/${target}` } };
  }
  const name = displayTitle(row);
  // SOC titles are themselves the searched phrase and run to 79 characters,
  // so padding a long one just pushes it past what Google shows. `entityTitle`
  // takes the longest qualifier that still fits and drops the brand suffix
  // before it drops anything a searcher typed.
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
  const { title, absolute } = entityTitle(name, [
    `PERM Salary: ${formatInt(row.total)} Filings`,
    "PERM Salary and Filings",
    "PERM Salary",
  ]);
  const wagePart =
    row.medianAnnualWage != null ? `: ${formatDollars(row.medianAnnualWage)} median offered` : "";
  const head = `${name} PERM wages${wagePart} across ${formatInt(row.total)} filing${row.total === 1 ? "" : "s"}`;
  // The richest that fits 155 (lib/describe). No approval rate: this page
  // publishes a wage and no rate.
  const description = firstThatFits([
    `${head}. Who files this job, what it pays and where, from DOL's own files.`,
    `${head}, from DOL's own files.`,
    `${head}.`,
  ]);
  // When the SOC title alone already fills the space Google shows, the
  // brand suffix is the least valuable thing in it - `absolute` drops the
  // "| PERM Tracker" template rather than crowding out the searched phrase.
  return entityMetadata({
    title,
    absolute,
    description,
    path: `${BASE}/${slug}`,
    noindex: !hasOwnPage(row),
  });
}

export default async function OccupationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await loadSubject(slug);
  if (!row) notFound();
  // Below the page threshold the page still RENDERS - an attorney searched a
  // two-case firm she knows, found it, and a result that 404s on click is
  // worse than absence. The doorway-page defense moved to metadata: sub-floor
  // pages are noindex (set in generateMetadata) and the sitemap omits them,
  // so crawlers are told exactly what these are while people get the page.
  // The first two digits of a SOC code are its major group, so this costs a
  // lookup rather than new data. `socGroups.ts` holds the one copy of it.
  const group = socGroup(row.code);
  const prefix = row.code ? row.code.trim().slice(0, 2) : null;

  // The materialised wage cells are keyed by SOC code, so an occupation with
  // no code on file simply has no ladder rather than a wrong one.
  const wageKey = row.code ?? "";
  const [stats, dist, near, ladderYears, stateLadders, facets, freshness, workers] = await Promise.all([
    getDisclosureStats(),
    fieldDistribution(KIND, MIN_DECIDED_FOR_RATE),
    comparables({
      kind: KIND,
      rank: row.rank,
      // The widest window the query allows. A major group's members are
      // spread across the whole ranking, so a narrow window would return
      // the handful that happen to file at a similar rate and call them
      // the group.
      span: 500,
      limit: 6,
      ...(prefix ? { codePrefix: prefix } : {}),
    }),
    wageKey ? getLadderByYear("occupation", wageKey) : Promise.resolve([]),
    wageKey ? getOccupationStateLadders(wageKey, 16) : Promise.resolve([]),
    entityFacets(KIND, slug),
    // An 11-row table, React-cached, on a page that regenerates monthly. It is
    // here only so the Dataset can state WHEN its figures were last true.
    getFreshness(),
    workerFacets("occupation", slug),
  ]);

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;
  const ladder = stats?.wageLadder ?? null;
  const name = displayTitle(row);

  const schema = entityJsonLd({
    path: `${BASE}/${slug}`,
    name,
    dataset: {
      name: `${name} PERM offered wages and filings`,
      description: `PERM wage and filing record for ${name} from DOL disclosure data.`,
      variableMeasured: ["filings", "certified", "denied", "median offered wage"],
    },
    freshness,
  });

  const standing = entityStanding(row, dist, baselineDenialPct);
  const { reliability, inCohort } = standing;
  // Each caveat leads with THIS occupation's own figure. See the note on the
  // attorney page: the entity long tail is what GSC has discovered and never
  // crawled, and 721 words of every entity page were byte-identical.
  const topEmp = facets.employer?.[0];
  const topState = facets.state?.[0];
  const wageInCohort = inCohort && row.medianAnnualWage != null;
  const peers = near.peers;
  // The query falls back to volume peers when the major group matched nothing,
  // so the heading reads what came BACK rather than what was asked for.
  const peersAreGroup = near.matched === "facet" && group != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          {name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {row.code ? `SOC ${row.code}` : "No SOC code on file"}
          {group ? `, in the ${group.toLowerCase()} major group` : ""}.{" "}
          {formatInt(row.total)} PERM filings in DOL&apos;s current disclosure window,{" "}
          {formatInt(row.certified)} certified and {formatInt(row.denied)} denied.
          {row.title === UNUSABLE_TITLE
            ? " DOL's job-title cell is unusable on these rows, so the code is the only name they have."
            : ""}
        </p>
      </header>

      {/* The doubt goes ABOVE the figures. */}
      <ReliabilityBand
        reliability={reliability}
        baselineDenialPct={baselineDenialPct}
        subject="occupation"
        unit="filings"
        className="mt-8"
      />

      <section className="pop mt-8">
        <EntityStatCards
          cards={[
            {
              k: "Median wage",
              v: row.medianAnnualWage == null ? "—" : formatDollars(row.medianAnnualWage),
              sub: ladder?.p50 != null ? `all PERM ${formatDollars(ladder.p50)}` : "",
            },
            volumeCard("Filings", row, kindTotal),
            approvalCard(reliability, baselineDenialPct),
            medianDaysCard(row.medianDays, standing),
          ]}
        />
      </section>

      <FieldPositionPlate
        n="01"
        singular="occupation"
        plural="occupations"
        dist={dist}
        standing={standing}
        medianDays={row.medianDays}
        lead="Each bar counts occupations at that value. PERM runs two labour markets through one process, which is why the wage axis is two humps rather than a bell."
        outOfCohortNote={`This occupation has ${formatInt(reliability.decided)} decided cases, so its wage and its median days are marked but left unranked, and no approval rate is drawn at all.`}
        first={
          <FieldPosition
            population={dist.wages}
            value={row.medianAnnualWage}
            subjectInPopulation={wageInCohort}
            valueLabel={
              row.medianAnnualWage == null ? "—" : formatDollars(row.medianAnnualWage)
            }
            measure="Median offered wage"
            betterWhen="higher"
            aheadVerb="above"
            format={(n) => `$${Math.round(n / 1000)}k`}
            note={`median of ${formatInt(row.total)} filings, too few decided to rank`}
          />
        }
      />

      {/* The wage percentiles. A single median is the figure that brings
          people to this page and it is also the one that misleads them: it
          says nothing about how wide the range is, and an offer can sit two
          rungs below it while still clearing the prevailing wage. */}
      {ladderYears.length >= 2 ? (
        <FigurePlate
          n="02"
          title="The wage ladder, year by year"
          subject={`${displayTitle(row)}, certified offers`}
          caption="A median answers whether pay moved. The whole ladder answers which part of it moved, and those are not the same question: a distribution can hold its middle while its top stretches away."
          source="DOL PERM disclosure files, certified cases only"
          className="mt-10"
        >
          <LadderYearViews
            label={`${displayTitle(row)} wage ladder by year`}
            years={ladderYears}
          />
        </FigurePlate>
      ) : null}

      {stateLadders.length >= 2 ? (
        <FigurePlate
          n="03"
          title="The same job, state by state"
          subject={`${stateLadders.length} states filing enough of this occupation to publish a ladder`}
          caption="One SOC code, one federal process, and a wage range that moves with the state. A state is included only when it files enough certified cases of this occupation to support seven percentiles; the rest are left out rather than drawn thin."
          source="DOL PERM disclosure files, certified cases only"
          className="mt-10"
        >
          <LadderCombViews
            label={`${displayTitle(row)} wage ladder by state`}
            subjectLabel="State"
            ladders={stateLadders}
          />
        </FigurePlate>
      ) : null}

      {/* Who is on the other side of these wages. The ladders above answer
          what the job pays; a reader weighing an offer also wants to know
          who files it and where the work is. */}
      {facets.employer || facets.attorney || facets.state || facets.city ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-black">Who files this job</h2>{" "}
          <p className="mt-2 max-w-2xl text-base text-foreground/70">
            The sponsors and firms with the most PERM filings under this code,
            and the states the work sits in.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            {facets.employer ? (
              <PartyMix
                rows={facets.employer}
                total={row.total}
                title="Sponsors filing it"
                note="The employers with the most applications under this code."
                hrefBase="/perm-employers"
              />
            ) : null}
            {facets.attorney ? (
              <PartyMix
                rows={facets.attorney}
                total={row.total}
                title="Firms filing it"
                note="The law firms named on the most applications under this code."
                hrefBase="/perm-attorneys"
              />
            ) : null}
            {facets.state ? (
              <StateMix rows={facets.state} total={row.total} className="lg:col-span-2" />
            ) : null}
            {facets.city ? (
              <CityMix rows={facets.city} total={row.total} className="lg:col-span-2" />
            ) : null}
          </div>
        </section>
      ) : null}

      <WorkerMix facets={workers} subject="occupation" />

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
        heading={
          peersAreGroup ? `Other ${group.toLowerCase()} roles` : "Occupations at this volume"
        }
        note={
          peersAreGroup ? (
            <>
              Occupations sharing this one&apos;s SOC major group, which is
              carried in the first two digits of the code. Wages inside a group
              still swing hard, because the group holds every seniority level
              and every metro.
            </>
          ) : (
            <>
              The occupations ranked either side of this one by filing volume.{" "}
              {group
                ? `Nothing else in the ${group.toLowerCase()} major group filed a PERM case in this window.`
                : "This row has no readable SOC code, so it can’t be grouped with its own line of work."}
            </>
          )
        }
        items={peers}
        hrefBase={BASE}
        unit="filings"
        className="mt-12"
      />

      {/* ONE LINE AND A LINK, THE READING FOLDED. */}
      <section className="mt-12 border-2 border-border bg-tint-primary p-6 shadow-hard-sm sm:p-8">
        <h2 className="font-heading text-xl font-black">Reading the wage</h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
          A floor, not a salary survey: every level and metro mixed.
          {row.code ? (
            <>
              {" "}
              <Link
                href={`/tools/wage-levels?soc=${encodeURIComponent(row.code.trim().slice(0, 7))}`}
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                DOL&apos;s four wage levels for this job
              </Link>
              , by area.
            </>
          ) : null}
        </p>{" "}
        <FinePrint summary="What the median is" className="mt-2">
          <p>
            The median wage employers committed to in federal filings for this
            occupation. It mixes every experience level and every metro, and
            it&apos;s a floor: the employer must offer at least the prevailing
            wage DOL determines for the occupation, level and county.
            {ladder?.p25 != null && ladder.p75 != null
              ? ` Across all PERM filings the middle half of offered wages runs ${formatDollars(ladder.p25)} to ${formatDollars(ladder.p75)}, so a figure inside that band is unremarkable whichever occupation it belongs to.`
              : ""}{" "}
            The levels page reads DOL&apos;s OFLC wage search live.
          </p>
        </FinePrint>
      </section>

      <LimitsPanel
        className="mt-8"
        items={[
          {
            head: "The code is the identity",
            body: (
              <>
                This one is {row.code ? `SOC ${row.code}` : "an occupation DOL left untitled"}.
                Two SOC codes can carry the same job title, so a title that
                looks duplicated on the ranking is two different occupations.
                Match on the code when you&apos;re checking a specific filing.
              </>
            ),
          },
          {
            head: "A median isn’t an offer",
            body: (
              <>
                It&apos;s the middle of all {formatInt(row.total)} wages committed to
                for this occupation across the country, entry level and
                principal alike. The same
                role&apos;s medians swing hard by worksite, which the{" "}
                <Link
                  href="/perm-by-state"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  state map
                </Link>{" "}
                shows directly.
              </>
            ),
          },
          {
            head: "Approval isn’t about the occupation",
            body: (
              <>
                The denial rate moves with what happened in the filing rather
                than with the job title, so nothing here is a property of{" "}
                {displayTitle(row)}. The measured factors are on the{" "}
                <Link
                  href="/perm-denial-risk"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  denial risk page
                </Link>
                , published as separate rates.
              </>
            ),
          },
          {
            head: "Nothing here is pending",
            body: (
              <>
                All {formatInt(row.total)} counted here carry a decision date, because
                every case in DOL&apos;s disclosure files does, so a case still
                waiting is in none of them.{topEmp ? ` The largest filer of this
                occupation is ${topEmp.label}.` : ""}
                {topState && !topEmp ? ` Most sit in ${topState.label}.` : ""} Where
                the queue stands today is on the{" "}
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
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Weighing an offer?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Compare it against this median, then check the{" "}
            <Link
              href="/perm-by-state"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              state map
            </Link>
            , where the same occupation&apos;s medians swing hard by worksite.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Setting one?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            All {kindTotal > 0 ? formatInt(kindTotal) : ""} occupations sort together
            on the{" "}
            <Link
              href={BASE}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              wages page
            </Link>
            , and{" "}
            <Link
              href="/perm-denial-risk"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              denial rates
            </Link>{" "}
            show how outcome moves with the offered wage.
          </p>
        </div>
      </section>
      <UnpublishedFilingsNote subject="occupation" />{" "}
      <DataProvenance datasets={["perm-cases", "entities"]} />
    </div>
  );
}
