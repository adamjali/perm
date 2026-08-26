import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../../convex/_generated/api";
import { I140QueueEstimator } from "@/components/tools/I140QueueEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";

import { DataProvenance } from "@/components/data/DataProvenance";
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

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/i140-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/i140-calculator",
  },
};

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
  const data = await fetchQuery(api.uscisI140.getLatest, {}).catch(() => null);

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

      <section className="mt-10">
        <I140QueueEstimator
          subtypes={data ? data.subtypes : []}
          asOfQuarter={data ? data.asOfQuarter : null}
          sourceFile={data ? data.sourceFile : null}
        />
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
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
