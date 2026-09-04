import type { Metadata } from "next";
import Link from "next/link";

import { I140Trends } from "@/components/tools/I140Trends";
import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { getI140Trends } from "@/lib/turso/publicData";
import { quartersFor, totalsFor } from "@/lib/i140Trends";

/**
 * I-140 outcomes by category, quarter by quarter.
 *
 * A SEPARATE ROUTE FROM /tools/i140-calculator ON PURPOSE. That page answers
 * "how deep is the queue at my priority date", which is a position question
 * about one person. This one answers "how have receipts and outcomes moved by
 * category", which is a trend question about the programme. Someone searching
 * for I-140 trends should land on the page that answers it rather than on a
 * queue-position calculator they have to scroll past.
 */

const TITLE = "I-140 Trends by Category";
const DESCRIPTION =
  "USCIS I-140 receipts, approvals, denials and pending petitions by employment-based category, quarter by quarter, with denial rates measured over decided petitions.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/i140-trends" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/i140-trends",
  },
};

// USCIS publishes quarterly, so a day bounds staleness far below its cadence.
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

const FAQS = [
  {
    q: "Is E21 the same as a National Interest Waiver?",
    a: "No, and conflating them is the most common error in this data. E21 is USCIS's category for advanced-degree professionals, which on a PERM is an employer-sponsored petition. A national interest waiver is a self-petition that waives the job offer entirely. USCIS reports them as separate lines and their outcomes are nothing alike.",
  },
  {
    q: "Why is the denial rate measured over decided petitions?",
    a: "Because a rate over receipts moves with the backlog rather than with outcomes. In a quarter where USCIS simply decided fewer petitions, a receipts-based rate falls even though nothing about approvals or denials changed. Denied divided by approved plus denied answers the question people are actually asking.",
  },
  {
    q: "Why can I not add the categories together?",
    a: "Because they are a hierarchy. EB1 is the sum of E11, E12 and E13; EB2 is E21 plus NIW; EB3 is E31, E32 and EW3. Adding a preference to its own subtypes counts the same petition twice, so the selector keeps the two levels apart.",
  },
  {
    q: "Why do some quarters not appear?",
    a: "USCIS has not published them yet. An unreported quarter is left out rather than drawn as zero, because a bar at zero reads as filings collapsing rather than as data that does not exist.",
  },
];

export default async function I140TrendsPage() {
  const rows = await getI140Trends();

  // The page's own argument, computed rather than asserted: if these two ever
  // converge, the copy below should stop claiming they diverge.
  const e21 = totalsFor(quartersFor(rows, "E21"));
  const niw = totalsFor(quartersFor(rows, "NIW"));
  const bothRates = e21.denialRate !== null && niw.denialRate !== null;
  const ratio =
    bothRates && e21.denialRate! > 0 ? niw.denialRate! / e21.denialRate! : null;

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
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          I-140 trends by category
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          What USCIS received, approved, denied and still has pending in each
          employment-based category, quarter by quarter, in its own words.
        </p>
      </header>

      {/* The distinction that gives this page its reason to exist, stated
          before any chart, with the figures computed from the same rows the
          charts read. */}
      {bothRates && ratio !== null ? (
        <section className="mt-8 border-2 border-border bg-tint-primary p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            An advanced degree and a national interest waiver are not the same
            category
          </h2>{" "}
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
            Both sit inside EB-2, and USCIS reports them separately. Over the
            quarters here,{" "}
            <b className="font-bold text-foreground">
              E21 was denied {e21.denialRate!.toFixed(2)}% of the time and a
              national interest waiver {niw.denialRate!.toFixed(2)}%
            </b>
            , a difference of about {ratio.toFixed(0)} times. E21 is an
            employer-sponsored petition, which is what a PERM leads to; a
            waiver is a self-petition that asks USCIS to set the job offer
            aside. Trackers that label E21 &ldquo;National Interest
            Waiver&rdquo; put the smaller, safer number under the riskier name.
          </p>
        </section>
      ) : null}

      <section className="mt-8">
        <I140Trends rows={rows} />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["i140-trends"]} />

      <ToolPageFooter
        currentHref={"/tools/i140-trends"}
        reading={[
          {
            href: "/tools/i140-calculator",
            label: "I-140 queue position",
            note: "How deep the backlog is at a given priority date, rather than how outcomes have moved.",
          },
          {
            href: "/tools/green-card-timeline",
            label: "The whole green card timeline",
            note: "Where the I-140 sits between the labour certification and the visa number.",
          },
        ]}
      />
    </div>
  );
}
