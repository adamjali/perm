/**
 * FAQ Page
 *
 * Comprehensive PERM and PERM Tracker FAQ page.
 * FAQPage JSON-LD for rich results and AI citability.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getFAQPageSchema } from "@/lib/structuredData";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { FAQPageClient } from "./FAQPageClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about PERM labor certification, deadlines, recruitment, and case management with PERM Tracker.",
  alternates: { canonical: "/faq" },
  openGraph: {
    ...openGraphBase,
    title: "FAQ | PERM Tracker",
    description:
      "Everything immigration attorneys need to know about PERM Tracker and the PERM labor certification process.",
    url: "/faq",
  },
};

// Comprehensive FAQ data — all plain text for structured data compatibility
const faqData = [
  {
    category: "About PERM Tracker",
    items: [
      {
        question: "What exactly does PERM Tracker do?",
        answer:
          "PERM Tracker automates deadline management for PERM labor certification cases. Enter your case dates, and it auto-calculates every critical deadline: PWD expiration, the 30-180 day ETA 9089 filing window, I-140 filing cutoffs, and more. You get email and push notifications before deadlines hit, plus a calendar view so your whole team stays aligned.",
      },
      {
        question: "How is this different from using a spreadsheet?",
        answer:
          "Spreadsheets require manual deadline math, don't send reminders, and break when regulations change. PERM Tracker auto-calculates 15+ deadlines per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes. One missed formula in a spreadsheet can cost a client their green card.",
      },
      {
        question: "Is PERM Tracker really free?",
        answer:
          "Yes, completely free. No credit card, no trial period, no case limits. Immigration attorneys deserve quality tools without typical SaaS pricing. We may introduce optional premium features in the future, but the core tracking and deadline management will always be free.",
      },
      {
        question: "Is my client data secure?",
        answer:
          "Yes. We use industry-standard encryption, secure Google OAuth authentication, and row-level database security. Your data is isolated: no other firm can see your cases. We also offer Privacy Mode to hide sensitive information during screen sharing or presentations.",
      },
      {
        question: "Can I import my existing cases?",
        answer:
          "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data anytime. Your data is always yours.",
      },
      {
        question: "What happens if DOL changes regulations?",
        answer:
          "We monitor DOL regulatory changes and update our deadline calculation engine accordingly. When regulations change, your existing cases are recalculated automatically. You don't need to manually update formulas or check for rule changes.",
      },
    ],
  },
  {
    category: "PERM Process",
    items: [
      {
        question: "What is PERM labor certification?",
        answer:
          "PERM (Program Electronic Review Management) is the process by which U.S. employers demonstrate to the Department of Labor that there are no qualified, willing, and available U.S. workers for a position offered to a foreign national. It is typically the first step in the employment-based green card process for EB-2 and EB-3 categories.",
      },
      {
        question: "How long does the PERM process take?",
        answer:
          "The complete PERM process typically takes 18 to 36 months from start to finish. This includes the prevailing wage determination (6-12 months), recruitment period (2-3 months), cooling-off period (30+ days), and DOL processing of the ETA 9089 application (currently 8-14 months). Cases selected for audit can add 6-12 additional months.",
      },
      {
        question: "What are the main steps in the PERM process?",
        answer:
          "The PERM process has five main stages: (1) Prevailing Wage Determination: submit to NPWC and receive the wage level for the position. (2) Recruitment: conduct required advertising including SWA job order, newspaper ads, and additional recruitment steps for professional occupations. (3) Filing: submit ETA Form 9089 electronically after the 30-day cooling-off period. (4) DOL Review: wait for DOL adjudication (approval, denial, or audit). (5) I-140 Filing: file the immigrant petition within 180 days of PERM certification.",
      },
      {
        question: "What is a prevailing wage determination (PWD)?",
        answer:
          "A prevailing wage determination is issued by the National Prevailing Wage Center (NPWC) and establishes the minimum wage the employer must offer for the PERM position. The wage is based on the occupation, skill level, and geographic area. PWDs are valid for one year from the determination date, and the PERM application must be filed before expiration.",
      },
      {
        question: "What recruitment steps are required for PERM?",
        answer:
          "All PERM cases require: a State Workforce Agency (SWA) job order for 30 days, two print newspaper advertisements, and a 30-day internal company posting. Professional occupations (requiring a bachelor's degree or higher) also need three additional recruitment steps from a list including: job fairs, employer website posting, employee referral program, campus recruitment, trade/professional organizations, or private placement agencies.",
      },
      {
        question: "What triggers a PERM audit?",
        answer:
          "Common PERM audit triggers include: layoffs in the same occupation within 6 months, job requirements that exceed the norm for the occupation (such as requiring a specific degree or foreign language without business necessity), discrepancies between the job offer and the beneficiary's qualifications, unusual wage levels, and random selection. Clean documentation and well-justified job requirements significantly reduce audit risk.",
      },
      {
        question: "What is the ETA 9089 filing window?",
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
];

// Flatten all FAQ items for structured data
const allFAQs = faqData.flatMap((section) => section.items);

export default function FAQPage() {
  const { '@context': _1, ...faqSchema } = getFAQPageSchema(allFAQs);
  const { '@context': _2, ...breadcrumb } = generateBreadcrumbSchema([{ name: "Home", href: "/" }, { name: "FAQ", href: "/faq" }]);
  const schemas = { '@context': 'https://schema.org', '@graph': [faqSchema, breadcrumb] };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />

      <section className="border-b-2 border-border bg-card">
        <div className="mx-auto max-w-[800px] px-4 py-10 sm:px-8 sm:py-14">
          <h1 className="mb-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Frequently Asked Questions
          </h1>{" "}
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Everything immigration attorneys need to know about PERM Tracker and
            the PERM labor certification process.
          </p>
        </div>
      </section>{" "}

      <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-8 sm:py-12">
        <FAQPageClient faqData={faqData} />

        <div className="mt-12 border-t-2 border-border pt-8">
          <h2 className="mb-4 font-heading text-xl font-bold">Learn More</h2>{" "}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/blog/what-is-perm-labor-certification"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">What is PERM?</span>{" "}
              <p className="mt-1 text-xs text-muted-foreground">Complete overview of the PERM process</p>
            </Link>{" "}
            <Link
              href="/guides/ultimate-perm-guide-2026"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">Ultimate PERM Guide 2026</span>{" "}
              <p className="mt-1 text-xs text-muted-foreground">Comprehensive filing reference</p>
            </Link>{" "}
            <Link
              href="/blog/perm-processing-times-2026"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">Processing Times 2026</span>{" "}
              <p className="mt-1 text-xs text-muted-foreground">Current DOL timelines</p>
            </Link>{" "}
            <Link
              href="/tutorials/getting-started"
              className="border-2 border-border bg-card p-4 transition-shadow hover:shadow-hard"
            >
              <span className="font-heading text-sm font-bold">Getting Started</span>{" "}
              <p className="mt-1 text-xs text-muted-foreground">Set up your first case in minutes</p>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
