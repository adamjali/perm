import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * Priority dates against the visa bulletin.
 *
 * The one page here built on an archive rather than a live feed, because
 * travel.state.gov refuses automated clients. It is framed as a history for
 * that reason: the movement is both the honest thing to show and the useful
 * one, since this month's number is on the State Department's own page and
 * the direction is not.
 */

const TITLE = "Visa Bulletin Priority Date Calculator";
const DESCRIPTION =
  "Check an employment-based priority date against the visa bulletin, and see how the cutoff has moved month by month, including the months it went backwards.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/priority-date-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/priority-date-calculator",
  },
};

export const revalidate = 3600;

const FAQS = [
  {
    q: "What is a priority date?",
    a: "For an employment-based case it is the date DOL received the PERM application, or the date USCIS received the I-140 where no labor certification was required. It is your place in the queue for a visa number, and it stays with you across most category changes.",
  },
  {
    q: "Why is this behind the current bulletin?",
    a: "The State Department publishes the bulletin on a site that refuses automated requests, so these figures come from a public archive of the same pages, which lags by a month or two. Every figure is labelled with the bulletin it came from, and the current month is always one click away on the State Department's own site.",
  },
  {
    q: "What does it mean when a category shows U?",
    a: "Unavailable. No visa numbers are being issued in that category that month, so no priority date is current, however early it is. It usually means the annual limit has been reached and it typically resets at the start of the next fiscal year in October.",
  },
  {
    q: "Can a cutoff move backwards?",
    a: "Yes, and it does. Retrogression happens when demand in a category turns out higher than expected, and a date that was current one month can stop being current the next. That is the main reason this page shows the whole series rather than just the latest number.",
  },
  {
    q: "Which chart should I use, final action or dates for filing?",
    a: "Final action dates govern when a green card can actually be approved. Dates for filing govern when the adjustment application can be submitted, but only in months when USCIS says it is honouring that chart, which it announces separately.",
  },
];

export default async function PriorityDateCalculatorPage() {
  const bulletins = await fetchQuery(api.visaBulletin.getSeries, {}).catch(() => []);

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
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript schema={faqSchema} />

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Priority date calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Where an employment-based priority date sits against the visa bulletin
          cutoffs, and which way those cutoffs have been moving.
        </p>
      </header>

      <section className="mt-10">
        <PriorityDateEstimator bulletins={bulletins} />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <ToolPageFooter
        currentHref={"/tools/priority-date-calculator"}
        reading={[
          { href: "/tools/green-card-timeline", label: "The whole timeline", note: "Where the wait for a visa number sits against everything before it." },
          { href: "/guides/ultimate-perm-guide-2026", label: "The full PERM guide", note: "How the priority date is set, and what preserves it." },
        ]}
      />
    </div>
  );
}
