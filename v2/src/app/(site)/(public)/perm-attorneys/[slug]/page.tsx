/**
 * One law firm's PERM record.
 *
 * The same treatment as the employer pages, for the half of the audience the
 * rival product does not serve. An attorney gets a public benchmark of their
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
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { FieldPosition } from "@/components/tools/FieldPosition";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { US_STATE_NAMES } from "@/lib/usStateNames";
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
import { getDisclosureStats } from "@/lib/turso/publicData";
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
export const revalidate = 86400;

const KIND = "attorney" as const;
const BASE = "/perm-attorneys";
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
async function loadSubject(slug: string): Promise<Subject | null> {
  const row = await getBySlug(KIND, slug);
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    total: row.total,
    certified: row.certified,
    denied: row.denied,
    medianDays: row.medianDays,
    // DOL's cell is unusable on 16 of 3,208 firms, and "" is not a state.
    state: row.state ? row.state : null,
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

function stateName(code: string | null): string | null {
  if (!code) return null;
  return US_STATE_NAMES[code] ?? code;
}

export async function generateStaticParams() {
  // Only the head is prerendered; the rest generate on first request and cache
  // for an hour. Read from the entity TABLE, so a prerendered slug is one
  // `getBySlug` can find - the aggregate document slugs its own copy of the
  // top 250 separately and the two are not guaranteed to agree.
  const rows = await listByKind(KIND, 100);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadSubject(slug);
  if (!row) return { title: "Law firm not found" };
  const reliability = rateReliability(
    row.certified,
    row.denied,
    FALLBACK_BASELINE_DENIAL_PCT,
  );
  const { title, absolute } = entityTitle(row.name, ["PERM Cases"]);
  // The rate is left out whenever the page itself is withholding it. A snippet
  // reading "100.0% approved" over three cases makes, in the one place nobody
  // can see the warning beside it, exactly the claim the page refuses to make.
  const ratePart =
    reliability.ratePct != null ? `, ${reliability.ratePct.toFixed(1)}% approved` : "";
  // The source clause is dropped when the name has already used the space, so
  // a long firm name cannot push the description past what the SERP shows.
  const head = `${row.name}: ${fmt(row.total)} PERM cases${ratePart}, ranked ${fmt(row.rank)} by volume`;
  const description =
    head.length <= 120 ? `${head}, from DOL's own disclosure files.` : `${head}.`;
  return {
    // Thin-page defense: a sub-floor entity page exists for people but is
    // not offered to the index. The sitemap already omits it.
    ...(row && !hasOwnPage(row) ? { robots: { index: false, follow: true } } : {}),
    // A firm's filed name can run past what Google shows on its own, so
    // `entityTitle` drops the brand suffix, then the qualifier, rather than
    // crowding out the name. It measures the RENDERED length.
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

export default async function AttorneyPage({
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

  // `fieldDistribution` takes the same arguments on every firm page and
  // memoises on them, so all 3,736 share one cohort read. The peer window is
  // wide because the state filter thins it hard: California holds 604 firms
  // and Wyoming a handful.
  const [stats, dist, near] = await Promise.all([
    getDisclosureStats(),
    fieldDistribution(KIND, MIN_DECIDED_FOR_RATE),
    comparables({
      kind: KIND,
      rank: row.rank,
      span: row.state ? 400 : 60,
      limit: 6,
      ...(row.state ? { state: row.state } : {}),
    }),
  ]);

  const baselineDenialPct = stats?.risk?.baseline.denialRate ?? FALLBACK_BASELINE_DENIAL_PCT;
  const kindTotal = dist.kindTotal;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${row.name} PERM labor certification cases`,
    description: `PERM case record for ${row.name} from DOL disclosure data.`,
    url: `https://permtracker.app${BASE}/${slug}`,
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  };

  const reliability = rateReliability(row.certified, row.denied, baselineDenialPct);
  const inCohort = reliability.tier !== "withheld";
  // The card and the drawing read one number: the median of the comparable
  // cohort's own medians, which is the distribution the figure plots.
  const fieldDays = median(dist.medianDays);
  const daysDelta =
    row.medianDays != null && fieldDays != null ? row.medianDays - fieldDays : null;
  const thinMedian = reliability.decided < MIN_DECIDED_FOR_MEDIAN;
  const where = stateName(row.state);
  const peers = near.peers;
  // The query falls back to volume peers when a state matched nothing, so the
  // heading has to read what came BACK rather than what was asked for. Calling
  // six firms from anywhere "other Wyoming firms" is a caption that lies.
  const peersAreLocal = near.matched === "facet" && where != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="attorneys" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          <Link
            href={BASE}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All firms
          </Link>{" "}
          · #{fmt(row.rank)}
          {kindTotal > 0 ? ` of ${fmt(kindTotal)}` : ""} by volume
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {fmt(row.total)} PERM cases in DOL&apos;s current disclosure window,{" "}
          {fmt(row.certified)} certified and {fmt(row.denied)} denied.
          {where ? ` Filed from ${where}.` : ""} Firm name as filed.
        </p>
      </header>

      {/* The doubt goes ABOVE the figures, so a number computed from thin
          input cannot read as more authoritative than the doubt about it. */}
      <ReliabilityBand
        reliability={reliability}
        baselineDenialPct={baselineDenialPct}
        subject="firm"
        unit="cases"
        className="mt-8"
      />

      <section className="pop mt-8">
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
          {[
            {
              k: "Cases",
              v: fmt(row.total),
              sub: kindTotal > 0 ? `#${fmt(row.rank)} of ${fmt(kindTotal)}` : "",
            },
            { k: "Certified", v: fmt(row.certified), sub: `${fmt(row.denied)} denied` },
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
          subject={`${fmt(dist.cohort)} firms with ${dist.minDecided}+ decided`}
          caption={
            <>
              Each bar counts firms at that value. Firms with fewer than{" "}
              {dist.minDecided} decided cases are left out of the population
              rather than plotted, because a rate over a handful of cases lands
              wherever the handful landed.{" "}
              {inCohort
                ? "The line marks this one. Approval rates pile up against 100%, so read the ties in the label rather than the position of the line."
                : `This firm has ${fmt(reliability.decided)} decided cases, so its median days is marked but left unranked, and no approval rate is drawn at all.`}{" "}
              {dist.complete
                ? ""
                : "The scan behind this cohort didn’t reach past the last qualifying firm, so read it as the busiest part of the field rather than all of it. "}
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

      <LimitsPanel
        className="mt-12"
        items={[
          {
            head: "One practice, several spellings",
            body: (
              <>
                DOL prints the firm name as typed on the form. Setting
                punctuation and P.C. style aside, 87 names on this list collapse
                into fewer practices, and two rows for one firm can sit
                hundreds of ranks apart, so a rank is a rank among printed
                names rather than among firms.
              </>
            ),
          },
          {
            head: "The approval rate barely separates firms",
            body: (
              <>
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
            head: `A median over ${fmt(reliability.decided)} decided cases`,
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
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">They&apos;re handling your case?</h2>{" "}
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
    </div>
  );
}
