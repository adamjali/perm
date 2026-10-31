import type { Metadata } from "next";

import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import { BulletinBoard } from "@/components/bulletin/BulletinBoard";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { getVisaBulletinSeries } from "@/lib/db/publicData";
import { getBulletinBoard, categoriesIn } from "@/lib/db/bulletin";

import { DataProvenance } from "@/components/data/DataProvenance";
import { withSocialCard } from "@/lib/socialCard";
import { getUscisCharts } from "@/lib/uscisChartsFetch";
/**
 * Priority dates against the visa bulletin.
 *
 * The one page here built on the bulletin archive rather than a live DOL
 * feed. It is framed as a history: the movement is both the honest thing to
 * show and the useful one, since this month's number is on the State
 * Department's own page and the direction is not.
 *
 * The archive is filled from the State Department's own pages, with the
 * Internet Archive behind it for older months. Whatever the newest month
 * turns out to be, the page reads it from the data and states how far behind
 * the live bulletin that leaves it, rather than carrying a month in prose
 * that the ingest can outrun.
 */

const TITLE = "Visa Bulletin Priority Date Calculator";
const DESCRIPTION =
  "Check an employment-based priority date against the visa bulletin, and see how the cutoff has moved month by month, including the months it went backwards.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/priority-date-calculator" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/priority-date-calculator",
  },
}, "priority-date-calculator");

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence, and the ingests expire it on demand when its data moves
// (the /api/revalidate-* routes).
export const revalidate = 86400;

const FAQS = [
  {
    q: "What’s a priority date?",
    a: "For an employment-based case it’s the date DOL received the PERM application, or the date USCIS received the I-140 where no labor certification was required. It’s your place in the queue for a visa number, and it stays with you across most category changes.",
  },
  {
    q: "Where do these cutoffs come from?",
    a: "From the State Department's own bulletin pages, read from the Department's site every hour on weekdays, with bulletins back to June 2005. A new bulletin shows here the day State publishes it. Every figure is labelled with the bulletin it came from, and each bulletin is one click away on the State Department's own site.",
  },
  {
    q: "What does it mean when a category shows U?",
    a: "Unavailable. No visa numbers are being issued in that category that month, so no priority date is current, however early it is. It usually means the annual limit has been reached and it typically resets at the start of the next fiscal year in October.",
  },
  {
    q: "Can a cutoff move backwards?",
    a: "Yes, and it does. Retrogression happens when demand in a category turns out higher than expected, and a date that was current one month can stop being current the next. That’s the main reason this page shows the whole series rather than just the latest number.",
  },
  {
    q: "The cutoff moved forward. Why is the wait no shorter?",
    a: "Because a cutoff has to advance about thirty days a month just for the queue to stay the same length. It moves forward while a month of real time passes, so anyone holding a fixed priority date only gains ground when it advances faster than that. Many employment-based queues moved slower than that, so the date on the page went up while the wait got longer. The pace figures on this page measure it, and the board says how many queues lost ground.",
  },
  {
    q: "Which chart should I use, final action or dates for filing?",
    a: "Final action dates govern when a green card can actually be approved. Dates for filing govern when the adjustment application can be submitted, but only in months when USCIS says it’s honouring that chart, which it announces separately.",
  },
];

export default async function PriorityDateCalculatorPage() {
  const [bulletins, board, uscis] = await Promise.all([
    getVisaBulletinSeries(),
    getBulletinBoard(),
    // The newest bulletin month USCIS names, and its chart for employment-based
    // filings: the bulletin is forward-dated, so late in a month the next one
    // is already out. Never fatal: without it the calendar comparison stands.
    getUscisCharts(),
  ]);

  // The selector offers what the archive holds, computed here rather than
  // declared in the component. A hardcoded list of six against an archive of
  // three meant half the options rendered an empty page.
  const categoryCodes = categoriesIn(bulletins);

  // Two provenances in one dataset, and the row records which. 26 of the 36
  // bulletins came through a mirror rather than from State or a public
  // archive of its page, including the newest two, which are the ones a
  // verdict is drawn from. Counted here rather than asserted, so it cannot
  // drift when the ingest changes.
  // A mirror records itself as "<source> (mirror; original: ...)", so the
  // word is the shape to test for, not any one provider's name. Matches
  // SOURCE_RANK in the ingest, and counts zero today.
  const isMirror = (url: string) => url.toLowerCase().includes("mirror");
  const provenance =
    bulletins.length > 0
      ? {
          newestIsMirror: isMirror(bulletins[bulletins.length - 1]!.sourceUrl),
          mirrored: bulletins.filter((b) => isMirror(b.sourceUrl)).length,
          total: bulletins.length,
        }
      : null;

  // Decided once, on the server, and passed down. A client component calling
  // new Date() on an otherwise static page disagrees with the server render
  // across a midnight boundary and React flags a hydration mismatch.
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

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
          Priority date calculator
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Where an employment-based priority date sits against the visa bulletin
          cutoffs, and which way those cutoffs have been moving.
        </p>
      </header>

      <section data-embed="priority-date" className="mt-10">
        <PriorityDateEstimator
          bulletins={bulletins}
          categoryCodes={categoryCodes}
          today={today}
          currentBulletinMonth={uscis?.month ?? null}
          currentEmploymentChart={uscis?.employment ?? null}
          provenance={provenance}
        />
      </section>

      {board ? (
        <section data-embed="visa-bulletin" className="mt-12">
          <BulletinBoard board={board} />
        </section>
      ) : null}

      {/* The alert, after the answer: a bulletin watcher's next question is
          "will you tell me when it moves". */}
      <section className="mt-12">
        <BulletinAlertForm source="priority-date-calculator" />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["visa-bulletin"]} />

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
