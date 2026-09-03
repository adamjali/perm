/**
 * PERM denial rates, by the factors DOL's own files record.
 *
 * The rival ships a letter-graded "risk score" from an additive model whose
 * factors it assumes independent, and has it switched off in production. We
 * publish the measured rates themselves and say what they can and cannot
 * support: a rate for a group you belong to is not a probability for your
 * case, and this page says so where the reader is looking.
 *
 * Every cut on the page can be read as bars or as exact figures, and the two
 * rankings that run over hundreds of groups — occupation and state — carry a
 * population floor, because ranking by a rate without one puts the four-case
 * groups at the top and calls them the riskiest thing in the data.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { getDatasetSchema } from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { socGroup } from "@/lib/socGroups";
import { stateName } from "@/lib/usStateNames";
import { RateViews, RankedRateViews, type RateRow } from "@/components/tools/RateBars";
import { DenialReach } from "@/components/tools/DenialReach";
import { CENSUS_REGION } from "@/components/tools/USStateMap";
import { FreshnessDots, InsightLede } from "@/components/tools/Insight";
import { getDisclosureStats } from "@/lib/turso/publicData";
import {
  getWageDenialBands,
  isMonotonic,
  peakBand,
  type WageBand,
} from "@/lib/turso/wageBands";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
const TITLE = "PERM Denial Rates";
// 147 characters. Anything past ~155 is truncated mid-sentence in the SERP,
// and the entity-escaped source string is six characters per apostrophe, so
// measure the UNESCAPED text.
const DESCRIPTION =
  "PERM denial rates measured from DOL's own files: by offered wage, by fiscal year, by occupation, by state, and by the factors the ETA-9089 records.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-denial-risk" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-denial-risk",
  },
};

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

const FLAG_LABELS: Record<
  string,
  { label: string; clause: string; what: string }
> = {
  layoff: {
    label: "Employer had a layoff",
    clause: "the employer had a layoff",
    what: "A layoff in the same or a related occupation in the six months before filing (Form 9089, Section G, Item 12).",
  },
  ownership: {
    label: "Worker has an ownership interest",
    clause: "the worker holds an ownership interest in the employer",
    what: "The foreign worker holds an ownership interest in the employer (Section A, Item 16).",
  },
  partTime: {
    label: "Position isn’t full time",
    clause: "the position isn’t full time",
    what: "The job opportunity isn’t full time (Section G, Item 1).",
  },
};

/** Denial rate over decided cases, to two decimals. Null when nothing decided. */
function denialRate(denied: number, decided: number): number | null {
  return decided > 0 ? Number(((denied / decided) * 100).toFixed(2)) : null;
}

