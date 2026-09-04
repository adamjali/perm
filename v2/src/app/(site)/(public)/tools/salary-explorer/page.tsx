import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { SalaryExplorer } from "@/components/tools/SalaryExplorer";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  getWageByState,
  getWageFilterOptions,
  getWageHistogram,
  getWageStats,
} from "@/lib/turso/publicData";
import { getStateLadders, MIN_CASES_FOR_LADDER } from "@/lib/turso/wages";
import { LadderCombViews } from "@/components/wages/LadderViews";
import { SplitLadderNote } from "@/components/wages/SplitLadderNote";
import { binWidth, clampBins, MIN_FOR_MEDIAN } from "@/lib/wageStats";

/**
 * PERM salary explorer.
 *
 * Entirely first-party: every figure is computed from the disclosure cases we
 * already hold, over the subset the reader selects. Nothing here is mirrored
 * and nothing is modelled.
 *
 * The default view is rendered on the server so the page answers the common
 * question with no JavaScript at all, and so a crawler sees real numbers
 * rather than an empty frame. Filtering from there goes through
 * /api/perm-wages, because the Turso credential must not reach the browser.
 */

const TITLE = "PERM Salary Explorer";
const DESCRIPTION =
  "Offered wages on PERM cases, by occupation, state and year, from DOL's own disclosure files. Median, average and percentiles over the cases you select.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/salary-explorer" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/salary-explorer",
  },
};

// The disclosure files are quarterly, so a day bounds staleness far below the
// data's own cadence.
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

const FAQS = [
  {
    q: "Is this what the job actually pays?",
    a: "It is the wage the employer offered on the ETA-9089, which is the figure DOL publishes. It has to meet or beat the prevailing wage determination for that job in that area, so it is a floor set by the process rather than a market survey. Bonuses and equity are not in it. The determinations themselves are held too, about 634,000 of them, so a wage request looked up by its P- number shows the wage DOL actually set for that job.",
  },
  {
    q: "Why does a filter sometimes show no figures?",
    a: "Because the selection is too thin to support one. Below 30 cases a median moves by thousands when a single case lands, so nothing is shown. Between 30 and 100 the middle is shown and the 5th and 95th are withheld, because at that size each tail rests on fewer than five filings.",
  },
  {
    q: "Why is certified the default?",
    a: "A denied case's offered wage was never agreed to by anyone. Benchmarking against wages that actually stood is the more useful comparison, and every other outcome is one filter away.",
  },
  {
    q: "Why is the average higher than the median in most selections?",
    a: "Because the top of the wage range runs much further from the middle than the bottom does. A handful of very high offers pull an average up and leave a median where it is, which is why both are shown rather than one.",
  },
];

export default async function SalaryExplorerPage() {
  const options = await getWageFilterOptions(MIN_FOR_MEDIAN);

  // The default view: certified, every occupation, every state, every year.
  const filters = { status: "certified" as const };
  const stats = await getWageStats(filters);
  const width = binWidth(stats.p5, stats.p95);
  const [raw, byState] = await Promise.all([
    stats.n >= MIN_FOR_MEDIAN ? getWageHistogram(filters, width) : Promise.resolve([]),
    stats.n >= MIN_FOR_MEDIAN ? getWageByState(filters, MIN_FOR_MEDIAN) : Promise.resolve([]),
  ]);
  const lo = stats.p5 !== null ? Math.floor(stats.p5 / width) * width : 0;
  const hi = stats.p95 !== null ? Math.floor(stats.p95 / width) * width : 0;
  const { bins, below, above } = clampBins(raw, lo, hi);

  // The pre-materialised state ladders, which are a different route from the
  // explorer above: seven rungs from perm_wage_stats rather than five computed
  // over the reader's filters. They answer a question the controls cannot,
  // because the explorer shows one selection at a time and this shows every
  // state against one axis.
  const stateLadders = await getStateLadders(60);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM salary explorer
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The wage every employer offered, as DOL published it. Filter to an
          occupation, a state or a year, and the figures describe those cases
          and no others.
        </p>
      </header>

      <section className="mt-10">
        {/* useSearchParams needs a boundary, and the fallback is the same
            frame the explorer renders so the page does not jump. */}
        <Suspense
          fallback={
            <div className="border-2 border-border bg-card p-6 shadow-hard sm:p-8">
              <p className="text-base text-foreground/70">Loading wage figures…</p>
            </div>
          }
        >
          <SalaryExplorer
            occupations={options.occupations}
            states={options.states}
            fiscalYears={options.fiscalYears}
            initial={{ stats, bins, binWidth: width, below, above, byState }}
          />
        </Suspense>
      </section>

      {stateLadders.length > 0 ? (
        <FigurePlate
          n="01"
          title="Every state on one axis"
          subject={`${stateLadders.length} states and territories with ${MIN_CASES_FOR_LADDER}+ certified cases`}
          caption={
            <>
              <SplitLadderNote ladders={stateLadders} className="mb-3" />
              Each row is one state&apos;s certified offers, cut at seven
              points, ordered by how many cases it files. These come from the
              pre-computed cells rather than from the controls above, so they
              cover the whole window and every state at once. The explorer
              recomputes the middle five over whatever you select.
            </>
          }
          source="DOL PERM disclosure files, certified cases only"
          className="mt-12"
        >
          <LadderCombViews
            label="Wage ladder by state"
            subjectLabel="State"
            ladders={stateLadders}
          />
        </FigurePlate>
      ) : null}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["perm-cases"]} />

      <ToolPageFooter
        currentHref={"/tools/salary-explorer"}
        reading={[
          {
            href: "/perm-wages",
            label: "Median wage by occupation",
            note: "Every occupation ranked, each with its own page and its own history.",
          },
          {
            href: "/tools/pwd-calculator",
            label: "Prevailing wage queue",
            note: "The determination that sets the floor these offers have to clear.",
          },
        ]}
      />
    </div>
  );
}
