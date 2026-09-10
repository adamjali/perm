import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { RfiDeadlineCalculator } from "@/components/tools/RfiDeadlineCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The RFI and audit response deadline as a calculator.
 *
 * The most time-critical date in a PERM after filing, and the one with the
 * harshest consequence: no response means denial and up to two years of
 * supervised recruitment. It reuses the canonical calculator the app's own
 * case tracker runs on, so the two cannot disagree.
 */

const TITLE = "PERM RFI and Audit Response Deadline Calculator";
const DESCRIPTION =
  "The last day to answer a PERM audit letter: 30 calendar days from the date on DOL's letter under 20 CFR 656.20, with the weekday and the days left.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/rfi-deadline" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/rfi-deadline" },
}, "rfi-deadline");

export const dynamic = "force-static";

const FAQS = [
  {
    q: "Is it 30 days from the letter or from when we received it?",
    a: "From the date of the letter. 20 CFR 656.20(b) says the employer must respond within 30 days of the date of the audit letter. Mail time comes out of the 30, which is why the response window is usually shorter than a month in practice.",
  },
  {
    q: "What happens if the deadline is missed?",
    a: "The application is denied, and 20 CFR 656.20 lets the Certifying Officer require supervised recruitment on the employer's future applications for up to two years. The regulation gives the Certifying Officer discretion to extend the period; there is no right to an extension, and a request has to go in before the deadline.",
  },
  {
    q: "Does an RFI in FLAG follow the same rule?",
    a: "The case status RFI ISSUED on flag.dol.gov is DOL's request for information on a filed application. The letter states its own response period; the 30 days here is the audit rule, and the letter governs if it says otherwise.",
  },
  {
    q: "What does the deadline do to the case's place in line?",
    a: "A case that leaves the ordinary queue for an audit or RFI is worked outside filing order. Our measured stage medians for cases under review are on the RFI and audit page linked below.",
  },
];

export default function RfiDeadlinePage() {
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
          RFI and audit response deadline
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Thirty calendar days from the date on DOL&apos;s letter, counted the
          way the regulation counts it. Enter the letter&apos;s date.
        </p>
      </header>
      <section className="mt-10">
        <RfiDeadlineCalculator />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/rfi-deadline"
        reading={[
          { href: "/perm-rfi-audit", label: "RFI and audit rates", note: "how often cases leave filing order, and how long they wait" },
          { href: "/tools/perm-deadline-calculator", label: "PERM deadline calculator", note: "every other date in the PERM" },
          { href: "/perm-case-status", label: "Case status", note: "whether DOL has your case at RFI ISSUED today" },
        ]}
      />
    </div>
  );
}
