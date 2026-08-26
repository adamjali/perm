import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { PermTimelineEstimator } from "@/components/tools/PermTimelineEstimator";
import { QueueAlertForm } from "../../perm-processing-times/QueueAlertForm";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { currentMonthUtc } from "@/lib/dolFormat";
import { DataNav } from "@/components/tools/DataNav";
import { getEstimatorData } from "@/lib/turso/estimate";

/**
 * PERM decision-date calculator.
 *
 * Deliberately a separate URL from /perm-processing-times rather than a section
 * of it. That page answers "what are the times", this one answers "what about
 * mine", and those are different searches: one wants a reference figure, the
 * other wants a tool. One URL cannot rank for both, and merging them would put
 * a calculator on a page people arrive at to read a table.
 */

const TITLE = "PERM Processing Time Calculator";
const DESCRIPTION =
  "Estimate when the Department of Labor will decide your PERM case, from DOL's own published queue data and disclosure files, with every source shown.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/perm-timeline-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/perm-timeline-calculator",
  },
};

// DOL publishes weekly and the disclosure files are quarterly, so an hour of
// cache costs nothing in freshness and keeps this page static for crawlers.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

const FAQS = [
  {
    q: "How accurate is a PERM processing time estimate?",
    a: "It’s a forecast over a queue, not a deadline, so it’s wrong by some margin every time. The honest way to read it’s as a range that narrows as DOL gets closer to your filing month. Public PERM estimators currently disagree with each other by around nine months on the same filing date, mostly because they assume different things about how fast DOL is moving.",
  },
  {
    q: "Why do you show more than one number?",
    a: "Because they measure different things. DOL's published average looks backwards at cases it has already closed, which drags it up with audited and long-running ones. A queue-advance figure looks forwards from how fast the queue is actually moving. Showing one and hiding the other would make the estimate look more certain than it is.",
  },
  {
    q: "Does DOL decide PERM cases in the order they were filed?",
    a: "Broadly, but not strictly. DOL works through filing months in order and goes alphabetically by employer name within a month. An audit, supervised recruitment, or a request for information takes a case out of that order and adds months, and none of those are predictable from a filing date.",
  },
  {
    q: "My filing month has already passed and I have no decision. What does that mean?",
    a: "It usually means the case is in audit, in supervised recruitment, or waiting on a response to a request for information. Those run on their own queues, which DOL publishes separately from analyst review.",
  },
];

export default async function PermTimelineCalculatorPage() {
  // Wrapped: a page that cannot reach Convex must still render its explanation,
  // its FAQ and its signup rather than failing the route outright.
  const data = await getEstimatorData();

  const today = new Date().toISOString().slice(0, 10);

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
          PERM processing time calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Estimate when the Department of Labor will decide your case, from
          DOL&apos;s own queue figures and its published record of decided cases.
        </p>
      </header>

      <section className="mt-10">
        <PermTimelineEstimator
          frontier={data ? data.frontier : null}
          cohorts={data ? data.cohorts : []}
          frontierAdvance={data ? data.frontierAdvance : null}
          frontierHistory={data ? data.frontierHistory : []}
          disclosure={data ? data.disclosure : null}
          today={today}
        />
      </section>

      {/* The one thing here that genuinely needs an email, offered after the
          answer rather than in front of it. */}
      <section className="mt-10">
        <QueueAlertForm source="perm-timeline-calculator" newestMonth={currentMonthUtc()} />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">
          DOL&apos;s date is a forecast. Yours are arithmetic.
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          Nobody can tell you exactly when DOL will decide. The dates that are
          genuinely fixed are the ones on your side of the process: the
          recruitment window, the quiet period, the filing window and the
          I-140 deadline. Every one of them is arithmetic on your prevailing wage
          determination, and getting one wrong restarts the case.
        </p>
        <Link
          href="/tools/perm-deadline-calculator"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Work out your deadlines
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <ToolPageFooter
        currentHref={"/tools/perm-timeline-calculator"}
        reading={[
          { href: "/perm-processing-times", label: "DOL processing times", note: "Every queue DOL publishes, refreshed weekly, with the figures this calculator reads." },
          { href: "/blog/perm-processing-times-2026", label: "What drives a PERM timeline", note: "Audits, supervised recruitment and the things that take a case out of order." },
        ]}
      />
    </div>
  );
}
