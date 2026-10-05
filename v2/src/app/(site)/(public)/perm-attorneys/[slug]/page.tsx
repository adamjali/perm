/**
 * One law firm's PERM record.
 *
 * The same treatment as the employer pages, for the practitioners in the
 * audience. An attorney gets a public benchmark of their
 * own practice against the field; a beneficiary gets to see whether the firm
 * on their case has done this before.
 *
 * Two things are different here and both come from the data. Firms carry a
 * state, so the peer set can be the practices filing at a similar rate FROM
 * THE SAME STATE, which is the comparison an attorney actually wants. And the
 * approval rate separates firms less than it looks: over the 896 firms with
 * enough decided cases to carry a rate, the median is 99.1% and 359 of them
 * have a spotless file, so a percentile on that axis is mostly a count of
 * ties. `FieldPosition` reports ties separately for exactly that reason.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { hasOwnPage } from "@/lib/entityPayload";
import { notFound, permanentRedirect } from "next/navigation";
import { firstThatFits } from "@/lib/describe";
import { formatInt } from "@/lib/format";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { US_STATE_NAMES } from "@/lib/usStateNames";
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
  UnpublishedFilingsNote,
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
import { getDisclosureStats, getFreshness } from "@/lib/turso/publicData";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FirmPrograms } from "@/components/entities/FirmPrograms";
import { getFirmPrograms } from "@/lib/turso/firmPrograms";
import { api } from "@convex/_generated/api";
import { queryStatic } from "@/lib/convexStatic";
import { FirmProfileBlock } from "@/components/entities/FirmProfileBlock";
import { FirmClaimPanel } from "@/components/entities/FirmClaimPanel";
import { DebarmentNotice } from "@/components/entities/DebarmentNotice";
import { debarmentsForSlug } from "@/lib/turso/debarments";
import { NameSpellings } from "@/components/entities/NameSpellings";
import { SizeBandNote } from "@/components/entities/SizeBandNote";
import { OccupationMix, PartyMix, StateMix } from "@/components/entities/FilingMakeup";
import {
  absorbedCount,
  entityFacets,
  nameVariants,
  resolveEntity,
  sizeBand,
} from "@/lib/turso/entityDetail";
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
export const revalidate = 2592000;

const KIND = "attorney" as const;
const BASE = "/perm-attorneys";

interface Subject {
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
  // A spelling that merged into another page answers 308 to it. This once
  // rendered the merged page with a canonical, because a loading boundary
  // above the segment turned any redirect into a 200; that boundary is gone.
  if (found.viaAlias) permanentRedirect(`${BASE}/${found.canonicalSlug}`);
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
    // DOL's cell is unusable on 16 of 3,208 firms, and "" is not a state.
    state: row.state ? row.state : null,
  } };
}

function stateName(code: string | null): string | null {
  if (!code) return null;
  return US_STATE_NAMES[code] ?? code;
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
  if (!found) notFound();
  // A retired spelling has already redirected in loadSubject, so the slug
  // here is the surviving one and the canonical names it.
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
    `PERM Cases: ${formatInt(row.total)} Filed`,
    "PERM Cases",
  ]);
  // The rate is left out whenever the page itself is withholding it. A snippet
  // reading "100.0% approved" over three cases makes, in the one place nobody
  // can see the warning beside it, exactly the claim the page refuses to make.
  const ratePart =
    reliability.ratePct != null ? `, ${reliability.ratePct.toFixed(1)}% approved` : "";
  // The source clause is dropped when the name has already used the space, so
  // a long firm name cannot push the description past what the SERP shows.
  //
  // The richest that fits 155 (lib/describe). No wage: the page itself says a
  // firm's median offered wage measures its clients' job mix, not the firm.
  const head = `${row.name}: ${formatInt(row.total)} PERM case${row.total === 1 ? "" : "s"}${ratePart}, ranked ${formatInt(row.rank)} by volume`;
  const description = firstThatFits([
    `${head}. The jobs it files for, outcomes and how it ranks, from DOL's own records.`,
    `${head}, from DOL's own disclosure files.`,
    `${head}.`,
  ]);
  // A firm's filed name can run past what Google shows on its own, so
  // `entityTitle` drops the brand suffix, then the qualifier, rather than
  // crowding out the name. It measures the RENDERED length.
  return entityMetadata({
    title,
    absolute,
    description,
    path: `${BASE}/${found.canonicalSlug}`,
    noindex: !hasOwnPage(row),
  });
}

export default async function AttorneyPage({
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

  // `fieldDistribution` takes the same arguments on every firm page and
  // memoises on them, so all 3,736 share one cohort read. The peer window is
  // wide because the state filter thins it hard: California holds 604 firms
  // and Wyoming a handful.
  const [stats, dist, near, facets, variants, absorbed, freshness, debarments, programs, firmProfile] = await Promise.all([
    getDisclosureStats(),
    fieldDistribution(KIND, MIN_DECIDED_FOR_RATE),
    comparables({
      kind: KIND,
      rank: row.rank,
      span: row.state ? 400 : 60,
      limit: 6,
      ...(row.state ? { state: row.state } : {}),
    }),
    entityFacets(KIND, canonicalSlug),
    nameVariants(KIND, canonicalSlug),
    absorbedCount(KIND, canonicalSlug),
    // An 11-row table, React-cached, on a page that regenerates daily. It is
    // here only so the Dataset can state WHEN its figures were last true.
    getFreshness(),
    debarmentsForSlug(canonicalSlug).catch(() => []),
    // Its H-1B LCAs and wage requests, by every printed spelling the nightly
    // firm map assigns this page.
    getFirmPrograms(canonicalSlug).catch(() => null),
    // What a firm that claimed this page says about itself (convex/firmClaims.ts),
    // read on the page's own window; a profile change refreshes the page through
    // /api/revalidate-firm. A failed read shows no block rather than an error.
    queryStatic(api.firmClaims.publishedProfile, { slug: canonicalSlug }, revalidate).catch(() => null),
  ]);
  const band = await sizeBand(KIND, row.rank);

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;

  const schema = entityJsonLd({
    path: `${BASE}/${slug}`,
    name: row.name,
    dataset: {
      name: `${row.name} PERM labor certification cases`,
      description: `PERM case record for ${row.name} from DOL disclosure data.`,
      variableMeasured: ["cases", "certified", "denied", "median days to decision"],
    },
    freshness,
  });

  const standing = entityStanding(row, dist, baselineDenialPct);
  const { reliability, thinMedian } = standing;
  // THE LIMITS PANEL CARRIES THIS FIRM'S OWN FIGURES, NOT A TEMPLATE.
  // A template caveat makes hundreds of words of every attorney page
  // byte-identical to every other one, and Google's crawl-budget guidance
  // names duplicate content as the lever for entity URLs left at "Discovered
  // - currently not indexed". Each caveat below leads
  // with the subject's own number, which removes no disclosure and makes the
  // caveat more useful: "their rate is 99.2%, and the median is above 99" tells
  // a reader something the generic sentence never did.
  const topOcc = facets.occupation?.[0];
  const where = stateName(row.state);
  const peers = near.peers;
  // The query falls back to volume peers when a state matched nothing, so the
  // heading has to read what came BACK rather than what was asked for. Calling
  // six firms from anywhere "other Wyoming firms" is a caption that lies.
  const peersAreLocal = near.matched === "facet" && where != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <h1 translate="no" className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {formatInt(row.total)} PERM cases in DOL&apos;s current disclosure window,{" "}
          {formatInt(row.certified)} certified and {formatInt(row.denied)} denied.
          {where ? ` Filed from ${where}.` : ""} Firm name as filed.
        </p>
      </header>

      {/* The doubt goes ABOVE the figures, so a number computed from thin
          input cannot read as more authoritative than the doubt about it. */}
      <DebarmentNotice rows={debarments} pageName={row.name} today={new Date().toISOString().slice(0, 10)} />{" "}
      <ReliabilityBand
        reliability={reliability}
        baselineDenialPct={baselineDenialPct}
        subject="firm"
        unit="cases"
        className="mt-8"
      />

      <section className="pop mt-8">
        <EntityStatCards
          cards={[
            volumeCard("Cases", row, kindTotal),
            certifiedCard(row),
            approvalCard(reliability, baselineDenialPct),
            medianWageCard(row.medianAnnualWage),
            medianDaysCard(row.medianDays, standing),
          ]}
        />
      </section>

      <FieldPositionPlate
        n="01"
        singular="firm"
        plural="firms"
        dist={dist}
        standing={standing}
        medianDays={row.medianDays}
        lead={
          <>
            Each bar counts firms at that value. Firms with fewer than{" "}
            {dist.minDecided} decided cases are left out of the population
            rather than plotted, because a rate over a handful of cases lands
            wherever the handful landed.
          </>
        }
        inCohortNote="The line marks this one. Approval rates pile up against 100%, so read the ties in the label rather than the position of the line."
        outOfCohortNote={`This firm has ${formatInt(reliability.decided)} decided cases, so its median days is marked but left unranked, and no approval rate is drawn at all.`}
      />

      {/* The client list is the module a firm page has and an employer page
          does not. "Who do they file for" is the question an attorney
          benchmarking a competitor and a beneficiary checking their own firm
          both arrive with, and it is a fact rather than an opinion. */}
      {facets.employer || facets.occupation || facets.state ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-black">
            The practice, in their own filings
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base text-foreground/70">
            Who they file for, what the jobs are, and where the work sits. All
            of it is the employer, occupation and worksite named on their own
            applications.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
            {facets.employer ? (
              <PartyMix
                rows={facets.employer}
                total={row.total}
                title="Who they file for"
                note="The employers named on the most applications from this firm."
                hrefBase="/perm-employers"
              />
            ) : null}
            {facets.occupation ? (
              <OccupationMix rows={facets.occupation} total={row.total} />
            ) : null}
            {facets.state ? (
              <StateMix rows={facets.state} total={row.total} className="lg:col-span-2" />
            ) : null}
          </div>
        </section>
      ) : null}

      {band ? (
        <SizeBandNote
          band={band}
          subjectMedianDays={row.medianDays}
          subject="firms"
          unit="cases"
          className="mt-10"
        />
      ) : null}

      <FirmPrograms name={row.name} data={programs} />{" "}
      <FirmProfileBlock firmName={row.name} profile={firmProfile} />{" "}

      <RankLadder
        rank={row.rank}
        kindTotal={kindTotal}
        above={near.above}
        below={near.below}
        hrefBase={BASE}
        unit="cases"
        className="mt-10"
      />

      <PeerList
        heading={
          peersAreLocal ? `Other ${where} firms at this volume` : "Firms at this volume"
        }
        note={
          peersAreLocal ? (
            <>
              Practices filing from {where} at a similar rate, taken from the
              ranks nearest this one. State is the address on the filing, so a
              national firm appears under whichever office signed the form.
            </>
          ) : (
            <>
              The firms ranked either side of this one, which is the same as
              saying they file about as many PERM cases a year.{" "}
              {where
                ? `No other ${where} firm files at a comparable rate, so these come from anywhere.`
                : "DOL's cell for this firm's state was unusable, so these are volume peers from anywhere."}
            </>
          )
        }
        items={peers}
        hrefBase={BASE}
        unit="cases"
        className="mt-12"
      />

      <NameSpellings
        variants={variants}
        absorbed={absorbed}
        subject="firm"
        hrefBase={BASE}
        rank={row.rank}
        className="mt-12"
      />

      <LimitsPanel
        className="mt-12"
        items={[
          wageIsTheJobLimit({ topOccupation: topOcc, total: row.total, filers: "their clients" }),
          {
            head: "Nothing here is waiting",
            body: (
              <>
                All {formatInt(row.total)} of the cases on this page carry a
                decision date, because every row in DOL&apos;s disclosure files
                does, so a case still in the queue is in none of these counts.
                The live tracker that does see pending cases records the
                employer on each one and not the firm, so a firm&apos;s
                current queue cannot be broken out at all. Where the queue
                stands overall is on the{" "}
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
          {
            head: "The approval rate barely separates firms",
            body: (
              <>
                {reliability.ratePct !== null ? (
                  <>This firm is at {reliability.ratePct.toFixed(1)}%. </>
                ) : null}
                Across every firm with enough decided cases to carry a rate the
                median is above 99%, and hundreds have no denials at all.
                Placing near the top of that axis mostly means being level with
                the rest of it.
              </>
            ),
          },
          {
            head: "None of this measures the advice",
            body: (
              <>
                It measures filings that DOL approved or denied. Whether the
                case was worth filing, what it cost, and how the firm handled
                an audit aren’t in these files.
              </>
            ),
          },
          {
            head: `A median over ${formatInt(reliability.decided)} decided cases`,
            body: (
              <>
                {thinMedian
                  ? "That’s a middle of a handful, and it moves with which months those few cases were filed in rather than with the firm."
                  : "DOL works one national queue, oldest first, whoever filed the case, so this says when the firm's cases were filed at least as much as anything about the firm."}{" "}
                Where the queue stands today is on the{" "}
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
        <DecisionEstimatorCard heading="They're handling your case?" />
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Running the practice?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link
              href={BASE}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              full ranking
            </Link>{" "}
            sorts every column, and the{" "}
            <Link
              href="/signup"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              free tracker
            </Link>{" "}
            carries the deadlines on every case.
          </p>
        </div>
      </section>
      <FirmClaimPanel slug={canonicalSlug} firmName={row.name} claimed={firmProfile != null} />{" "}
      <UnpublishedFilingsNote subject="firm" />{" "}
      <DataProvenance
        datasets={[
          "perm-cases",
          "entities",
          ...(programs?.lca ? ["lca-disclosure"] : []),
          ...(programs?.pwd ? ["pw-disclosure"] : []),
        ]}
      />
    </div>
  );
}
