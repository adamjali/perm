import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { PwdQueueEstimator } from "@/components/tools/PwdQueueEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";

/**
 * Prevailing wage determination queue calculator.
 *
 * The PWD is the first step of a PERM and it gates every date after it, and
 * essentially every public PERM estimator skips it and starts the clock at the
 * ETA-9089. It also happens to have the better data behind it: DOL publishes
 * pending counts per receipt month here, which it does not for PERM itself.
 */

const TITLE = "PWD Processing Time Calculator";
const DESCRIPTION =
  "How many prevailing wage requests sit ahead of yours, from DOL's own published backlog. The first PERM step, and the one that sets every deadline.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/pwd-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/pwd-calculator",
  },
};

export const revalidate = 3600;

const FAQS = [
  {
    q: "What is a prevailing wage determination?",
    a: "It is DOL's ruling on the minimum wage an employer must offer for a specific job in a specific place. It is filed on form ETA-9141 and it has to be issued before the PERM recruitment can be relied on, which is why it sits in front of everything else.",
  },
  {
    q: "Why does the prevailing wage queue matter so much?",
    a: "Because the determination date, not the filing date, is what the rest of the case is measured from. The recruitment window and the ETA-9089 filing window are both arithmetic on it, and the determination itself expires, so a long wage queue moves every deadline that follows.",
  },
  {
    q: "Why is there no estimated wait shown?",
    a: "DOL publishes how many requests are pending but not how fast it clears them. The count of requests ahead of you is exact and comes straight from DOL. Turning that into a date needs a clearance rate, and rather than assume one we measure it from DOL's own figures as they change over time.",
  },
  {
    q: "What is the difference between the OEWS and non-OEWS queues?",
    a: "OEWS is the Occupational Employment and Wage Statistics survey, which is the default wage source. A request that relies on a different source, like an employer-provided survey, goes through a separate queue that DOL reports separately and which usually runs at a different pace.",
  },
];

export default async function PwdCalculatorPage() {
  const data = await fetchQuery(api.permEstimate.getPwdEstimatorData, {}).catch(() => null);

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
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Prevailing wage queue calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How many prevailing wage requests sit ahead of yours, counted from the
          Department of Labor&apos;s own published backlog.
        </p>
      </header>

      <section className="mt-10">
        <PwdQueueEstimator
          frontier={data ? data.frontier : null}
          backlog={data ? data.backlog : []}
          asOf={data ? data.asOf : null}
          clearancePerMonth={data ? data.clearancePerMonth : null}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">
          Once the determination lands, the clock is arithmetic
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          The wait is out of your hands. What happens after is not: the
          recruitment window, the quiet period and the filing window all run
          from the determination date, and missing one restarts the case.
        </p>
        <Link
          href="/tools/perm-deadline-calculator"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Work out those dates
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <ToolPageFooter
        currentHref={"/tools/pwd-calculator"}
        reading={[
          { href: "/guides/complete-perm-filing-guide", label: "The complete filing guide", note: "What the determination is for, and every date it sets once issued." },
          { href: "/perm-processing-times", label: "DOL processing times", note: "The prevailing wage queues alongside the PERM ones, from DOL's own page." },
        ]}
      />
    </div>
  );
}
