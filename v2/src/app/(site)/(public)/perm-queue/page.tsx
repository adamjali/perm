import type { Metadata } from "next";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { getDatasetSchema } from "@/lib/structuredData";
import Link from "next/link";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { BacklogWall } from "@/components/queue/BacklogWall";
import { SourceNote } from "@/components/queue/SourceNote";
import { OctoberNote, OCTOBER_2025 } from "@/components/queue/OctoberNote";
import { PendingCensus } from "@/components/queue/PendingCensus";
import { AlphabetEffect } from "@/components/queue/AlphabetEffect";
import { StageLegend } from "@/components/queue/StageBar";
import { groupByStage } from "@/components/queue/stages";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { findFront } from "@/lib/liveQueue";
import { findVolumeAnomalies } from "@/lib/queueAhead";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import { getBacklogCensus } from "@/lib/turso/backlog";
import { getEstimatorData } from "@/lib/turso/estimate";
import { getAlphabet } from "@/lib/turso/alphabet";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * Where DOL's PERM queue stands right now, from a per-case scan.
 *
 * This is the one surface on the site whose figures DOL does not publish. Its
 * quarterly disclosure files carry a decision date on every record and no
 * pending rows at all, so "how much is still waiting, and in which queue" is
 * underivable from them at any level of effort.
 *
 * THREE THINGS THIS PAGE HOLDS TOGETHER, from three different sources, and
 * saying which is which is most of the work:
 *
 *   1. The live per-case scan, which is the only place a pending case exists.
 *   2. DOL's published analyst-review position, which is DOL's own figure and
 *      is quoted with DOL's own as-of stamp.
 *   3. The reconstructed frontier, taken from the canonical estimator rather
 *      than recomputed here, so this page and the timeline calculator cannot
 *      quote different rates for the same thing.
 *
 * NOINDEX WHILE THE MIRROR LOADS. Not merely unlisted: a page carrying
 * provisional counts should not be the answer a search engine gives someone,
 * and the same constant that hides it from the sitemap sets the robots
 * directive, so the two cannot disagree.
 */

// NOT "PERM Queue, Live". 79.8% of pending cases were last re-verified before
// 2026-08-01, so these are the statuses a rolling scan last saw rather than a
// live reading, and the title was the loudest place the page claimed otherwise.
const TITLE = "PERM Queue Backlog";
const DESCRIPTION =
  "How many PERM cases are still undecided in every filing month, which DOL queue they sit in, and where DOL says its analyst review has reached.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-queue" },
  robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-queue",
  },
};

// SIX HOURS, NOT ONE (changed 2026-09-01 on cost evidence). The reasoning for
// an hour was sound about the reader and wrong about the data: this is a queue
// position rather than a live ticker, but the underlying census is rebuilt ONCE
// daily after the full DOL sweep, so twenty-four regenerations a day expressed
// at most one change. Six still bounds staleness below the data's own cadence
// and catches both the 04:10 and 15:40 ET sweeps.
//
// It is not free to regenerate. Vercel bills ISR writes in 8 KB units and this
// page is ~289 KB, so every regeneration is ~37 units. Across this route and
// `[month]` (~39 pages) the hourly window was ~984 regenerations a day, roughly
// a fifth of all ISR writes on the site, for no freshness anyone could observe.
export const revalidate = 21600;

const int = (n: number) => n.toLocaleString("en-US");

