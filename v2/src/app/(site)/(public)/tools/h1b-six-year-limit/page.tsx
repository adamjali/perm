import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { H1bMaxOutCalculator } from "@/components/tools/H1bMaxOutCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The H-1B six-year limit against the PERM 365-day rule, as a calculator.
 *
 * The most common timing question on the H-1B side of a green card, and one
 * with a hard date in it: a PERM filed 365 days or more before the sixth
 * anniversary of H-1B status keeps one-year extensions available under AC21
 * section 106(a). The page prints the two dates and the citations; it does
 * not count time in other statuses or time abroad, which only the person
 * holding the passport can.
 */

const TITLE = "H-1B Six-Year Limit and the PERM 365-Day Rule Calculator";
const DESCRIPTION =
  "When H-1B status maxes out, and the last day to file a PERM so one-year extensions stay available under AC21 section 106(a). Two dates, with the citations.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/h1b-six-year-limit" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/h1b-six-year-limit" },
}, "h1b-six-year-limit");

export const dynamic = "force-static";

const FAQS = [
  {
    q: "What is the 365-day rule?",
    a: "AC21 section 106(a), at 8 CFR 214.2(h)(13)(iii)(D), lets an employer extend H-1B status in one-year increments beyond the six-year limit when a labor certification (the PERM) or an I-140 was filed at least 365 days before the extension would take effect, and the case has not been denied, withdrawn or abandoned. The PERM's filing date is DOL's receipt date, which is also the case's priority date.",
  },
  {
    q: "What if the PERM is filed inside the last 365 days?",
    a: "The one-year extensions under 106(a) are not available on that filing. A three-year extension under section 104(c), at 8 CFR 214.2(h)(13)(iii)(E), needs an approved I-140 and a priority date that is not current; it does not depend on the 365 days. Time spent outside the United States during H-1B status can also be recaptured to push the limit later.",
  },
  {
    q: "Does time in L-1 status count toward the six years?",
    a: "Yes. INA 214(g)(4) and 8 CFR 214.2(h)(13)(iii)(A) count time in H-1B and L-1 status together toward the six-year limit. Enter the earliest start of either status.",
  },
  {
    q: "Is this legal advice?",
    a: "No. It is arithmetic on the dates you enter, with the regulation each date comes from. Whether your particular history qualifies, including gaps, recapture and prior petitions, is a question for the attorney who files.",
  },
];

export default function H1bSixYearLimitPage() {
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
          H-1B six-year limit and the PERM 365-day rule
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The day H-1B status runs out, and the last day a PERM can be filed so
          the one-year extensions stay open. Dates and citations, nothing
          predicted.
        </p>
      </header>
      <section className="mt-10">
        <H1bMaxOutCalculator />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/h1b-six-year-limit"
        reading={[
          { href: "/tools/perm-deadline-calculator", label: "PERM deadline calculator", note: "every date in the PERM itself" },
          { href: "/perm-processing-times", label: "PERM processing times", note: "how long the filing waits once it is in" },
          { href: "/guides/three-180-day-clocks", label: "The three 180-day clocks", note: "the rules that start after certification" },
        ]}
      />
    </div>
  );
}
