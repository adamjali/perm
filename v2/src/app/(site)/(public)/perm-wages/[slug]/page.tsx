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
import { hasOwnPage } from "@/lib/entityPayload";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { socGroup } from "@/lib/socGroups";
import {
  DisclosureNote,
  LimitsPanel,
  MIN_DECIDED_FOR_MEDIAN,
  MIN_DECIDED_FOR_RATE,
  PeerList,
  RankLadder,
  ReliabilityBand,
  entityTitle,
  rateReliability,
} from "@/components/tools/EntityContext";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { getDatasetSchema } from "@/lib/structuredData";
import { getDisclosureStats, getFreshness } from "@/lib/turso/publicData";
import { getLadderByYear, getOccupationStateLadders } from "@/lib/turso/wages";
import { LadderCombViews, LadderYearViews } from "@/components/wages/LadderViews";
import { DataProvenance } from "@/components/data/DataProvenance";
import { PartyMix, StateMix } from "@/components/entities/FilingMakeup";
import { aliasTarget, entityFacets } from "@/lib/turso/entityDetail";
import {
  comparables,
  fieldDistribution,
  getBySlug,
  listByKind,
  PRERENDERED_ENTITY_HEAD,
} from "@/lib/turso/entities";

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
/**
 * SEVEN DAYS, NOT ONE, AND THE REASON IS THE SOURCE'S CADENCE.
 *
 * These pages render the QUARTERLY disclosure corpus. There are ~20,700 of
 * them and only the top 100 of each kind are prerendered, so every other one
 * regenerates on first request after its window expires. At revalidate=86400
 * that is up to 21,000 cold server renders A DAY - each a React SSR pass plus
 * Turso round trips - to reflect data that changes FOUR TIMES A YEAR.
 *
 * Vercel's free Fluid tier is 4 CPU-hours. 21,000 daily renders at even a
 * couple of hundred milliseconds of CPU each consumes it, and the account hit
 * 100% on 2026-08-27 with every public page still serving `x-vercel-cache:
 * HIT` - so it was never the pages people actually visit, it was the
 * regeneration of pages almost nobody opens.
 *
 * Seven days is still 13x more often than the underlying data moves. If a
 * quarter lands and these need to reflect it sooner, the ingest should call
 * on-demand revalidation rather than every page re-rendering on a timer.
 */
// 30 days, up from 7 (2026-08-29, the night ISR writes hit 100% of the
// Hobby cap). Every crawler hit on an expired tail page is a paid cache
// write, and 21k pages x weekly expiry was most of the 200k. The stats
// here move quarterly; the live band on a tail page moving a few weeks
// late is invisible; the top-100 pages rebuild with every deploy anyway.
export const revalidate = 2592000;

const KIND = "occupation" as const;
const BASE = "/perm-wages";
/** Same literal this file already used for the canonical Dataset url. */
const ORIGIN = "https://permtracker.app";
/** DOL's own denial rate, used when the aggregate document cannot be read. */
const FALLBACK_BASELINE_DENIAL_PCT = 2.57;
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

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** What to call this occupation when DOL's own title cell is unusable. */
function displayTitle(row: { title: string; code: string | null }): string {
  if (row.title !== UNUSABLE_TITLE) return row.title;
  return row.code ? `SOC ${row.code}` : "Occupation with no title on file";
}

