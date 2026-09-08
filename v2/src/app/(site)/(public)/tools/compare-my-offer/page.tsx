import type { Metadata } from "next";
import Link from "next/link";

import { CompareMyOffer } from "@/components/tools/CompareMyOffer";
import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { getLcaWageFilterOptions } from "@/lib/turso/lcaWages";
import { MIN_FOR_MEDIAN } from "@/lib/wageStats";

/**
 * Compare my offer.
 *
 * A percentile, not a verdict: where a salary sits among what employers
 * actually attested on certified H-1B LCAs and offered on certified PERM
 * cases for the same occupation and state. The offer is placed in the
 * distribution in the browser (see CompareMyOffer) and is never sent here.
 */

const TITLE = "Compare My Offer";
const DESCRIPTION =
  "Where your salary sits among certified H-1B LCAs and PERM offers for the same occupation and state, as a percentile from DOL's own filings. Your number stays in your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/compare-my-offer" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/compare-my-offer",
  },
};

// The selector lists change with the quarterly files; a week bounds it and
// the disclosure revalidation expires it sooner.
export const revalidate = 604800;

const FAQS = [
  {
    q: "What am I being compared against?",
    a: "Two populations, shown separately. Certified H-1B LCAs: the wage the employer attested for the H-1B role, from DOL's LCA disclosure files. Certified PERM cases: the wage offered on the ETA-9089 for the permanent job, from the PERM disclosure files. The same occupation code and worksite state select both.",
  },
  {
    q: "Does the site keep my salary?",
    a: "No. The page fetches the wage distribution for the occupation and state you pick, and your number is placed in it by your browser. Nothing about the offer is sent, logged or stored.",
  },
  {
    q: "Why is it 'about' the percentile?",
    a: "The distribution comes as a histogram, so the position inside one bin is interpolated. It is accurate to a point or two, which is as precise as a comparison across thousands of different jobs should ever claim to be.",
  },
  {
    q: "How does this relate to the prevailing wage level on my LCA?",
    a: "Loosely. DOL sets Levels I to IV on the OES survey at roughly the 17th, 34th, 50th and 67th percentiles of everyone in the occupation. This page compares against what H-1B and PERM employers actually filed, which is a narrower and usually higher-paid population, so a Level II wage can sit below the median here.",
  },
];

export default async function CompareMyOfferPage() {
  const options = await getLcaWageFilterOptions(MIN_FOR_MEDIAN);
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
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/calculators" className="underline underline-offset-2 hover:text-primary">
            Calculators
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Compare my offer
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Pick the occupation and state on the filing, enter the offer, and
          see where it sits among what employers actually filed: certified
          H-1B LCAs and certified PERM offers, side by side.
        </p>
      </header>

      <section className="mt-10">
        <CompareMyOffer occupations={options.occupations} states={options.states} />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["lca-disclosure", "perm-cases"]} />

      <ToolPageFooter
        currentHref="/tools/compare-my-offer"
        reading={[
          {
            href: "/lca-wages",
            label: "H-1B salary explorer",
            note: "The whole distribution the H-1B percentile is read from, by occupation, state and year.",
          },
          {
            href: "/tools/salary-explorer",
            label: "PERM salary explorer",
            note: "The same for the permanent job's offered wage.",
          },
          {
            href: "/tools/pwd-calculator",
            label: "Prevailing wage queue",
            note: "The determination that sets the floor an offer has to clear, and how long it is taking.",
          },
        ]}
      />
    </div>
  );
}
