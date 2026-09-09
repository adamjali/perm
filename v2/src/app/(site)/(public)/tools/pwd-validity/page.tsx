import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { PwdValidityCalculator } from "@/components/tools/PwdValidityCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * When a prevailing wage determination expires, as a calculator.
 *
 * The rule is the one thing everybody gets wrong about wage determinations:
 * it is not 90 days, it is 90 days OR the June 30 wage-year turnover,
 * depending on when the determination was issued. The page reuses the
 * canonical calculator and names the case that applied.
 */

const TITLE = "Prevailing Wage Determination Validity Calculator";
const DESCRIPTION =
  "When a prevailing wage determination expires under 20 CFR 656.40(c): 90 days, or June 30 when the OEWS wage year turns over. The date, the rule that applied, and the days left.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/pwd-validity" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/pwd-validity" },
};

export const dynamic = "force-static";

const FAQS = [
  {
    q: "Why is a determination from October valid for eight months and one from May for three?",
    a: "20 CFR 656.40(c) sets the validity at no less than 90 days and no more than one year, and DOL ties it to its wage year: the OEWS wage data turns over on July 1. A determination issued between July 1 and April 1 runs to the next June 30. One issued from April 2 to June 30 would otherwise fall short of 90 days, so it gets 90 days instead.",
  },
  {
    q: "What has to happen before it expires?",
    a: "The employer must either file the ETA-9089 or begin recruitment inside the validity period. Beginning recruitment is enough: a PERM whose first recruitment step started inside the window can be filed after the determination has expired, subject to the 180-day recruitment rule.",
  },
  {
    q: "Can the determination be used for more than one filing?",
    a: "It is issued for one employer, one occupation and one area of intended employment. A different job or worksite needs its own request.",
  },
  {
    q: "How long does a wage request take to come back?",
    a: "That is a queue, not a rule. The prevailing wage queue calculator linked below reads DOL's published position for the month a request was filed.",
  },
];

export default function PwdValidityPage() {
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
          Prevailing wage determination validity
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Ninety days, or June 30, depending on the month it was issued. Enter
          the determination date and the page says which rule applied.
        </p>
      </header>
      <section className="mt-10">
        <PwdValidityCalculator />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/pwd-validity"
        reading={[
          { href: "/tools/pwd-calculator", label: "Prevailing wage queue", note: "how long a request waits before the determination exists" },
          { href: "/tools/perm-deadline-calculator", label: "PERM deadline calculator", note: "the recruitment and filing windows the determination caps" },
          { href: "/pwd-cases", label: "Wage request search", note: "pending and decided requests by employer" },
        ]}
      />
    </div>
  );
}