export async function generateStaticParams() {
  // Only the head is prerendered; the rest generate on first request and cache
  // for an hour. Read from the entity TABLE, so a prerendered slug is one
  // `getBySlug` can find.
  const rows = await listByKind(KIND, PRERENDERED_ENTITY_HEAD);
  return rows.map((r) => ({ slug: r.slug }));
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
  // wanted, and it is the one thing the leading competitor does better in the
  // SERP. But only the count is safe to put here: these pages WITHHOLD the
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
    `PERM Salary: ${fmt(row.total)} Filings`,
    "PERM Salary and Filings",
    "PERM Salary",
  ]);
  const wagePart =
    row.medianAnnualWage != null ? `: ${money(row.medianAnnualWage)} median offered` : "";
  const head = `${name} PERM wages${wagePart} across ${fmt(row.total)} filings`;
  const description = head.length <= 120 ? `${head}, from DOL's own files.` : `${head}.`;
  return {
    // Thin-page defense: a sub-floor entity page exists for people but is
    // not offered to the index. The sitemap already omits it.
    ...(row && !hasOwnPage(row) ? { robots: { index: false, follow: true } } : {}),
    // When the SOC title alone already fills the space Google shows, the
    // brand suffix is the least valuable thing in it - `absolute` drops the
    // "| PERM Tracker" template rather than crowding out the searched phrase.
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: `${BASE}/${slug}` },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: `${BASE}/${slug}`,
    },
  };
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
  const [stats, dist, near, ladderYears, stateLadders, facets, freshness] = await Promise.all([
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
  ]);

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;
  const ladder = stats?.wageLadder ?? null;
  const name = displayTitle(row);

  const dataset = getDatasetSchema(ORIGIN, {
    name: `${name} PERM offered wages and filings`,
    description: `PERM wage and filing record for ${name} from DOL disclosure data.`,
    url: `${ORIGIN}${BASE}/${slug}`,
    dateModified: freshness["perm-cases"]?.asOf ?? undefined,
    variableMeasured: ["filings", "certified", "denied", "median offered wage"],
  });

  // Home > Occupations > this page. Breadcrumbs tell Google the shape of the site,
  // which is what it reads to decide a result deserves a hierarchy rather than
  // a bare link. The blog carried these; the ~20,960 pages that ARE the product
  // did not.
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      dataset,
      generateBreadcrumbSchema([
        { name: "Home", href: "/" },
        { name: "Occupations", href: BASE },
        { name: name, href: `${BASE}/${slug}` },
      ]),
    ],
  };

  const reliability = rateReliability(row.certified, row.denied, baselineDenialPct);
  const inCohort = reliability.tier !== "withheld";
  const fieldDays = median(dist.medianDays);
  const daysDelta =
    row.medianDays != null && fieldDays != null ? row.medianDays - fieldDays : null;
  const thinMedian = reliability.decided < MIN_DECIDED_FOR_MEDIAN;
  const wageInCohort = inCohort && row.medianAnnualWage != null;
  const peers = near.peers;
  // The query falls back to volume peers when the major group matched nothing,
  // so the heading reads what came BACK rather than what was asked for.
  const peersAreGroup = near.matched === "facet" && group != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          <Link
            href={BASE}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All occupations
          </Link>{" "}
          · #{fmt(row.rank)}
          {kindTotal > 0 ? ` of ${fmt(kindTotal)}` : ""} by volume
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {row.code ? `SOC ${row.code}` : "No SOC code on file"}
          {group ? `, in the ${group.toLowerCase()} major group` : ""}.{" "}
          {fmt(row.total)} PERM filings in DOL&apos;s current disclosure window,{" "}
          {fmt(row.certified)} certified and {fmt(row.denied)} denied.
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
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
          {[
            {
              k: "Median wage",
              v: row.medianAnnualWage == null ? "—" : money(row.medianAnnualWage),
              sub: ladder?.p50 != null ? `all PERM ${money(ladder.p50)}` : "",
            },
            {
              k: "Filings",
              v: fmt(row.total),
              sub: kindTotal > 0 ? `#${fmt(row.rank)} of ${fmt(kindTotal)}` : "",
            },
            {
              k: "Approval",
              v: reliability.ratePct == null ? "—" : `${reliability.ratePct.toFixed(1)}%`,
              sub:
                reliability.ratePct == null
                  ? `withheld: ${fmt(reliability.decided)} decided`
                  : `field ${(100 - baselineDenialPct).toFixed(1)}%`,
            },
            {
              k: "Median days",
              v: row.medianDays == null ? "—" : fmt(Math.round(row.medianDays)),
              sub: thinMedian
                ? `middle of ${fmt(reliability.decided)} decided`
                : daysDelta == null
                  ? ""
                  : Math.round(daysDelta) === 0
                    ? "at the field median"
                    : `${fmt(Math.abs(Math.round(daysDelta)))} ${daysDelta > 0 ? "slower" : "faster"} than the field`,
            },
          ].map((d) => (
            <div key={d.k} className="bg-card p-5">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {d.k}
              </p>{" "}
              <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">{d.v}</p>{" "}
              {d.sub ? <p className="mt-1 text-xs text-foreground/70">{d.sub}</p> : null}
            </div>
          ))}
        </div>
      </section>

      {dist.cohort >= 8 ? (
        <FigurePlate
          n="01"
          title="Position in the field"
          subject={`${fmt(dist.cohort)} occupations with ${dist.minDecided}+ decided`}
          caption={
            <>
              Each bar counts occupations at that value. PERM runs two labour
              markets through one process, which is why the wage axis is two
              humps rather than a bell.{" "}
              {inCohort
                ? "The line marks this one."
                : `This occupation has ${fmt(reliability.decided)} decided cases, so its wage and its median days are marked but left unranked, and no approval rate is drawn at all.`}{" "}
              {dist.complete
                ? ""
                : "The scan behind this cohort didn’t reach past the last qualifying occupation, so read it as the busiest part of the field rather than all of it. "}
            </>
          }
          source="DOL PERM disclosure files"
          className="mt-10"
        >
          <div className="grid [&>*]:min-w-0 grid-cols-1 gap-8 md:grid-cols-3">
            <FieldPosition
              population={dist.wages}
              value={row.medianAnnualWage}
              subjectInPopulation={wageInCohort}
              valueLabel={
                row.medianAnnualWage == null ? "—" : money(row.medianAnnualWage)
              }
              measure="Median offered wage"
              betterWhen="higher"
              aheadVerb="above"
              format={(n) => `$${Math.round(n / 1000)}k`}
              note={`median of ${fmt(row.total)} filings, too few decided to rank`}
            />
            <FieldPosition
              population={dist.approval}
              value={inCohort ? reliability.ratePct : null}
              valueLabel={
                reliability.ratePct == null ? "not shown" : `${reliability.ratePct.toFixed(1)}%`
              }
              measure="Approval rate"
              betterWhen="higher"
              format={(n) => `${n.toFixed(0)}%`}
              note={`under ${dist.minDecided} decided`}
            />
            {/* The days figure is real whatever the case count is, so the
                marker is drawn even for a subject outside the population. What
                is withheld is the PERCENTILE, because a percentile is a claim
                about membership and this subject is not a member. */}
            <FieldPosition
              population={dist.medianDays}
              value={row.medianDays}
              subjectInPopulation={inCohort}
              valueLabel={row.medianDays == null ? "—" : `${Math.round(row.medianDays)} days`}
              measure="Median days to decision"
              betterWhen="lower"
              format={(n) => `${Math.round(n)}d`}
              note={`middle of ${fmt(reliability.decided)} decided, too few to rank`}
            />
          </div>
        </FigurePlate>
      ) : null}

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
      {facets.employer || facets.attorney || facets.state ? (
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
          </div>
        </section>
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

      <section className="mt-12 border-2 border-border bg-tint-primary p-6 shadow-hard-sm sm:p-8">
        <h2 className="font-heading text-xl font-black">Reading the wage</h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/70">
          This is the median wage employers committed to in federal filings for
          this occupation. It mixes every experience level and every metro, and
          it&apos;s a floor: the employer must offer at least the prevailing wage
          DOL determines for the occupation, level and county.
          {ladder?.p25 != null && ladder.p75 != null ? (
            <>
              {" "}
              Across all PERM filings the middle half of offered wages runs{" "}
              {money(ladder.p25)} to {money(ladder.p75)}, so a figure inside
              that band is unremarkable whichever occupation it belongs to.
            </>
          ) : null}
        </p>
      </section>

      <LimitsPanel
        className="mt-8"
        items={[
          {
            head: "The code is the identity",
            body: (
              <>
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
                It&apos;s the middle of every wage committed to for this occupation
                across the country, entry level and principal alike. The same
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
                than with the job title. The measured factors are on the{" "}
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
                Every case in DOL&apos;s disclosure files carries a decision
                date, so a case still waiting is in none of these counts. Where
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
            All {kindTotal > 0 ? fmt(kindTotal) : ""} occupations sort together
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
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/70">
        Filings newer than DOL&apos;s last published file can&apos;t be attributed to this occupation until DOL publishes them. The <Link href="/perm-cases#live" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">live list</Link> on the case search page carries them by employer.
      </p>{" "}
      <DataProvenance datasets={["perm-cases", "entities"]} />
    </div>
  );
}
