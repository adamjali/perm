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
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import {
  DisclosureNote,
  EntityDataGap,
  LimitsPanel,
  MIN_DECIDED_FOR_MEDIAN,
  MIN_DECIDED_FOR_RATE,
  PeerList,
  RankLadder,
  ReliabilityBand,
  entityTitle,
  rateReliability,
} from "@/components/tools/EntityContext";

export const revalidate = 3600;

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
}

/**
 * A missing row and an unreachable backend are different answers.
 *
 * Collapsing them into `null` means one Convex blip 404s a live page, and
 * because these routes carry `revalidate`, Next caches that 404 for an hour.
 * A slug with no row is genuinely gone and gets `notFound()`; a query that
 * threw gets an empty state and a 200, so the page keeps its place.
 */
type SubjectResult =
  | { status: "found"; row: Subject }
  | { status: "missing" }
  | { status: "unavailable" };

async function loadSubject(slug: string): Promise<SubjectResult> {
  try {
    const row = await fetchQuery(api.permEntities.getBySlug, { kind: KIND, slug });
    if (!row) return { status: "missing" };
    return {
      status: "found",
      row: {
        slug: row.slug,
        name: row.name,
        rank: row.rank,
        total: row.total,
        certified: row.certified,
        denied: row.denied,
        medianDays: row.medianDays,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
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
  const rows = await fetchQuery(api.permEntities.listByKind, {
    kind: KIND,
    limit: 100,
  }).catch(() => []);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadSubject(slug);
  if (result.status !== "found") return { title: "Employer not found" };
  const row = result.row;
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
    // A legal entity name can run past what Google shows on its own
    // ("VERIZON COMMUNICATIONS INC AND ALL ITS SUBSIDIARIES AND AFFILIATES"),
    // so `entityTitle` drops the brand suffix, then the qualifier, rather than
    // crowding out the name. It measures the RENDERED length: the old test
    // looked at the base and let 15% of these render past 60.
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

export default async function EmployerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadSubject(slug);
  if (result.status === "missing") notFound();
  // Stored and searchable is not the same as having a page. Below the
  // threshold the page would say "one case, certified" and nothing more, and
  // 65,000 of those is a doorway-page pattern rather than a directory. The
  // index tables render these rows unlinked, and the sitemap omits them, so
  // nothing points here.
  if (result.status === "found" && !hasOwnPage(result.row)) notFound();

  const row = result.status === "found" ? result.row : null;

  // The three context reads run together. `fieldDistribution` takes the same
  // arguments on every page of this kind, so Convex's query cache answers all
  // 12,240 of them from one execution until the next quarterly ingest.
  const [stats, dist, near] = await Promise.all([
    fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null),
    fetchQuery(api.permEntities.fieldDistribution, {
      kind: KIND,
      minDecided: MIN_DECIDED_FOR_RATE,
    }).catch(() => null),
    row
      ? fetchQuery(api.permEntities.comparables, {
          kind: KIND,
          rank: row.rank,
          span: 60,
          limit: 6,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist?.kindTotal ?? 0;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${row?.name ?? slug} PERM labor certification filings`,
    description: `PERM filing record for ${row?.name ?? slug} from DOL disclosure data.`,
    url: `https://permtracker.app${BASE}/${slug}`,
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  };

  if (!row) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
        <DataNav active="employers" />
        <div className="pt-10 sm:pt-12" />
        <header className="max-w-3xl">
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
            This sponsor&apos;s figures are unavailable
          </h1>
        </header>
        <div className="mt-8">
          <EntityDataGap
            what="This employer"
            backHref={BASE}
            backLabel="the full sponsor ranking"
          />
        </div>
      </div>
    );
  }

  const reliability = rateReliability(row.certified, row.denied, baselineDenialPct);
  const inCohort = reliability.tier !== "withheld";
  // The card and the drawing read the same number, so they cannot disagree:
  // this is the median of the comparable cohort's own medians, which is
  // exactly the distribution the figure below plots.
  const fieldDays = median(dist?.medianDays ?? []);
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
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
          {[
            {
              k: "Filings",
              v: fmt(row.total),
              sub: kindTotal > 0 ? `#${fmt(row.rank)} of ${fmt(kindTotal)}` : "",
            },
            {
              k: "Certified",
              v: fmt(row.certified),
              sub: `${fmt(row.denied)} denied`,
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

      {/* The page's own question, drawn: where does this sponsor sit in the
          field? A stat card states a number; only the distribution says
          whether that number is unusual. The population is every sponsor whose
          case count can carry a rate, which is the only denominator these two
          measures can honestly be read against. */}
      {dist && dist.cohort >= 8 ? (
        <FigurePlate
          n="01"
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
                : "The scan behind this cohort did not reach past the last qualifying sponsor, so read it as the busiest part of the field rather than all of it. "}
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

      {near ? (
        <RankLadder
          rank={row.rank}
          kindTotal={kindTotal}
          above={near.above}
          below={near.below}
          hrefBase={BASE}
          unit="filings"
          className="mt-10"
        />
      ) : null}

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
        items={near?.peers ?? []}
        hrefBase={BASE}
        unit="filings"
        className="mt-12"
      />

      <LimitsPanel
        className="mt-12"
        items={[
          {
            head: "Volume isn't quality, and it isn't speed",
            body: (
              <>
                A big sponsor is a practised one, nothing more. DOL works a
                single national queue, oldest first, whoever filed the case, so
                a company with four thousand filings waits exactly as long as
                one with three.
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
                  ? "That is a middle of a handful, and it moves entirely with which months those few cases were filed in."
                  : "It says when this sponsor's cases were filed at least as much as it says anything about the sponsor, because the queue is national and first in, first out."}
              </>
            ),
          },
          {
            head: "Nothing here is pending",
            body: (
              <>
                Every case in DOL&apos;s disclosure files carries a decision
                date, so a case still waiting appears in none of these counts.
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
            reads your filing month against where DOL is now, which is the part
            that actually decides your wait.
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
    </div>
  );
}
