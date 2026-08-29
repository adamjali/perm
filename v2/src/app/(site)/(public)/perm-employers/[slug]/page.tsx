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
import Link from "next/link";
import { hasOwnPage } from "@/lib/entityPayload";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
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
import { getDisclosureStats, getFreshness } from "@/lib/turso/publicData";
import { LiveQueueBand } from "@/components/entities/LiveQueueBand";
import { NameSpellings } from "@/components/entities/NameSpellings";
import { SizeBandNote } from "@/components/entities/SizeBandNote";
import { OccupationMix, PartyMix, StateMix } from "@/components/entities/FilingMakeup";
import {
  absorbedCount,
  entityFacets,
  entityPending,
  nameVariants,
  resolveEntity,
  sizeBand,
} from "@/lib/turso/entityDetail";
import { recentLiveByEmployer } from "@/lib/turso/cases";
import { DataProvenance } from "@/components/data/DataProvenance";
import {
  comparables,
  fieldDistribution,
  getBySlug,
  listByKind,
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
export const revalidate = 604800;

const KIND = "employer" as const;
const BASE = "/perm-employers";
/** DOL's own denial rate, used when the aggregate document cannot be read. */
const FALLBACK_BASELINE_DENIAL_PCT = 2.57;

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

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export async function generateStaticParams() {
  // Only the head is prerendered. The rest are valid routes that generate on
  // first request and cache for an hour, which keeps a 12,240-entity build
  // from taking hours for pages almost nobody opens.
  //
  // Read from the entity TABLE, not from the aggregate document. The aggregate
  // carries its own copy of the top 250 and slugs them client-side, so a slug
  // prerendered from it is not guaranteed to be a slug `getBySlug` can find.
  const rows = await listByKind(KIND, 100);
  return rows.map((r) => ({ slug: r.slug }));
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
  if (!found) notFound();
  const row = found.subject;
  const reliability = rateReliability(
    row.certified,
    row.denied,
    FALLBACK_BASELINE_DENIAL_PCT,
  );
  const { title, absolute } = entityTitle(row.name, ["PERM Filings"]);
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
  const head = `${row.name}: ${fmt(row.total)} PERM filings${ratePart}, ranked ${fmt(row.rank)} by volume`;
  const description =
    head.length <= 120 ? `${head}, from DOL's own disclosure files.` : `${head}.`;
  return {
    // Thin-page defense: a sub-floor entity page exists for people but is
    // not offered to the index. The sitemap already omits it.
    ...(row && !hasOwnPage(row) ? { robots: { index: false, follow: true } } : {}),
    // A legal entity name can run past what Google shows on its own
    // ("VERIZON COMMUNICATIONS INC AND ALL ITS SUBSIDIARIES AND AFFILIATES"),
    // so `entityTitle` drops the brand suffix, then the qualifier, rather than
    // crowding out the name. It measures the RENDERED length: the old test
    // looked at the base and let 15% of these render past 60.
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: `${BASE}/${found.canonicalSlug}` },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: `${BASE}/${found.canonicalSlug}`,
    },
  };
}

