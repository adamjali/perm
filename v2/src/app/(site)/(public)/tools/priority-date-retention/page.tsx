import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { PriorityDateRetentionCalculator } from "@/components/tools/PriorityDateRetentionCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Priority date retention and I-485 portability, from the dates on the record.
 *
 * The two questions a laid-off or job-changing beneficiary asks first: do I
 * keep my priority date, and when can I move jobs. Both turn on 180-day
 * clocks with citations, so the page prints the dates and the rule, and says
 * plainly what the rule leaves to USCIS.
 */

const TITLE = "Priority Date Retention and I-485 Portability Calculator";
const DESCRIPTION =
  "From an I-140 approval date: when a withdrawal stops revoking it, when an I-485 becomes portable under 204(j), and whether the priority date is kept.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/priority-date-retention" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/priority-date-retention" },
}, "priority-date-retention");

export const dynamic = "force-static";

const FAQS = [
  {
    q: "Do I keep my priority date if my employer withdraws the I-140?",
    a: "Under 8 CFR 204.5(e)(1) the priority date of an approved I-140 is retained for a later EB-1, EB-2 or EB-3 petition unless USCIS revoked the approval for fraud, willful misrepresentation, material error, or an invalidated labor certification. Since the rule that took effect January 17, 2017, an employer's withdrawal or closure does not cost the beneficiary the date.",
  },
  {
    q: "What does 180 days after approval change?",
    a: "8 CFR 205.1(a)(3)(iii)(C) and (D): a withdrawal or the employer's closure 180 days or more after the I-140 was approved, or after an I-485 based on it was filed, no longer revokes the approval automatically. Inside 180 days it does, which matters for extensions and for using the I-140 as the basis of a pending I-485, not for the priority date.",
  },
  {
    q: "When can I change employers on a pending I-485?",
    a: "INA 204(j) and 8 CFR 245.25: once the I-485 has been pending 180 days, it may be approved on a new offer in the same or a similar occupation, filed on Form I-485 Supplement J. Whether the new job is same or similar is USCIS's determination.",
  },
  {
    q: "Is this legal advice?",
    a: "No. The dates are arithmetic on what you enter and the regulation each rule comes from. A revocation's reason, a job's similarity and the effect of prior filings are for the attorney handling the case.",
  },
];

export default function PriorityDateRetentionPage() {
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
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Priority date retention and I-485 portability
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Three dates decide what an employer&apos;s withdrawal costs and when a
          job can change. Enter the ones you have; the rules do the rest.
        </p>
      </header>
      <section className="mt-10">
        <PriorityDateRetentionCalculator />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/priority-date-retention"
        reading={[
          { href: "/guides/three-180-day-clocks", label: "The three 180-day clocks", note: "certification validity, I-140 protection, I-485 portability" },
          { href: "/tools/i485-queue-position", label: "I-485 queue position", note: "how many priority dates are ahead of yours" },
          { href: "/tools/priority-date-calculator", label: "Priority date calculator", note: "whether your date is current this month" },
        ]}
      />
    </div>
  );
}
