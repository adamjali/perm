import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { SalaryExplorer } from "@/components/tools/SalaryExplorer";
import { DataNav } from "@/components/tools/DataNav";
import { DataProvenance } from "@/components/data/DataProvenance";
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
export const revalidate = 86400;

const FAQS = [
  {
    q: "Is this what the job actually pays?",
    a: "It is the wage the employer offered on the ETA-9089, which is the figure DOL publishes. It has to meet or beat the prevailing wage determination for that job in that area, so it is a floor set by the process rather than a market survey. Bonuses and equity are not in it.",
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="calculators" />
      <div className="pt-10 sm:pt-12" />
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