export default async function PermDenialRiskPage() {
  const [stats, wageBands] = await Promise.all([
    getDisclosureStats(),
    getWageDenialBands(),
  ]);
  const risk = stats?.risk ?? null;
  const baseline = risk?.baseline ?? null;
  const sourceWindow = stats?.sourceFiles?.length
    ? stats.sourceFiles
        .map((f) => f.replace(/^PERM_Disclosure_Data_/, "").replace(/\.xlsx$/, ""))
        .join(" + ")
    : "the current window";
  // The single strongest correlate, named. A page that makes the reader find
  // the biggest number themselves has not finished its job.
  const topFlag =
    risk?.byFlag && risk.byFlag.length > 0
      ? [...risk.byFlag].sort((a, b) => b.denialRate - a.denialRate)[0]!
      : null;
  const topMultiple =
    topFlag && baseline && baseline.denialRate > 0
      ? (() => {
          const x = topFlag.denialRate / baseline.denialRate;
          return x >= 10 ? `${Math.round(x)}x` : `${x.toFixed(1)}x`;
        })()
      : "";

  // REACH, the half a rate leaves out. Every public risk tool ranks these
  // factors by rate, which puts the rarest one first: a part-time position is
  // denied 54% of the time and appears in one decided case in 900. Summing the
  // numerators is what makes that visible, and it is arithmetic on figures
  // already on the page rather than a new claim.
  const flagDenied = (risk?.byFlag ?? []).reduce((n, r) => n + r.denied, 0);
  const flagShare =
    baseline && baseline.denied > 0 ? (flagDenied / baseline.denied) * 100 : null;
  // The wage band carrying the most denials, named rather than left to the
  // reader to find. Chosen by measurement, so it follows the data if the next
  // ingest moves it.
  const wageForReach = wageBands?.fine ?? risk?.byWage ?? [];
  const topWageByShare =
    wageForReach.length > 0
      ? [...wageForReach].sort((a, b) => b.denied - a.denied)[0]!
      : null;
  const topWageShare =
    topWageByShare && baseline && baseline.denied > 0
      ? (topWageByShare.denied / baseline.denied) * 100
      : null;
  const topWageReach =
    topWageByShare && baseline && baseline.decided > 0
      ? (topWageByShare.decided / baseline.decided) * 100
      : null;
  // A factor whose rate sits BELOW the field is worth naming: it is the one
  // result a reader would never guess, and a page that only shows elevated
  // rates quietly implies every listed factor is a hazard.
  const protectiveFlag =
    risk?.byFlag && baseline
      ? (risk.byFlag.find((r) => r.denialRate < baseline.denialRate) ?? null)
      : null;
  // THE WAGE BANDS, AND WHY THIS PAGE SHOWS ELEVEN AND NOT FIVE.
  //
  // At the ingest's five wide bands the data appears to say the middle of the
  // wage range is the most-denied part of it. It does not. That shape is
  // produced by averaging: $0k-$40k at 4.96%, $40k-$50k at 7.26% and
  // $50k-$60k at 4.41% all become one "Under $60k" band at 5.22%, which puts
  // the real maximum inside a bucket that reports a lower number than the
  // peak it contains. A finding that changes when an analyst moves a boundary
  // is a fact about the boundary.
  //
  // So the page shows the finer bands and states the bin sensitivity out
  // loud. What survives both cuts is the broad decline, and that is what the
  // copy claims. Nothing here explains the bumps: wage, occupation and
  // employer are entangled, which is the same reason this page refuses to
  // blend factors into a score.
  const fineWage: WageBand[] = wageBands?.fine ?? [];
  const wagePeak = wageBands ? peakBand(wageBands) : null;
  const wageMonotonic = fineWage.length > 0 ? isMonotonic(fineWage) : true;
  const wageEnds = (() => {
    const rated = fineWage.filter((b) => b.denialRate !== null && b.denialRate > 0);
    if (rated.length < 2) return null;
    const first = rated[0]!;
    const last = rated[rated.length - 1]!;
    const lowest = rated.reduce((a, b) => ((b.denialRate ?? 0) < (a.denialRate ?? 0) ? b : a));
    return {
      first,
      last,
      lowest,
      // Only say "turns back up at the top" when the top band actually is
      // higher than the minimum. On the current data it is, by a quarter of a
      // point on 52,851 cases. If a future ingest moves the minimum to the
      // last band the sentence would name it as a rise while printing the
      // lowest number on the chart.
      turnsUp: (last.denialRate ?? 0) > (lowest.denialRate ?? 0),
      // Bottom band against the LOWEST band, not against the top one: on this
      // data the rate turns back up above $160k, so "bottom over top"
      // understates the fall and implies a monotonicity that is not there.
      multiple: ((first.denialRate ?? 0) / (lowest.denialRate ?? 1)).toFixed(1),
    };
  })();
  // The spread across fiscal years, which is larger than most of the factors
  // the page ranks and is the strongest argument for dating every rate.
  const yearSwing = (() => {
    const years = (risk?.byYear ?? []).filter((r) => r.denialRate > 0);
    if (years.length < 2) return null;
    const sorted = [...years].sort((a, b) => a.denialRate - b.denialRate);
    return { low: sorted[0]!, high: sorted[sorted.length - 1]! };
  })();

  // The two ranked cuts. Both are built here rather than in the ingest so the
  // numerator and denominator stay visible: decided = certified + denied, and
  // a withdrawal sits on neither side of it, exactly as the baseline does.
  const occupationRows: RateRow[] = (stats?.topOccupations ?? [])
    .map((o): RateRow | null => {
      const decided = o.certified + o.denied;
      const rate = denialRate(o.denied, decided);
      return rate === null
        ? null
        : {
            label: o.title,
            note: o.code,
            rate,
            decided,
            denied: o.denied,
            group: socGroup(o.code) ?? undefined,
          };
    })
    .filter((r): r is RateRow => r !== null);

  const stateRows: RateRow[] = (stats?.byState ?? [])
    .map((s): RateRow | null => {
      const decided = s.certified + s.denied;
      const rate = denialRate(s.denied, decided);
      return rate === null
        ? null
        : {
            label: stateName(s.state),
            rate,
            decided,
            denied: s.denied,
            group: CENSUS_REGION[s.state] ?? undefined,
          };
    })
    .filter((r): r is RateRow => r !== null);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What’s the PERM denial rate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: baseline
            ? `Across the current disclosure window, ${baseline.denialRate}% of decided PERM cases were denied (${baseline.denied.toLocaleString("en-US")} of ${baseline.decided.toLocaleString("en-US")}). Withdrawn cases are excluded from both sides of that ratio.`
            : "The rate is computed from DOL's quarterly disclosure files over decided cases only.",
        },
      },
      {
        "@type": "Question",
        name: "What raises the risk of a PERM denial?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "In DOL's own files the strongest correlates are a position that isn’t full time and a foreign worker with an ownership interest in the employer. Both are recorded on the ETA-9089 itself. These are group rates, not probabilities for an individual case.",
        },
      },
      {
        "@type": "Question",
        name: "Which occupations have the highest PERM denial rate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Denial rates by occupation are on this page, ranked over the occupations with enough decided cases to carry a rate. The floor matters: an occupation with a handful of decisions can read as 25% denied on a single denial, so rates below the floor aren’t ranked at all.",
        },
      },
    ],
  };

  // A MEASURED DATASET, and this was one of two data pages whose markup
  // did not say so. Five of seven carried `Dataset`; this one and the other
  // did not, which is the kind of gap that is invisible in review because
  // every page looks finished on its own. It is the AEO lever for a data
  // page: it is what tells an answer engine the numbers have a named federal
  // source, a licence and a coverage window rather than being prose.
  const datasetSchema = getDatasetSchema("https://permtracker.app", {
    name: "PERM denial rates by filing attribute",
    description:
      "Measured PERM denial rates by ETA-9089 answer, offered wage band, occupation, state and fiscal year, from DOL disclosure files. Group rates only, with no per-case risk score.",
    url: "https://permtracker.app/perm-denial-risk",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Denial rates
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          What gets denied
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The rates DOL&apos;s own files record: by what the form asks, by job,
          and by worksite.
        </p>
      </header>

      {risk && baseline ? (
        <>
          {/* The finding, stated. Every figure in it is on this page. */}
          <div className="mt-8">
            <FreshnessDots
              items={[
                { label: "DOL disclosure files", asOf: sourceWindow, kind: "window" },
              ]}
            />
          </div>

          <section className="mt-6">
            <InsightLede
              verdict={topFlag ? `${topMultiple} the field` : undefined}
              direction="bad"
              source={`${baseline.denied.toLocaleString("en-US")} denials in ${baseline.decided.toLocaleString("en-US")} decided cases`}
            >
              {topFlag ? (
                <>
                  A PERM case is denied {baseline.denialRate}% of the time. A case
                  where {FLAG_LABELS[topFlag.bucket]?.clause ?? topFlag.bucket} is
                  denied {topFlag.denialRate}% of the time, on{" "}
                  {topFlag.decided.toLocaleString("en-US")} decided cases.
                </>
              ) : (
                <>
                  A PERM case is denied {baseline.denialRate}% of the time,{" "}
                  {baseline.denied.toLocaleString("en-US")} in{" "}
                  {baseline.decided.toLocaleString("en-US")} decided cases.
                </>
              )}
            </InsightLede>
          </section>

          {/* The baseline every other number on the page is read against. */}
          <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard-sm sm:p-8">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="font-heading text-5xl font-black tabular-nums">
                {baseline.denialRate}%
              </p>{" "}
              <p className="max-w-lg text-base leading-relaxed text-foreground/70">
                is the field baseline. Withdrawn cases sit on neither side of
                that ratio.
              </p>
            </div>
          </section>

          {/* Read this before the bars, not after. */}
          <section className="mt-6 border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
            <h2 className="font-heading text-lg font-black">
              What these rates can and can’t tell you
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              Each bar is a group’s rate, not the odds on one case, and the
              factors aren’t independent, so we don’t blend them into a score.
              A rate over a small group is mostly noise, so the occupation and
              state rankings carry a minimum population and a 95% range.
            </p>{" "}
            <FinePrint summary="Which window each cut covers">
              <p>
                Only the year cut splits the window. The wage, occupation and
                state rates each span all of {sourceWindow}.
              </p>
            </FinePrint>
          </section>

          {/* The reframe. Every rate on this page is a rate; none of them says
              how much of the denial pile it accounts for, and the two answers
              point in opposite directions. */}
          {flagShare !== null && topWageByShare && topWageShare !== null && topWageReach !== null ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-black">
                Where the denials actually are
              </h2>{" "}
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
                A rate is not a share. The three factors the ETA-9089 asks about
                carry the highest rates here and{" "}
                <strong>{flagShare.toFixed(1)}% of all denials</strong>. The{" "}
                {topWageByShare.bucket.toLowerCase()} band carries a middling
                rate and{" "}
                <strong>{topWageShare.toFixed(0)}% of them</strong>, on{" "}
                {topWageReach.toFixed(0)}% of decided cases.
              </p>
              <div className="mt-8 grid [&>*]:min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="font-heading text-lg font-black">By offered wage</h3>{" "}
                  <DenialReach
                    className="mt-4"
                    label="Denial reach by offered wage"
                    unitLabel="Wage band"
                    caption="Each offered-wage band's share of decided cases and share of all denials"
                    rows={wageForReach.map((r) => ({
                      label: r.bucket,
                      decided: r.decided,
                      denied: r.denied,
                    }))}
                    totalDecided={baseline.decided}
                    totalDenied={baseline.denied}
                  />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-black">
                    By what the form declares
                  </h3>{" "}
                  <DenialReach
                    className="mt-4"
                    label="Denial reach by declared factor"
                    unitLabel="Declared factor"
                    caption="Each declared factor's share of decided cases and share of all denials"
                    rows={risk.byFlag.map((r) => ({
                      label: FLAG_LABELS[r.bucket]?.label ?? r.bucket,
                      decided: r.decided,
                      denied: r.denied,
                    }))}
                    totalDecided={baseline.decided}
                    totalDenied={baseline.denied}
                  />
                </div>
              </div>
              <FinePrint summary="How these bars sum" className="mt-6">
                <p>
                  The three declared factors overlap, and most cases declare none
                  of them, so those bars don&apos;t sum to the field. The wage
                  bands do, apart from{" "}
                  {(baseline.decided -
                    wageForReach.reduce((n, r) => n + r.decided, 0)).toLocaleString("en-US")}{" "}
                  decided cases whose offered wage couldn&apos;t be annualised
                  from what DOL recorded.
                </p>
              </FinePrint>
            </section>
          ) : null}

          <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-black">
                By what the form declares
              </h2>{" "}
              <div className="mt-6">
                <RateViews
                  label="Denial rate by declared factor"
                  unitLabel="Declared factor"
                  caption="Denial rate for each factor the ETA-9089 records, with its decided-case count and 95% range"
                  rows={risk.byFlag.map((r) => ({
                    label: FLAG_LABELS[r.bucket]?.label ?? r.bucket,
                    note: FLAG_LABELS[r.bucket]?.what,
                    rate: r.denialRate,
                    decided: r.decided,
                    denied: r.denied,
                  }))}
                  baseline={baseline.denialRate}
                />
              </div>
              {protectiveFlag ? (
                <p className="mt-4 text-sm leading-relaxed text-foreground/60">
                  One runs the other way:{" "}
                  {FLAG_LABELS[protectiveFlag.bucket]?.label ?? protectiveFlag.bucket} is
                  denied {protectiveFlag.denialRate}% of the time, below the field,
                  on {protectiveFlag.decided.toLocaleString("en-US")} decided
                  cases. That&apos;s an association, not a cause.
                </p>
              ) : null}
            </div>

            <div>
              <h2 className="font-heading text-2xl font-black">By offered wage</h2>{" "}
              <div className="mt-6">
                <RateViews
                  label="Denial rate by offered wage"
                  unitLabel="Wage band"
                  caption="Denial rate for each offered-wage band, with its decided-case count and 95% range"
                  rows={(fineWage.length > 0
                    ? fineWage.filter((b) => b.denialRate !== null)
                    : risk.byWage
                  ).map((r) => ({
                    label: r.bucket,
                    rate: r.denialRate ?? 0,
                    decided: r.decided,
                    denied: r.denied,
                  }))}
                  baseline={baseline.denialRate}
                />
              </div>
              {wageEnds ? (
                <p className="mt-4 text-sm leading-relaxed text-foreground/60">
                  The rate falls as the wage rises, {wageEnds.first.denialRate}%
                  to {wageEnds.lowest.denialRate}% at{" "}
                  {wageEnds.lowest.bucket.toLowerCase()}, a{" "}
                  {wageEnds.multiple}-fold difference.{" "}
                  {wageMonotonic
                    ? "It falls at every step."
                    : wageEnds.turnsUp
                      ? `Not smoothly: it turns back up at the top, ${wageEnds.last.bucket.toLowerCase()} at ${wageEnds.last.denialRate}% on ${wageEnds.last.decided.toLocaleString("en-US")} decided cases.`
                      : "Not smoothly: bands in the middle run against the trend."}
                </p>
              ) : null}
              {wagePeak && wagePeak.hiddenByCoarse ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                  Where you draw the bands changes the picture. The highest rate
                  in the data is <strong>{wagePeak.fine.denialRate}%</strong> at{" "}
                  {wagePeak.fine.bucket.toLowerCase()}, on{" "}
                  {wagePeak.fine.decided.toLocaleString("en-US")} decided cases.
                  Averaged into five wide bands it disappears inside a bucket
                  reporting {wagePeak.coarse.denialRate}%.
                </p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                What the bumps mean isn&apos;t something this data can say: DOL
                denies on the record, not on the salary.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">By fiscal year</h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              The rate moves year to year.
              {yearSwing ? (
                <>
                  {" "}
                  {yearSwing.low.bucket} was {yearSwing.low.denialRate}% and{" "}
                  {yearSwing.high.bucket} was {yearSwing.high.denialRate}%, a{" "}
                  {(yearSwing.high.denialRate / yearSwing.low.denialRate).toFixed(1)}-fold
                  difference on nothing an applicant controls, so a rate quoted
                  without its year is worth little.
                </>
              ) : null}
            </p>
            <div className="mt-6 max-w-2xl">
              <RateViews
                label="Denial rate by fiscal year"
                unitLabel="Fiscal year"
                caption="Denial rate for each fiscal year in the window, with its decided-case count and 95% range"
                rows={risk.byYear.map((r) => ({
                  label: `FY ${r.bucket}`,
                  rate: r.denialRate,
                  decided: r.decided,
                  denied: r.denied,
                }))}
                baseline={baseline.denialRate}
              />
            </div>
          </section>

          {occupationRows.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-black">By occupation</h2>{" "}
              <p className="mt-2 max-w-2xl text-base text-foreground/70">
                Denials cluster in a handful of job families and are close to
                absent in others.
              </p>
              <div className="mt-6">
                <RankedRateViews
                  label="Denial rate by occupation"
                  rows={occupationRows}
                  baseline={baseline.denialRate}
                  noun="occupations"
                  unitLabel="Occupation"
                  facetLabel="Job family"
                  searchPlaceholder="Software developers, 15-1252…"
                  csvFilename="perm-denial-rate-by-occupation.csv"
                />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/60">
                Only occupations with the most cases on record, so a rare job
                isn’t here. Volume, median wage and processing days sit on the{" "}
                <Link
                  href="/perm-wages"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  occupation index
                </Link>
                .
              </p>
            </section>
          ) : null}

          {stateRows.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-black">By worksite state</h2>{" "}
              <p className="mt-2 max-w-2xl text-base text-foreground/70">
                DOL works one national queue, so this ranks where denials land.
              </p>
              <div className="mt-6">
                <RankedRateViews
                  label="Denial rate by worksite state"
                  rows={stateRows}
                  baseline={baseline.denialRate}
                  noun="states"
                  unitLabel="State"
                  facetLabel="Region"
                  searchPlaceholder="California, Texas…"
                  csvFilename="perm-denial-rate-by-state.csv"
                  chartLimit={10}
                  pageSize={100}
                />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/60">
                Volume, approval rate, median days and median wage sit on the{" "}
                <Link
                  href="/perm-by-state"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  state map
                </Link>
                .
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-8 text-center shadow-hard">
          <p className="text-lg text-foreground/70">
            The denial-rate tables land with the quarterly disclosure ingest.
            Until then, the{" "}
            <Link href="/methodology" className="underline decoration-primary decoration-2 underline-offset-2">
              methodology page
            </Link>{" "}
            sets out where every figure comes from.
          </p>
        </section>
      )}

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Filing a case?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            None of these is a reason to file differently than the regulations
            require, only to document what applies. The{" "}
            <Link href="/tools/perm-deadline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              deadline calculator
            </Link>{" "}
            covers the dates side.
          </p>
        </div>
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on one?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Denials are rare; most of the wait is queue time. The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            reads your filing month against where DOL is now.
          </p>
        </div>
      </section>
      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}
