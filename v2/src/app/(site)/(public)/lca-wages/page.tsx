import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { SalaryExplorer } from "@/components/tools/SalaryExplorer";
import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import {
  getLcaWageByState,
  getLcaWageFilterOptions,
  getLcaWageHistogram,
  getLcaWageStats,
} from "@/lib/turso/lcaWages";
import { binWidth, clampBins, MIN_FOR_MEDIAN } from "@/lib/wageStats";

/**
 * H-1B salary explorer.
 *
 * The sibling of the PERM salary explorer over the LCA disclosure files: the
 * wage an employer attested for an H-1B role, annualised from the unit the
 * filing quoted, over the filings the reader selects. First-party end to
 * end; nothing mirrored, nothing modelled. The default view is rendered on
 * the server so a crawler sees numbers, and filtering goes through
 * /api/lca-wages so the database credential never reaches the browser.
 */

const TITLE = "H-1B Salary Explorer";
const DESCRIPTION =
  "The wage attested on certified H-1B LCAs, by occupation, worksite state and year, from DOL's own disclosure files. Median, average and percentiles.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/lca-wages" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/lca-wages",
  },
}, "lca-wages");

// Quarterly files, a weekly window, and POST /api/revalidate-disclosure
// expires it the day a file lands.
export const revalidate = 604800;

const FAQS = [
  {
    q: "What wage is this?",
    a: "The wage the employer attested on the Labor Condition Application, the form that has to be certified before an H-1B petition can be filed. It must meet or beat the prevailing wage for the occupation and area. DOL publishes it in its quarterly LCA disclosure files, which is where every figure here comes from.",
  },
  {
    q: "Why are hourly filings mixed in with yearly ones?",
    a: "Because employers quote the unit they pay in. Every figure is annualised first: an hourly wage times 2,080 hours, a monthly wage times 12, a weekly one times 52. A filing outside $10,000 to $1,500,000 a year is treated as a data defect and left out.",
  },
  {
    q: "Which filings are in the window?",
    a: "The FY2026 disclosure files, which cover LCAs decided from October 1, 2025. Earlier fiscal years are loaded one at a time; the provenance line below says what is held today.",
  },
  {
    q: "Why does a filter sometimes show no figures?",
    a: `Because the selection is too thin. Below ${MIN_FOR_MEDIAN} filings a median moves by thousands when a single filing lands, so nothing is shown; between 30 and 100 the tails are withheld and the middle is kept.`,
  },
  {
    q: "Is this the same as a prevailing wage level?",
    a: "No. DOL sets the four prevailing wage levels on the OES survey, at roughly the 17th, 34th, 50th and 67th percentiles of what everyone in the occupation earns. These are the wages employers actually attested on H-1B filings, a different population, and usually a higher one.",
  },
];

export default async function LcaWagesPage() {
  const options = await getLcaWageFilterOptions(MIN_FOR_MEDIAN);
  const filters = { status: "certified" as const };
  const stats = await getLcaWageStats(filters);
  const width = binWidth(stats.p5, stats.p95);
  const [raw, byState] = await Promise.all([
    stats.n >= MIN_FOR_MEDIAN ? getLcaWageHistogram(filters, width) : Promise.resolve([]),
    stats.n >= MIN_FOR_MEDIAN ? getLcaWageByState(filters, MIN_FOR_MEDIAN) : Promise.resolve([]),
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
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/perm-wages" className="underline underline-offset-2 hover:text-primary">
            Wages
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          H-1B salary explorer
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The wage every employer attested on a certified H-1B LCA, as DOL
          published it. Filter to an occupation, a worksite state or a year,
          and the figures describe those filings and no others.{" "}
          <Link href="/tools/compare-my-offer" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
            Have an offer? Place it in the distribution.
          </Link>
        </p>
      </header>

      <section className="mt-10">
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
            apiPath="/api/lca-wages"
            heading="What does this job pay on an H-1B?"
            noun="LCA"
            nounPlural="LCAs"
          />
        </Suspense>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["lca-disclosure"]} />

      <ToolPageFooter
        currentHref="/lca-wages"
        reading={[
          {
            href: "/tools/salary-explorer",
            label: "PERM salary explorer",
            note: "The same ladder over the wage offered on the permanent job, which is usually the next filing.",
          },
          {
            href: "/lca-cases",
            label: "H-1B LCA case search",
            note: "One employer's filings, pending included, with the wage on each decided one.",
          },
          {
            href: "/perm-wages",
            label: "Median wage by occupation",
            note: "Every occupation ranked, each with its own page.",
          },
        ]}
      />
    </div>
  );
}
