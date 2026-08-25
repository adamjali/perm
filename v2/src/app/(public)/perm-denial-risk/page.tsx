/**
 * PERM denial rates, by the factors DOL's own files record.
 *
 * The rival ships a letter-graded "risk score" from an additive model whose
 * factors it assumes independent, and has it switched off in production. We
 * publish the measured rates themselves and say what they can and cannot
 * support: a rate for a group you belong to is not a probability for your
 * case, and this page says so where the reader is looking.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { RateBars } from "@/components/tools/RateBars";
import { FreshnessDots, InsightLede } from "@/components/tools/Insight";

const TITLE = "PERM Denial Rates";
const DESCRIPTION =
  "What correlates with a PERM denial, measured from DOL's files: by offered wage, by fiscal year, and by the factors the ETA-9089 records.";

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

export const revalidate = 3600;

const FLAG_LABELS: Record<string, { label: string; what: string }> = {
  layoff: {
    label: "Employer had a layoff",
    what: "A layoff in the same or a related occupation in the six months before filing (Form 9089, Section G, Item 12).",
  },
  ownership: {
    label: "Worker has an ownership interest",
    what: "The foreign worker holds an ownership interest in the employer (Section A, Item 16).",
  },
  partTime: {
    label: "Position is not full time",
    what: "The job opportunity is not full time (Section G, Item 1).",
  },
};

export default async function PermDenialRiskPage() {
  const stats = await fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null);
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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the PERM denial rate?",
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
          text: "In DOL's own files the strongest correlates are a position that is not full time and a foreign worker with an ownership interest in the employer. Both are recorded on the ETA-9089 itself. These are group rates, not probabilities for an individual case.",
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
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          Measured, not modeled
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          What actually gets denied
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          PERM denials are rare and concentrated. These are the rates DOL&apos;s
          files record, cut by the factors the form itself asks about.
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
                  A PERM case is denied {baseline.denialRate}% of the time. A{" "}
                  {(FLAG_LABELS[topFlag.bucket]?.label ?? topFlag.bucket).toLowerCase()} is
                  denied {topFlag.denialRate}% of the time — {topMultiple} the rate of the
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
                sit on neither side of that ratio, because a withdrawal is not an
                approval and not a denial. Every bar below is read against this line.
              </p>
            </div>
          </section>

          {/* Read this before the bars, not after. */}
          <section className="mt-6 border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
            <h2 className="font-heading text-lg font-black">
              What these rates can and cannot tell you
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              Each bar is the denial rate of a group, measured. It is not the
              probability that a particular case is denied, and the factors are
              not independent of each other — wage correlates with occupation,
              which correlates with everything else. A single blended risk score
              built from these would read as precision we cannot support, which
              is why this page shows the rates and stops there.
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
                <RateBars
                  rows={risk.byFlag.map((r) => ({
                    label: FLAG_LABELS[r.bucket]?.label ?? r.bucket,
                    note: FLAG_LABELS[r.bucket]?.what,
                    rate: r.denialRate,
                    decided: r.decided,
                  }))}
                  baseline={baseline.denialRate}
                />
              </div>
            </div>

            <div>
              <h2 className="font-heading text-2xl font-black">By offered wage</h2>{" "}
              <p className="mt-2 text-base text-foreground/70">
                Denial rate falls as the offered wage rises, and the lowest band
                is not the worst one.
              </p>
              <div className="mt-6">
                <RateBars
                  rows={risk.byWage.map((r) => ({
                    label: r.bucket,
                    rate: r.denialRate,
                    decided: r.decided,
                  }))}
                  baseline={baseline.denialRate}
                />
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">By fiscal year</h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              The rate moves year to year, so a figure quoted without its year
              is a figure without a meaning.
            </p>
            <div className="mt-6 max-w-2xl">
              <RateBars
                rows={risk.byYear.map((r) => ({
                  label: `FY ${r.bucket}`,
                  rate: r.denialRate,
                  decided: r.decided,
                }))}
                baseline={baseline.denialRate}
              />
            </div>
          </section>
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
            regulations require. They are a reason to document the ones that
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
            Denials are rare — most of the wait is queue, not risk. The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            reads your filing month against where DOL is now.
          </p>
        </div>
      </section>
    </div>
  );
}
