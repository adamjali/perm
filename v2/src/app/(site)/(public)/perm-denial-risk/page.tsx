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
import { openGraphBase } from "@/lib/openGraphBase";
import { socGroup } from "@/lib/socGroups";
import { stateName } from "@/lib/usStateNames";
import { DataNav } from "@/components/tools/DataNav";
import { RateViews, RankedRateViews, type RateRow } from "@/components/tools/RateBars";
import { CENSUS_REGION } from "@/components/tools/USStateMap";
import { FreshnessDots, InsightLede } from "@/components/tools/Insight";
import { getDisclosureStats } from "@/lib/turso/publicData";

import { DataProvenance } from "@/components/data/DataProvenance";
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
  const stats = await getDisclosureStats();
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="risk" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Denial rates
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          What gets denied
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The denial rates DOL&apos;s files record, by the factors the form asks
          about, by job, and by worksite.
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
                  denied {topFlag.denialRate}% of the time, {topMultiple} the rate of the
                  field, on {topFlag.decided.toLocaleString("en-US")} decided cases.
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
                is the field baseline: {baseline.denied.toLocaleString("en-US")} denials in{" "}
                {baseline.decided.toLocaleString("en-US")} decided cases. Withdrawn cases
                sit on neither side of that ratio, because a withdrawal is neither
                an approval nor a denial. It’s the reference every other rate is
                measured against.
              </p>
            </div>
          </section>

          {/* Read this before the bars, not after. */}
          <section className="mt-6 border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
            <h2 className="font-heading text-lg font-black">
              What these rates can and can’t tell you
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              Each bar is the denial rate of a group. It isn’t the probability
              that a particular case is denied, and the factors are not
              independent of each other: wage correlates with occupation, which
              correlates with everything else. A single blended risk score built
              from these would read as precision the data can’t support, so these
              are the measured rates, unblended.
            </p>{" "}
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/70">
              Two limits worth knowing before reading a ranking. A rate over a
              small group is mostly noise, so the occupation and state rankings
              carry a minimum population and print the 95% range beside every
              rate. And a year-by-year split is the only cut DOL&apos;s files
              support: the wage, occupation and state rates each span the whole
              window, {sourceWindow}.
            </p>
          </section>

          <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-black">
                By what the form declares
              </h2>{" "}
              <p className="mt-2 text-base text-foreground/70">
                Three questions on the ETA-9089 separate almost all of the
                denials from the rest of the field.
              </p>
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
            </div>

            <div>
              <h2 className="font-heading text-2xl font-black">By offered wage</h2>{" "}
              <p className="mt-2 text-base text-foreground/70">
                Denial rate against the wage the employer offered, in bands.
              </p>
              <div className="mt-6">
                <RateViews
                  label="Denial rate by offered wage"
                  unitLabel="Wage band"
                  caption="Denial rate for each offered-wage band, with its decided-case count and 95% range"
                  rows={risk.byWage.map((r) => ({
                    label: r.bucket,
                    rate: r.denialRate,
                    decided: r.decided,
                    denied: r.denied,
                  }))}
                  baseline={baseline.denialRate}
                />
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">By fiscal year</h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              The rate moves year to year, so every figure here carries its year.
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
                absent in others. Occupations below the minimum population carry
                no rate.
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
                These are the occupations DOL&apos;s files record the most cases
                for, so a job with very few filings nationally isn’t here at
                all. Volume, median wage and processing days for each one sit on
                the{" "}
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
                Several states decide too few cases to carry a rate at all, which
                is what the floor is for.
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
                Volume, approval rate, median days and median wage for every
                state are on the{" "}
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
            None of these factors is a reason to file differently than the
            regulations require. They’re a reason to document the ones that
            apply. The{" "}
            <Link href="/tools/perm-deadline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              deadline calculator
            </Link>{" "}
            covers the dates side.
          </p>
        </div>
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on one?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Denials are rare, and most of the wait is queue time. The{" "}
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
