import type { Metadata } from "next";
import Link from "next/link";

import { VisaChooser } from "@/components/tools/VisaChooser";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Which employment-based green card categories could fit, from a few answers
 * read against 8 CFR 204.5's definitions. Information, not legal advice; the
 * rules are `lib/visaChooser.ts`.
 */

const TITLE = "Which Employment Green Card Fits You";
const DESCRIPTION =
  "Answer a few questions about the job and yourself to see which employment green card categories the regulation's definitions point to, and what each needs.";
const PATH = "/tools/which-green-card";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "which-green-card");

const FAQS = [
  {
    q: "Does my degree decide EB-2 or EB-3?",
    a: "On a PERM, the job decides. The regulation bases the category on the training and experience the employer requires for the job, as DOL certified it. Someone with a master's degree in a job requiring a bachelor's is in EB-3, and in a job requiring under two years of experience is an EB-3 Other Worker.",
  },
  {
    q: "Which categories don't need an employer?",
    a: "Two: EB-1A for extraordinary ability, and the EB-2 national interest waiver. Either can be filed by the person themselves. Every other employment category needs a US employer, and EB-2 and EB-3 through an employer need a PERM first.",
  },
  {
    q: "What is the national interest waiver test?",
    a: "USCIS applies three parts, from Matter of Dhanasar: the proposed work has substantial merit and national importance, the person is well positioned to advance it, and on balance it would benefit the United States to waive the job offer and labor certification. It also needs an advanced degree or exceptional ability.",
  },
  {
    q: "Can I be in more than one category?",
    a: "Yes. People file in several at once, for example a PERM-based EB-2 and a national interest waiver, or EB-2 and EB-3 on the same PERM. The earliest priority date can carry to a later petition under conditions the retention tool walks through.",
  },
];

export default function WhichGreenCardPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "Calculators", href: "/calculators" },
    { name: "Which green card", href: PATH },
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/tools" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Data
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href="/calculators" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Calculators
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Which employment green card fits?</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          A few questions about the job and about you, matched against the regulation&apos;s own definitions: which
          categories could apply, whether each needs a PERM or an employer, and where its queue stands.
        </p>
      </header>

      <section className="mt-10">
        <VisaChooser />
      </section>

      <details className="group mt-12 border-2 border-border p-6 sm:p-8">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
          What this can&apos;t tell you
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/80">
          <li>Whether your evidence meets a definition. That&apos;s USCIS&apos;s decision, and an attorney&apos;s job to judge first.</li>{" "}
          <li>Anything about family-sponsored or investment green cards beyond pointing to them.</li>{" "}
          <li>Temporary visas such as H-1B or L-1, which are a separate question from the green card category.</li>{" "}
          <li>How long a category takes. Each result links to its bulletin line and, for EB-2 and EB-3, the people ahead.</li>
        </ul>
        <p className="mt-3 text-base text-foreground/75">
          Definitions from 8 CFR 204.5 (eCFR, read Sep 26, 2026) and USCIS&apos;s national interest waiver guidance
          (Policy Manual Volume 6, Part F, Chapter 5, current as of Sep 23, 2026).
        </p>
      </details>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </section>

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/guides/eb2-vs-eb3-perm", label: "EB-2 vs EB-3 on a PERM", note: "what decides the category, and what a downgrade keeps" },
          { href: "/guides/perm-vs-niw", label: "PERM vs the national interest waiver", note: "the two EB-2 routes side by side" },
          { href: "/tools/priority-date-retention", label: "Priority date retention", note: "when an earlier date carries to a new petition" },
        ]}
      />
    </div>
  );
}