export default async function EmployerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await loadSubject(slug);
  if (!found) notFound();
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
  const [stats, dist, near, pending, facets, variants, absorbed, freshness, recentLive] =
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
      // the gap Adam hit: a case he KNEW existed was invisible on its own
      // sponsor's page until DOL's quarterly publication. Indexed point
      // read over the small remainder table; degrades to an absent band.
      recentLiveByEmployer(canonicalSlug, 8).catch(() => []),
    ]);
  const band = await sizeBand(KIND, row.rank);
  const mirrorAsOf = freshness["perm-case-status"]?.asOf ?? null;

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${row.name} PERM labor certification filings`,
    description: `PERM filing record for ${row.name} from DOL disclosure data.`,
    url: `https://permtracker.app${BASE}/${slug}`,
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  };

  const reliability = rateReliability(row.certified, row.denied, baselineDenialPct);
  const inCohort = reliability.tier !== "withheld";
  // The card and the drawing read the same number, so they cannot disagree:
  // this is the median of the comparable cohort's own medians, which is
  // exactly the distribution the figure below plots.
  const fieldDays = median(dist.medianDays);
  const daysDelta =
    row.medianDays != null && fieldDays != null ? row.medianDays - fieldDays : null;
  const thinMedian = reliability.decided < MIN_DECIDED_FOR_MEDIAN;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="employers" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          <Link
            href={BASE}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All sponsors
          </Link>{" "}
          · #{fmt(row.rank)}
          {kindTotal > 0 ? ` of ${fmt(kindTotal)}` : ""} by volume
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {fmt(row.total)} PERM filings in DOL&apos;s current disclosure window,{" "}
          {fmt(row.certified)} certified and {fmt(row.denied)} denied. Name as
          DOL prints it, which is the legal entity on the form.
        </p>
      </header>

      {/* The doubt goes ABOVE the figures. A caveat under a number reads as a
          footnote to a fact; over it, the number arrives already qualified. */}
      <ReliabilityBand
        reliability={reliability}
        baselineDenialPct={baselineDenialPct}
        subject="sponsor"
        unit="filings"
        className="mt-8"
      />

      <section className="pop mt-8">
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-5">
          {[
            {
              k: "Filings",
              wide: false,
              v: fmt(row.total),
              sub: kindTotal > 0 ? `#${fmt(row.rank)} of ${fmt(kindTotal)}` : "",
            },
            {
              k: "Certified",
              wide: false,
              v: fmt(row.certified),
              sub: `${fmt(row.denied)} denied`,
            },
            {
              k: "Approval",
              wide: false,
              v: reliability.ratePct == null ? "—" : `${reliability.ratePct.toFixed(1)}%`,
              sub:
                reliability.ratePct == null
                  ? `withheld: ${fmt(reliability.decided)} decided`
                  : `field ${(100 - baselineDenialPct).toFixed(1)}%`,
            },
            {
              k: "Median wage",
              v:
                row.medianAnnualWage == null
                  ? "—"
                  : `$${Math.round(row.medianAnnualWage).toLocaleString("en-US")}`,
              sub: row.medianAnnualWage == null ? "not on file" : "offered, per year",
              // Five cards in a two-column grid leave the fifth alone, and an
              // empty cell in this `gap-px bg-border` grid paints as a slab of
              // border colour. Spanning both keeps the mobile grid whole.
              wide: true,
            },
            {
              k: "Median days",
              wide: false,
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
            <div
              key={d.k}
              className={
                d.wide ? "bg-card p-5 col-span-2 sm:col-span-1" : "bg-card p-5"
              }
            >
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {d.k}
              </p>{" "}
              <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">{d.v}</p>{" "}
              {d.sub ? <p className="mt-1 text-xs text-foreground/70">{d.sub}</p> : null}
            </div>
          ))}
        </div>
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
      ) : null}

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
            {recentLive.map((c) => (
              <li
                key={c.caseNumber}
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
            ))}
          </ul>
        </section>
      ) : null}

      {/* Where does this sponsor sit in the field? A stat card states a
          number; only the distribution says whether that number is unusual. The population is every sponsor whose
          case count can carry a rate, which is the only denominator these two
          measures can honestly be read against. */}
      {dist.cohort >= 8 ? (
        <FigurePlate
          n={pending ? "02" : "01"}
          title="Position in the field"
          subject={`${fmt(dist.cohort)} sponsors with ${dist.minDecided}+ decided`}
          caption={
            <>
              Each bar counts sponsors at that value. Sponsors with fewer than{" "}
              {dist.minDecided} decided cases are left out of the population
              rather than plotted, because a rate over a handful of cases lands
              wherever the handful landed.{" "}
              {inCohort
                ? "The line marks this one."
                : `This sponsor has ${fmt(reliability.decided)} decided cases, so its median days is marked but left unranked, and no approval rate is drawn at all.`}{" "}
              {dist.complete
                ? ""
                : "The scan behind this cohort didn’t reach past the last qualifying sponsor, so read it as the busiest part of the field rather than all of it. "}
            </>
          }
          source="DOL PERM disclosure files"
          className="mt-10"
        >
          <div className="grid [&>*]:min-w-0 grid-cols-1 gap-8 md:grid-cols-2">
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

      {facets.occupation || facets.state || facets.attorney ? (
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
            {facets.state ? <StateMix rows={facets.state} total={row.total} /> : null}
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
            The sponsors ranked either side of this one, which is the same as
            saying they file about as many PERM cases a year. Worksite state
            isn&apos;t carried per employer in this data, so these are volume peers
            rather than neighbours; filings by state are on the{" "}
            <Link
              href="/perm-by-state"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              state map
            </Link>
            .
          </>
        }
        items={near.peers}
        hrefBase={BASE}
        unit="filings"
        className="mt-12"
      />

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
          {
            head: "The wage is the job, not the payer",
            body: (
              <>
                The median offered wage moves almost entirely with what roles they
                {" "}
                file. A software developer and a poultry cutter are different
                numbers wherever they are filed, so this figure is not plotted
                against the field and no percentile is given for it: that
                comparison would rank occupation mix and call it pay. Wages by
                occupation are on the{" "}
                <Link
                  href="/perm-wages"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  wages page
                </Link>
                .
              </>
            ),
          },
          {
            head: "Volume doesn’t change the wait",
            body: (
              <>
                DOL works a single national queue, oldest first, whoever filed
                the case, so a company with four thousand filings waits exactly
                as long as one with three.
              </>
            ),
          },
          {
            head: "The name is a legal entity",
            body: (
              <>
                DOL prints whatever went on the form. A group that files
                through several subsidiaries appears as several rows, and one
                that files everything through a parent appears once, so a rank
                is a rank among printed names rather than among companies.
              </>
            ),
          },
          {
            head: `A median over ${fmt(reliability.decided)} decided cases`,
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
                nothing. Where the queue stands overall is on the{" "}
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
          <h2 className="font-heading text-lg font-black">Your case is with them?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              decision estimator
            </Link>{" "}
            reads your filing month against where DOL is now.
          </p>
        </div>
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
