/**
 * FAQ Page
 *
 * Comprehensive PERM and PERM Tracker FAQ page.
 * FAQPage JSON-LD for rich results and AI citability.
 */

import { Fragment } from "react";
import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { getFAQPageSchema } from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { FAQPageClient } from "./FAQPageClient";
import { averagePhrase, dolNow } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

const START_LINKS = [
  { href: "/perm-processing-times", label: "Processing times", note: "Which month DOL is reviewing now" },
  { href: "/tools", label: "Live PERM data", note: "The queue and the wage backlog, from DOL's figures" },
  { href: "/calculators", label: "Calculators", note: "Deadlines and decision estimates" },
  { href: "/for-attorneys", label: "For attorneys", note: "Free case and deadline tracking" },
] as const;

export const dynamic = "force-static";
// One answer quotes DOL's published average, so the page refreshes daily and
// whenever DOL republishes (it is on revalidate-dol's list).
export const revalidate = 86400;

// Replaced at render with DOL's current average and its date (lib/dolNow.ts).
const DOL_AVERAGE = "{dolAverage}";

export const metadata: Metadata = withSocialCard({
  // Named for what the page answers (it is the main sitelink under a search
  // for "perm tracker", 23,571 appearances in the 3 months to Oct 5 2026).
  title: "PERM FAQ: Timelines, Audits and Next Steps",
  description:
    "Plain answers to common PERM questions: how long it takes, what triggers an audit, the denial rate, the I-140 deadline and how to check your status.",
  alternates: { canonical: "/faq" },
  openGraph: {
    ...openGraphBase,
    title: "PERM FAQ: Timelines, Audits and Next Steps | PERM Tracker",
    description:
      "Plain answers to common PERM questions: how long it takes, what triggers an audit, the denial rate, the I-140 deadline and how to check your status.",
    url: "/faq",
  },
}, "faq");

// Comprehensive FAQ data — all plain text for structured data compatibility
const faqData = [
  {
    // The four brand-defining questions (what it does, is it free, client
    // data, import) live on the HOMEPAGE; see
    // components/home/faqData.tsx. This page keeps the process questions.
    category: "Using PERM Tracker",
    items: [
      {
        question: "How is this different from using a spreadsheet?",
        answer:
          "Spreadsheets require manual deadline math, don’t send reminders, and break when regulations change. PERM Tracker auto-calculates 11 deadline types per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes.",
      },
      {
        question: "What happens if DOL changes regulations?",
        answer:
          "We monitor DOL regulatory changes and update the deadline calculations accordingly. When regulations change, your existing cases are recalculated automatically. You don’t need to manually update formulas or check for rule changes.",
      },
    ],
  },
  {
    category: "The PERM process",
    items: [
      {
        question: "What’s PERM labor certification?",
        answer:
          "PERM (Program Electronic Review Management) is the process by which U.S. employers demonstrate to the Department of Labor that there are no qualified, willing, and available U.S. workers for a position offered to a foreign national. It’s typically the first step in the employment-based green card process for EB-2 and EB-3 categories.",
      },
      {
        question: "How long does the PERM process take?",
        answer:
          "The complete PERM process typically runs 18 to 36 months end to end: the prevailing wage determination, the recruitment period (2-3 months), the 30-day quiet period, and DOL's processing of the ETA 9089 itself, which DOL's own published average puts at {dolAverage}. Cases selected for audit take longer. The processing times page carries the live figure, and the case status page reads any specific case number.",
      },
      {
        question: "What are the main steps in the PERM process?",
        answer:
          "The PERM process has five main stages: (1) Prevailing Wage Determination: submit to NPWC and receive the wage level for the position. (2) Recruitment: conduct required advertising including SWA job order, newspaper ads, and additional recruitment steps for professional occupations. (3) Filing: submit ETA Form 9089 electronically after the 30-day cooling-off period. (4) DOL Review: wait for DOL adjudication (approval, denial, or audit). (5) I-140 Filing: file the immigrant petition within 180 days of PERM certification.",
      },
      {
        question: "What’s a prevailing wage determination (PWD)?",
        answer:
          "The National Prevailing Wage Center sets the minimum wage an employer must offer for the role, from its occupation, skill level and area. Validity is anchored to the wage year, not counted from the determination date: one issued 30 June 2026 is good for 90 days, one issued the next morning is good for 364. The PERM has to be filed before it expires. Track a request by putting its P- number into case status, or search by employer.",
      },
      {
        question: "What recruitment steps are required for PERM?",
        answer:
          "All PERM cases require: a State Workforce Agency (SWA) job order for 30 days, two print newspaper advertisements, and a 30-day internal company posting. Professional occupations (requiring a bachelor's degree or higher) also need three additional recruitment steps from a list including: job fairs, employer website posting, employee referral program, campus recruitment, trade/professional organizations, or private placement agencies.",
      },
      {
        question: "What triggers a PERM audit?",
        answer:
          "Common PERM audit triggers include: layoffs in the same occupation within 6 months, job requirements that exceed the norm for the occupation (such as requiring a specific degree or foreign language without business necessity), discrepancies between the job offer and the beneficiary's qualifications, unusual wage levels, and random selection. Clean documentation and well-justified job requirements reduce audit risk.",
      },
      {
        question: "What’s the ETA 9089 filing window?",
        answer:
          "The ETA 9089 must be filed no earlier than 30 days after the end of all recruitment activities and no later than 180 days after recruitment ends. This 30-180 day filing window is a critical deadline: filing too early results in denial, and missing the 180-day cutoff means restarting recruitment entirely. PERM Tracker automatically calculates this window based on your recruitment end dates.",
      },
      {
        question: "How long do I have to file the I-140 after PERM certification?",
        answer:
          "The I-140 immigrant petition must be filed within 180 days of PERM certification. Missing this deadline means the PERM certification expires and the entire process must be restarted. PERM Tracker tracks this deadline automatically and sends notifications as it approaches.",
      },
    ],
  },
  {
    category: "The live data",
    items: [
      {
        question: "Is there any way to check my PERM status myself?",
        answer:
          "Yes. Most advice says only the employer or the attorney can check a pending PERM, and that's wrong: DOL's own FLAG system answers a case number for anyone who has it, pending cases included. Put yours into case status for the live DOL status, your place in the queue, a stage-aware estimate and an optional email alert. Wage request (P-) and H-1B LCA (I-) numbers work the same way. The number is on the filing receipt, or search the employer by name.",
      },
      {
        question: "Where do the processing time numbers come from?",
        answer:
          "Straight from the Department of Labor. The queue position and average days come from DOL's own published processing times, refreshed automatically, and the medians come from DOL's quarterly disclosure files: 250,000+ real decided cases, unioned and de-duplicated by case number. The methodology page lists every source and how each figure is built.",
      },
      {
        question: "Which states file the most PERM cases?",
        answer:
          "California and Texas lead by a wide margin, and volume tracks industry concentration rather than a faster or slower line: DOL works one national queue, oldest first. The interactive state map shows filings, approval rates, median days and median wages for every state, from DOL's own files.",
      },
      {
        question: "What do PERM cases pay?",
        answer:
          "The wages page shows median offered wages by occupation from DOL's disclosure files. These are wages employers committed to in federal filings. Hourly and other units are annualized before medians are taken.",
      },
      {
        question: "What’s the PERM denial rate?",
        answer:
          "Denials are rare: across DOL's current disclosure window under 3% of decided PERM cases were denied, with withdrawn cases excluded from both sides of that ratio. The rate isn’t evenly spread. The denial rates page breaks it down by offered wage, by fiscal year, and by the three risk questions the ETA-9089 itself asks. A group rate isn’t a probability for any single case.",
      },
      {
        question: "Which law firms file the most PERM cases?",
        answer:
          "Fragomen files by far the most, followed by Berry Appleman & Leiden and Ogletree Deakins. Our law firms page ranks the most active firms with case volume, approval rate and median processing days, straight from the firm name DOL prints on every filing. One caution the page states too: DOL prints a single practice under several spellings, so a big firm's true total can span more than one row. Approval rates cluster above 99% across the whole list.",
      },
      {
        question: "Which employers sponsor the most green cards?",
        answer:
          "The employers page ranks the hundred biggest PERM sponsors in the current disclosure window, searchable, with each one's filings, certifications, approval rate and median processing days. Names appear exactly as DOL prints them, so one company can appear under several legal entities.",
      },
    ],
  },
];

