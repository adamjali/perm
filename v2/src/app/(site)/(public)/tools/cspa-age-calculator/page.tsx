import type { Metadata } from "next";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CspaCalculator } from "@/components/tools/CspaCalculator";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { categoriesIn } from "@/lib/db/bulletin";
import { getFamilyBulletinSeries, getVisaBulletinSeries } from "@/lib/db/publicData";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The Child Status Protection Act age, as a calculator.
 *
 * The question behind it: a child listed on a parent's green card turns 21 while the line waits. Does the child
 * still count? The page asks for the dates on the family's own notices and reads the line's history from the
 * bulletin archive; the rules are INA 203(h) and USCIS's Policy Manual, both cited under the answer.
 *
 * The page reads the archive only for which categories it holds; the calculator asks for one line at a time
 * (`/api/bulletin-line`), so the page doesn't carry every bulletin.
 */

const TITLE = "CSPA Age Calculator";
const DESCRIPTION =
  "Will a child age out of a parent's green card? The CSPA age, the day the visa counted as available, and the last day to file, by USCIS's rules.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/cspa-age-calculator" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/cspa-age-calculator" },
}, "cspa-age-calculator");

// The categories move only when a bulletin adds a line; the bulletin route expires the page the day one lands.
export const revalidate = 86400;

const FAQS = [
  {
    q: "What is the CSPA age?",
    a: "The child's age on the day a visa became available, less the days the petition was pending. It's INA 203(h)(1), the Child Status Protection Act of 2002. A CSPA age under 21 means the child still counts as a child for the parent's green card, as long as the child is unmarried and sought to acquire permanent residence within a year.",
  },
  {
    q: "Which petition's pending time counts?",
    a: "The petition the green card rests on: for a child on a parent's work-based case, the parent's I-140; for a family case, the I-130. It's the days from USCIS's receipt date to its approval date, administrative review included. If the parent's case moved to a second I-140, the second one counts, even when the priority date came from the first.",
  },
  {
    q: "When does a visa count as available?",
    a: "On the later of two days: the petition's approval, or the first day of the bulletin month whose Final Action Dates chart shows the priority date current. That's USCIS's rule for I-485s filed on or after August 15, 2025. For I-485s filed before then, USCIS uses the chart it named for filing that month, which was often the Dates for Filing chart.",
  },
  {
    q: "What does 'sought to acquire' mean, and by when?",
    a: "Filing the I-485, submitting the DS-260, or paying the visa fee, within a year of the day the visa became available. If the visa stops being available before a full year passes, a new year starts the next time it's available. A full year of availability with nothing filed ends the protection, unless USCIS finds extraordinary circumstances.",
  },
  {
    q: "What if the date retrogresses after the child files?",
    a: "Once the child has filed and the visa had become available by the Final Action chart, the age is fixed through the decision, and USCIS holds the application until the date is current again. If the child filed early on the Dates for Filing chart, the age is fixed on the first day the Final Action chart reaches the date.",
  },
  {
    q: "Is this legal advice?",
    a: "No. It's the arithmetic in the statute and the Policy Manual on the dates you enter and the bulletin archive. Marriage, extraordinary circumstances, which petition the case rests on and how USCIS read a given month are questions for the attorney who files.",
  },
];

export default async function CspaAgeCalculatorPage() {
  const [employment, family] = await Promise.all([getVisaBulletinSeries(), getFamilyBulletinSeries()]);
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
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Will my child age out?</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The Child Status Protection Act age for a child on a parent&apos;s green card, from the dates on your notices and
          the visa bulletin archive back to 2005.
        </p>
      </header>
      <section data-embed="cspa-age" className="mt-10">
        <CspaCalculator employmentCategories={categoriesIn(employment)} familyCategories={categoriesIn(family)} />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/cspa-age-calculator"
        reading={[
          { href: "/tools/priority-date-calculator", label: "Priority date calculator", note: "the line's cutoff, month by month" },
          { href: "/tools/priority-date-retention", label: "Priority date retention", note: "when a date is kept across petitions" },
          { href: "/visa-bulletin", label: "Visa bulletin", note: "this month's cutoffs and what moved" },
        ]}
      />
    </div>
  );
}
