import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { PermDeadlineCalculator } from "@/components/tools/PermDeadlineCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { buttonVariants } from "@/components/ui/button";

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
  "Every PERM deadline from the prevailing wage determination: recruitment, notice of filing and the filing window. Copy them or add them to a calendar.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/perm-deadline-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/perm-deadline-calculator",
  },
}, "perm-deadline-calculator");

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
    q: "Can the ETA 9089 be filed after the wage determination expires?",
    a: "Yes, if recruitment began while the determination was valid. 20 CFR 656.40(c) asks employers to file or begin recruitment within the validity period, and the Board of Alien Labor Certification Appeals read it that way in Karl Storz Endoscopy-America (2011). The window then closes 180 days after the first recruitment step. Recruitment begun before the determination was issued means filing by the expiration.",
  },
  {
    q: "How long does the notice of filing have to be posted?",
    a: "Ten consecutive business days, and it has to be completed inside the recruitment window rather than after it.",
  },
  {
    q: "How do I put PERM deadlines in Outlook or Google Calendar?",
    a: "Enter the dates and choose Add to calendar. It saves one calendar file with every deadline as an all-day event and a reminder a week before each, which Outlook, Google Calendar and Apple Calendar all open.",
  },
  {
    q: "Can I copy the dates into a spreadsheet or Salesforce?",
    a: "Yes. Copy all dates puts every deadline on the clipboard as plain text, one line each with its name, ready to paste into a spreadsheet, a case system such as Salesforce, or an email. Any warning about the dates entered is copied with them.",
  },
  {
    q: "Can I get reminders before each deadline?",
    a: "Save the dates as a case in PERM Tracker, free for attorneys and their teams, and it reminds you 30, 14, 7, 3 and 1 day before each deadline, by email and in the app. The calendar file carries its own reminder a week before each date.",
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          PERM deadline calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every deadline in your case, calculated from your prevailing wage
          determination. Nothing here’s a forecast.
        </p>
      </header>

      <section className="mt-10">
        <div data-embed="perm-deadlines" className="mt-10">
          <PermDeadlineCalculator />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 bg-tint p-6 sm:p-8 border-2 shadow-hard border-border">
        <h2 className="font-heading text-2xl font-bold">
          Working these out once is the easy part
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The hard part is a year later, when a determination date moves and
          every date after it moves with it. PERM Tracker recalculates the whole
          chain when anything changes and warns you before a deadline rather
          than after it.
        </p>
        <Link
          href="/signup"
          className={buttonVariants({ variant: "outline", size: "lg", className: "mt-6" })}
        >
          Start tracking free
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
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
