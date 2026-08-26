import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { PermDeadlineCalculator } from "@/components/tools/PermDeadlineCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";

/**
 * Public PERM deadline calculator.
 *
 * The deadline engine has always existed and has always been behind a signup.
 * Putting it in front of one costs nothing: the arithmetic is a regulation
 * anyone can read, and the product was never the formula. It is the tracking,
 * the cascade when a date moves, and the warning that arrives before the
 * deadline rather than after it.
 */

const TITLE = "PERM Deadline Calculator";
const DESCRIPTION =
  "Work out every PERM deadline from the prevailing wage determination: recruitment window, notice of filing, quiet period and the ETA-9089 filing window.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/perm-deadline-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/perm-deadline-calculator",
  },
};

export const dynamic = "force-static";

const FAQS = [
  {
    q: "When does the PERM filing window open and close?",
    a: "It opens 30 days after the last recruitment step, which is the quiet period, and closes 180 days after the first recruitment step. Filing inside the quiet period is an automatic denial, and recruitment older than 180 days can’t support a filing at all.",
  },
  {
    q: "When does a prevailing wage determination expire?",
    a: "Under 20 CFR 656.40(c) it depends on when it was issued. A determination issued between 2 April and 30 June is valid for 90 days. One issued between 1 July and 31 December runs to 30 June of the following year, and one issued between 1 January and 1 April runs to 30 June of the same year.",
  },
  {
    q: "How long does the notice of filing have to be posted?",
    a: "Ten consecutive business days, and it has to be completed inside the recruitment window rather than after it.",
  },
  {
    q: "Does this cover professional occupations?",
    a: "Only partly. The dates here are the ones every case has. A professional role needs three additional recruitment steps beyond these, chosen from DOL's list, and each has its own timing rules.",
  },
];

export default function PermDeadlineCalculatorPage() {
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
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM deadline calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Every date the regulations fix, worked out from your prevailing wage
          determination. Nothing here’s a forecast.
        </p>
      </header>

      <section className="mt-10">
        <div className="pop mt-10">
          <PermDeadlineCalculator />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">
          Working these out once is the easy part
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          The hard part is a year later, when a determination date moves and
          every date after it moves with it. PERM Tracker recalculates the whole
          chain when anything changes and warns you before a deadline rather
          than after it.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Start tracking free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">Free, and there’s no case limit.</p>
      </section>

      <ToolPageFooter
        currentHref={"/tools/perm-deadline-calculator"}
        reading={[
          { href: "/guides/perm-recruitment-checklist", label: "Recruitment checklist", note: "Each step these dates govern, and what counts as completing it." },
          { href: "/guides/tracking-perm-deadlines", label: "Tracking deadlines", note: "How the same dates cascade when a determination date moves." },
        ]}
      />
    </div>
  );
}
