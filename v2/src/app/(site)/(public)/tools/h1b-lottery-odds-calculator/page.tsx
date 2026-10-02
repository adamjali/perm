import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { H1bLotteryCalculator } from "@/components/tools/H1bLotteryCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { WEIGHTED_ESTIMATE, WEIGHTED_FROM } from "@/lib/h1bLottery";
import { LOTTERY_RULE } from "@/lib/h1bLotteryCalc";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * The weighted H-1B lottery for one job. /h1b-lottery-odds is the record
 * (USCIS's table by year, DHS's estimate by level); this page is the
 * calculator that puts one offer on that scale: occupation, work areas and
 * the wage in, the OEWS level DOL's own figures give and DHS's estimate at
 * that level out.
 */

const TITLE = "H-1B Lottery Odds Calculator";
const DESCRIPTION =
  "Your H-1B lottery level and odds under the wage-weighted draw: the OEWS level your offer meets, from DOL's wage search, and DHS's estimated chance at it.";
const PATH = "/tools/h1b-lottery-odds-calculator";

// No social card of its own yet (a card is a capture of the rendered page).
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

export const dynamic = "force-static";

const FAQS = [
  {
    q: "How is my lottery level decided?",
    a: `By ${LOTTERY_RULE.cfr}: the highest OEWS wage level the offered wage equals or exceeds for the job's SOC code in the area of employment. A wage under level I, allowed when it comes from another prevailing wage source, counts as level I. With several work areas, the lowest level the wage meets counts, and a wage range counts by its lowest wage.`,
  },
  {
    q: "Where do the odds come from?",
    a: `From DHS's estimate in the final rule, ${WEIGHTED_ESTIMATE.citation}: about 15% at level I, 31% at level II, 46% at level III and 61% at level IV, against ${WEIGHTED_ESTIMATE.randomPercent}% for everyone under the old random draw. DHS worked them out from past petitions before the first weighted lottery ran, assuming employers keep their current wages.`,
  },
  {
    q: "Which wage series counts?",
    a: "The OEWS figures current on the day the registration is filed. OEWS wages turn over every July 1, so a registration filed in March uses the series that opened the July before. The rule keeps that level even if the figures change before the petition is filed.",
  },
  {
    q: "What if DOL has no wage for my job in my area?",
    a: "Then the rule has the registrant choose the level from the job's requirements, using DOL's prevailing wage guidance. That's a judgement about the job, so this page says so instead of guessing.",
  },
];

export default function H1bLotteryCalculatorPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">H-1B lottery odds for one job</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          From the FY{WEIGHTED_FROM} cap the draw is weighted by wage. Put in the job, where it is and the offer, and see
          the level DOL&apos;s own figures give it and DHS&apos;s estimated chance at that level.
        </p>
      </header>
      <section data-embed="h1b-lottery" className="mt-10">
        <H1bLotteryCalculator />
      </section>
      <p className="mt-4 max-w-3xl text-base text-foreground/75">
        Every year&apos;s registrations and selections, from USCIS&apos;s own table, are on{" "}
        <Link href="/h1b-lottery-odds" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          H-1B lottery odds by year
        </Link>
        . Cap-exempt employers, such as universities and their affiliated nonprofits, file outside the lottery.
      </p>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/h1b-lottery-odds", label: "H-1B lottery odds by year", note: "USCIS's registrations and selections since FY2021" },
          { href: "/tools/wage-levels", label: "Wage levels for a job", note: "DOL's four OEWS figures for an occupation and area" },
          { href: "/lca-wages", label: "H-1B wages by occupation", note: "what certified LCAs offered, from DOL's disclosure files" },
        ]}
      />
    </div>
  );
}