export default async function FAQPage() {
  const average = averagePhrase(dolNow(await getProcessingTimes().catch(() => null)));
  const faq = faqData.map((section) => ({
    ...section,
    items: section.items.map((i) => ({ ...i, answer: i.answer.replace(DOL_AVERAGE, average) })),
  }));
  // Flatten all FAQ items for structured data
  const allFAQs = faq.flatMap((section) => section.items);
  const { '@context': _1, ...faqSchema } = getFAQPageSchema(allFAQs);
  const schemas = { '@context': 'https://schema.org', '@graph': [faqSchema] };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />

      <section className="border-b-2 border-border bg-card">
        <div className="mx-auto max-w-[800px] px-4 py-10 sm:px-8 sm:py-14">
          <h1 className="mb-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Frequently asked questions
          </h1>{" "}
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            What applicants and attorneys ask about PERM Tracker and
            the PERM labor certification process.
          </p>{" "}
          {/* Most visits here come from a search for the site's name, and
              the pages people open next are the lookup, processing times
              and the data (PostHog, 30 days to Oct 6 2026). */}
          <CaseLookupForm className="mt-8 max-w-2xl" />{" "}
          <nav aria-label="Main tools" className="mt-6 grid gap-3 sm:grid-cols-2">
            {START_LINKS.map((l) => (
              <Fragment key={l.href}>
                {" "}
                <Link
                  href={l.href}
                  className="border-2 border-border bg-background p-4 transition-shadow hover:shadow-hard"
                >
                  <span className="font-heading text-sm font-bold">{l.label}</span>{" "}
                  <p className="mt-1 text-sm text-muted-foreground">{l.note}</p>
                </Link>
              </Fragment>
            ))}
          </nav>
        </div>
      </section>{" "}

      <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-8 sm:py-12">
        <FAQPageClient faqData={faq} />

        <div className="mt-12 border-t-2 border-border pt-8">
          <h2 className="mb-4 font-heading text-xl font-bold">Learn more</h2>{" "}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/blog/what-is-perm-labor-certification"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">What’s PERM?</span>{" "}
              <p className="mt-1 text-sm text-muted-foreground">Complete overview of the PERM process</p>
            </Link>{" "}
            <Link
              href="/guides/ultimate-perm-guide-2026"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">The ultimate PERM guide, 2026</span>{" "}
              <p className="mt-1 text-sm text-muted-foreground">Comprehensive filing reference</p>
            </Link>{" "}
            <Link
              href="/blog/perm-processing-times-2026"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">Processing times in 2026</span>{" "}
              <p className="mt-1 text-sm text-muted-foreground">Current DOL timelines</p>
            </Link>{" "}
            <Link
              href="/guides/getting-started"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">Getting started</span>{" "}
              <p className="mt-1 text-sm text-muted-foreground">Set up your first case in minutes</p>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