export default async function PermQueuePage() {
  const [census, estimator, alphabet] = await Promise.all([
    getBacklogCensus(),
    getEstimatorData(),
    // Its own document and its own writer, so a missing one is a missing
    // panel rather than a missing page.
    getAlphabet().catch(() => null),
  ]);

  const { stages } = groupByStage(census.statuses);
  const front = findFront(
    census.months.map((m) => ({
      month: m.month,
      total: m.total,
      pending: m.pending,
      decided: m.decided,
      decidedPct: m.decidedPct,
    })),
  );
  // Detected with the same function the timeline calculator's chart uses, so
  // the two surfaces cannot disagree about which months are cliffs. It needs
  // `filingMonth`, which is this layer's `month` under another name.
  const anomalies = findVolumeAnomalies(
    census.months.map((m) => ({
      filingMonth: m.month,
      total: m.total,
      pending: m.pending,
      decided: m.decided,
      decidedPct: m.decidedPct,
    })),
  );
  const newest = census.months.at(-1)?.month ?? null;
  const dolMonth = estimator.frontier?.analystQueueMonth ?? null;
  const dolAsOf = estimator.frontier ? formatAsOf(estimator.frontier.asOf) : null;
  const advance = estimator.frontierAdvance;

  // DOL's published position and our independently measured work front are
  // two different measurements of one thing. When they agree that is worth
  // saying out loud, and when they diverge it is worth saying even louder.
  const agrees = dolMonth !== null && front !== null && dolMonth === front.month;

  // The most recent determination month in the reconstructed series, which is
  // the honest denominator for "how fast is this being cleared".
  const lastClearance = estimator.frontierHistory.at(-1) ?? null;

  // A MEASURED DATASET, and this was one of two data pages whose markup
  // did not say so. Five of seven carried `Dataset`; this one and the other
  // did not, which is the kind of gap that is invisible in review because
  // every page looks finished on its own. It is the AEO lever for a data
  // page: it is what tells an answer engine the numbers have a named federal
  // source, a licence and a coverage window rather than being prose.
  const datasetSchema = getDatasetSchema("https://permtracker.app", {
    name: "PERM pending queue census by filing month",
    description:
      "How many PERM cases remain undecided in each filing month, which DOL review queue they sit in, and how far each month has been worked through. Read per case from DOL's own case-status search.",
    url: "https://permtracker.app/perm-queue",
    isBasedOn: "https://flag.dol.gov/processingtimes",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
          From a per-case scan
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Where the PERM queue stands
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          DOL publishes which month it&rsquo;s working and nothing about the
          size of what&rsquo;s behind it. Its disclosure files carry no pending
          rows at all, so a count of what is still waiting cannot be derived
          from them at any level of effort.
        </p>{" "}
        <SourceNote className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70" />
      </header>

      {/* The provisional notice sits ABOVE every figure it qualifies, for the
          same reason a withheld statistic states its reason first: a number
          the reader has already absorbed cannot be un-absorbed by a footnote. */}
      {!MIRROR_COMPLETE ? (
        <p className="mt-8 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base text-foreground/80">
          <WarningIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>{PROVISIONAL_NOTICE}</span>
        </p>
      ) : null}

      <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 [&>*]:min-w-0">
          <Figure
            label="Last seen undecided"
            value={int(census.pending)}
            note={`cases across ${census.months.length} filing months, out of ${int(census.total)} scanned`}
          />
          <Figure
            label="DOL is working"
            value={dolMonth ? (formatMonth(dolMonth) ?? dolMonth) : "Not published"}
            note={
              dolAsOf
                ? `DOL's own analyst review position, as of ${dolAsOf}`
                : "DOL printed no readable priority date for analyst review"
            }
          />
          <Figure
            label="Frontier advance"
            value={advance ? `${advance.rate.toFixed(1)}x` : "Not measurable"}
            note={
              advance
                ? `filing months cleared per calendar month, over the ${advance.pointsUsed} determination months to ${formatMonth(advance.toMonth) ?? advance.toMonth}`
                : "too few determination months to resolve a rate"
            }
          />
        </div>{" "}

        <div className="mt-8 max-w-3xl space-y-3 border-t-2 border-border pt-6 text-base leading-relaxed text-foreground/80">
          {front ? (
            <p>
              The oldest filing month that isn&rsquo;t substantially decided is{" "}
              <b className="font-bold">{formatMonth(front.month)}</b>, which is{" "}
              {front.decidedPct !== null ? `${front.decidedPct.toFixed(0)}% decided ` : ""}
              and still holds {int(front.pendingHere)} undecided cases.{" "}
              {newest ? (
                <>
                  It sits {front.monthsBack}{" "}
                  {front.monthsBack === 1 ? "month" : "months"} behind{" "}
                  {formatMonth(newest)}, the newest month with filings.
                </>
              ) : null}
            </p>
          ) : null}

          {agrees ? (
            <p>
              That&rsquo;s the same month DOL publishes as its analyst-review
              position, arrived at from the opposite direction: DOL states where
              it is, and this scan finds the oldest month that hasn&rsquo;t
              cleared. Two measurements, one answer.
            </p>
          ) : dolMonth !== null && front !== null ? (
            <p>
              DOL publishes {formatMonth(dolMonth)} as its analyst-review
              position, which doesn&rsquo;t match the{" "}
              {formatMonth(front.month)} this scan measures. Both figures are
              shown as they are. Neither has been adjusted towards the other.
            </p>
          ) : null}

          {advance ? (
            <p>
              Over the {advance.pointsUsed} determination months to{" "}
              {formatMonth(advance.toMonth) ?? advance.toMonth}, the median
              filing date on DOL&rsquo;s determinations moved forward{" "}
              {advance.rate.toFixed(1)} months for every calendar month that
              passed. Anything above 1.0 means DOL was working through filing
              dates faster than new ones arrived.
              {advance.slowest !== null && advance.fastest !== null ? (
                <>
                  {" "}
                  Across the whole series that rate has run between{" "}
                  {`${advance.slowest.toFixed(2)}x`} and{" "}
                  {`${advance.fastest.toFixed(2)}x`}, which is the reason it
                  isn&rsquo;t a rate anyone should plan around.
                </>
              ) : null}
            </p>
          ) : null}

          {lastClearance ? (
            <p>
              DOL issued {int(lastClearance.decisions)} determinations in{" "}
              {formatMonth(lastClearance.decisionMonth)}, the last full month in
              its disclosure window, against {int(census.pending)} still
              undecided. Those two figures don&rsquo;t get divided into a wait.
              New applications keep arriving, DOL reprioritises, and one
              month&rsquo;s output is not a rate. For the envelope a case
              actually sits inside, the{" "}
              <Link
                href="/tools/perm-timeline-calculator"
                className="font-bold underline underline-offset-2 hover:text-primary"
              >
                timeline calculator
              </Link>{" "}
              works from the percentile spread of real decided cases.
            </p>
          ) : null}
        </div>
      </section>{" "}

      <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black sm:text-3xl">
          What those {int(census.pending)} cases were doing
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
          A waiting case is in one of three places, and they answer different
          questions. Analyst review moves in filing order, so the month is the
          whole story. The other two don&rsquo;t, which is the honest answer
          when DOL has passed your month and you still have nothing.
        </p>{" "}

        <StageLegend stages={stages} className="mt-6" />

        <div className="mt-8 border-t-2 border-border pt-6">
          <PendingCensus
            stages={stages}
            caption="Every DOL status a pending PERM case was last seen in, grouped by queue"
          />
        </div>
      </section>{" "}

      <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black sm:text-3xl">
          The wall, by filing month
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
          Bar length is the number of cases still waiting, on one scale across
          every month, so the shape is the backlog&rsquo;s real shape. The
          colours split each month across the three queues. Any month opens its
          own page.
        </p>{" "}

        <div className="mt-6">
          <BacklogWall
            months={census.months}
            frontierMonth={dolMonth}
            frontierAsOf={dolAsOf}
            frontMonth={front?.month ?? null}
            anomalies={anomalies}
            noteAnchors={{ [OCTOBER_2025.month]: OCTOBER_2025.anchorId }}
          />
        </div>
      </section>{" "}

      {alphabet ? (
        <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-2xl font-black sm:text-3xl">
            Your employer&rsquo;s first letter, and what it is worth
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
            Within a filing month DOL works alphabetically by employer, so an
            A company is decided before a Z company that filed the same month.
            Every estimator uses that; none publishes its size. Measured:{" "}
            <b>
              the whole alphabet is about {Math.round(alphabet.spreadDays)} days
            </b>
            , and in {alphabet.monthsReversed} of {alphabet.monthsMeasured}{" "}
            filing months the back half was decided <b>faster</b> than the
            front. Your filing month is worth far more than your initial.
          </p>{" "}

          <div className="mt-8 border-t-2 border-border pt-6">
            <AlphabetEffect data={alphabet} />
          </div>
        </section>
      ) : null}{" "}

      <div className="mt-6">
        <OctoberNote />
      </div>{" "}

      <PageBasics page="perm-queue" />{" "}
      <DataProvenance
        datasets={["perm-case-status", "processing-times", "perm-cases"]}
        className="mt-8 border-t-2 border-border pt-4"
      />
    </div>
  );
}

/** One headline figure: its label, the number, and what the number counts. */
function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
        {label}
      </p>{" "}
      <p className="mt-1 font-heading text-4xl font-black leading-none tabular-nums">
        {value}
      </p>{" "}
      <p className="mt-2 text-sm leading-snug text-foreground/70">{note}</p>
    </div>
  );
}
