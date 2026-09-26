import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { queryStatic } from "@/lib/convexStatic";

import { api } from "../../../../../../convex/_generated/api";
import { I140QueueEstimator } from "@/components/tools/I140QueueEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";

import { DataProvenance } from "@/components/data/DataProvenance";
import { getUscisFormMedian } from "@/lib/turso/uscisQuarterly";
import { quarterLabel } from "@/lib/uscisQuarterlyShape";
import { withSocialCard } from "@/lib/socialCard";
/**
 * I-140 queue calculator.
 *
 * The one page in this set that puts two official figures side by side and
 * lets them disagree. USCIS publishes both a processing time and a pending
 * count, and for the national interest waiver they imply very different waits
 * because the queue is growing faster than it clears.
 */

const TITLE = "I-140 Processing Time and Queue Calculator";
const DESCRIPTION =
  "How many I-140 petitions are waiting in your category, how fast USCIS clears them, and how that compares to the processing time USCIS publishes.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/i140-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/i140-calculator",
  },
}, "i140-calculator");

// USCIS publishes quarterly, so an hour of cache costs nothing in freshness.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

const FAQS = [
  {
    q: "Why does the queue imply a longer wait than the processing time USCIS publishes?",
    a: "They measure different things. The published time looks backwards at petitions USCIS has already decided. The queue looks at the pile that’s still there. When more petitions arrive than leave, as is happening with national interest waivers, the pile grows and a case filed today sits behind more work than the cases that have just finished did.",
  },
  {
    q: "How many I-140 petitions are pending?",
    a: "USCIS publishes the count every quarter by preference category. National interest waivers are consistently the largest single group, at roughly half of all pending I-140 petitions on recent figures.",
  },
  {
    q: "Can you tell me how many petitions are ahead of mine?",
    a: "No. USCIS publishes pending petitions by category but never by month of receipt, so there’s no way to work out where any particular case sits in the order. The prevailing wage queue is different because DOL does publish that breakdown.",
  },
  {
    q: "Does premium processing skip the queue?",
    a: "Yes, that’s what it buys. USCIS commits to a first review within 15 business days for most I-140 categories, or 45 for EB-1C multinational executives and EB-2 national interest waivers. It guarantees a review, not an approval, and the clock restarts if USCIS issues a request for evidence.",
  },
];

export default async function I140CalculatorPage() {
  const [data, i140Median] = await Promise.all([
    queryStatic(api.uscisI140.getLatest, {}, revalidate).catch(() => null),
    // The quarterly median over every I-140 decided, from USCIS's all-forms
    // workbook: the third official figure, beside the published range and
    // the pending count, each measuring something different.
    getUscisFormMedian("I-140"),
  ]);

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
          {/* inline-flex with a 44px min-height: the link is a standalone tap
              target and rendered at 15px tall before this. */}
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          I-140 queue calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How many petitions are waiting in your category, and how that compares
          to the processing time USCIS publishes.
        </p>
      </header>

      <section data-embed="i140-queue" className="mt-10">
        <I140QueueEstimator
          subtypes={data ? data.subtypes : []}
          asOfQuarter={data ? data.asOfQuarter : null}
          sourceFile={data ? data.sourceFile : null}
          quarterlyMedian={
            i140Median
              ? {
                  months: i140Median.medianMonths,
                  quarterLabel: quarterLabel(i140Median.fy, i140Median.quarter),
                  completed: i140Median.completed,
                }
              : null
          }
        />
      </section>

      {/* PREMIUM, AS A DECISION. The figures live elsewhere on the site (the
          fee in the fees calculator, the six-year limit and priority-date
          tools); this puts the three reasons it tends to be worth paying in
          one place, each with the rule it rests on. Checked against eCFR on
          2026-09-26: 8 CFR 214.2(h)(13)(iii)(E), 204.5(e), 205.1(a)(3)(iii)(C);
          the fee is 91 FR 1059 (in force March 1, 2026). */}
      <section aria-labelledby="premium-h" className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 id="premium-h" className="font-heading text-2xl font-black">
          When premium processing is worth $2,965
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
          It buys a first decision within 15 business days (45 for multinational managers and national interest
          waivers). It doesn&apos;t move the priority date, and a request for evidence stops the clock. It tends to
          pay for itself in three situations:
        </p>{" "}
        <ol className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 [&>*]:min-w-0">
          <li className="border-2 border-border bg-background p-5">
            <p className="font-heading text-lg font-black">The H-1B six years are running out</p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              An approved I-140 is what lets H-1B status continue past six years, in steps of up to three years, when no
              visa number is available (8 CFR 214.2(h)(13)(iii)(E)).{" "}
              <Link href="/tools/h1b-six-year-limit" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                Work out the date
              </Link>
            </p>
          </li>{" "}
          <li className="border-2 border-border bg-background p-5">
            <p className="font-heading text-lg font-black">The worker might change jobs</p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              Once an I-140 has been approved for 180 days, the employer withdrawing it doesn&apos;t undo the approval
              (8 CFR 205.1(a)(3)(iii)(C)), and the priority date carries to a new petition (8 CFR 204.5(e)). Premium starts
              that clock months sooner.{" "}
              <Link href="/tools/priority-date-retention" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                Check a priority date
              </Link>
            </p>
          </li>{" "}
          <li className="border-2 border-border bg-background p-5">
            <p className="font-heading text-lg font-black">The priority date is about to be current</p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              If the bulletin reaches the date before a regular I-140 would be decided, premium can be the difference
              between filing the green card application this month or later.{" "}
              <Link href="/tools/priority-date-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                Is it current?
              </Link>
            </p>
          </li>
        </ol>{" "}
        <p className="mt-4 text-sm text-muted-foreground">
          Otherwise, a priority date that is years from current gains little from a faster I-140. The fee is the one
          in force since March 1, 2026 (91 FR 1059). This is general information, not advice on a particular case.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">
          The I-140 comes after the part you control
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          A petition can only be filed once the labor certification is approved,
          and that certification has to be filed inside a window fixed by the
          prevailing wage determination. Miss the window and the recruitment
          starts again, months before USCIS ever sees the case.
        </p>
        <Link
          href="/tools/perm-deadline-calculator"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Work out your filing window
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <DataProvenance datasets={["uscis-i140-times"]} />


      <ToolPageFooter
        currentHref={"/tools/i140-calculator"}
        reading={[
          { href: "/guides/ultimate-perm-guide-2026", label: "The full PERM guide", note: "Where the petition sits in the process, and what has to be approved first." },
          { href: "/blog/what-is-perm-labor-certification", label: "What PERM is", note: "The labor certification the petition depends on, in plain terms." },
        ]}
      />
    </div>
  );
}
