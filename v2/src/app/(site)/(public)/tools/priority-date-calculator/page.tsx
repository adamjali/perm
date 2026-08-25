import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../../convex/_generated/api";
import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";

/**
 * Priority dates against the visa bulletin.
 *
 * The one page here built on an archive rather than a live feed, because
 * travel.state.gov refuses automated clients. It is framed as a history for
 * that reason: the movement is both the honest thing to show and the useful
 * one, since this month's number is on the State Department's own page and
 * the direction is not.
 *
 * Measured 2026-08-25: the archive route now has a hard ceiling. travel.state.gov
 * started serving 403 to the Internet Archive's crawler in mid-July 2026 (last
 * good capture 2026-07-14, first refusal 2026-07-17), so the August and
 * September 2026 bulletins have never been archived at all. The series stops at
 * July 2026 and re-running the ingest cannot change that. The page states the
 * gap rather than presenting the last figure it holds as a current one.
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

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

/**
 * The newest bulletin the State Department has actually published, from USCIS.
 *
 * travel.state.gov refuses automated clients and, since mid-July 2026, refuses
 * the Internet Archive's crawler too, so the archived series stops at July
 * 2026 and cannot advance. USCIS is a separate primary federal source that
 * does serve scripts, and while it publishes no cutoff dates of its own, it
 * does name the bulletin months it is operating against. That is exactly what
 * the staleness message needs, and it is sourced rather than guessed.
 *
 * It matters because the bulletin is FORWARD-DATED: on 2026-08-25 the bulletin
 * in force is August and September is already out. Counting from the calendar
 * alone would say "one month behind" when the honest answer is two bulletins.
 *
 * Never fatal. A failed read leaves the prop null and the component falls back
 * to the calendar comparison, which is weaker but still true.
 */
const USCIS_CHARTS_URL =
  "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface UscisGuidance {
  /** The newest bulletin month USCIS names, `YYYY-MM`. */
  month: string;
  /** Which chart USCIS accepts for EMPLOYMENT-BASED adjustment filings that month. */
  employmentChart: "Final Action Dates" | "Dates for Filing" | null;
}

async function fetchUscisGuidance(): Promise<UscisGuidance | null> {
  try {
    const res = await fetch(USCIS_CHARTS_URL, {
      headers: {
        // uscis.gov answers a bare UA inconsistently and intermittently 403s
        // datacenter runners. One honest browser-like set, and no retries.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = (await res.text())
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    // Anchored on the USCIS heading, never on a bare "<Month> <Year>". The
    // page names a dozen months in its archive list and the first bare match
    // is the month in force, not the newest published one, so an unanchored
    // read returns a plausible wrong answer with nothing to flag it.
    const re = new RegExp(
      `USCIS (${MONTH_NAMES.join("|")}) (\\d{4}) Adjustment of Status Filing Charts`,
      "g",
    );
    const months: string[] = [];
    for (const m of text.matchAll(re)) {
      const idx = MONTH_NAMES.indexOf(m[1]!);
      if (idx < 0) continue;
      months.push(`${m[2]}-${String(idx + 1).padStart(2, "0")}`);
    }
    months.sort();
    const month = months[months.length - 1];
    if (!month) return null;

    // Which chart USCIS accepts for EMPLOYMENT-BASED filings that month. This
    // decides whether someone can file an I-485 at all and it changes month to
    // month, and nobody else surfaces it.
    //
    // The "employment-based" half of the sentence is load-bearing, not
    // decoration. The page carries the same sentence for FAMILY-SPONSORED
    // filings and the two disagree: measured 2026-08-25, employment-based is
    // "Final Action Dates" while family-sponsored is "Dates for Filing". A
    // pattern matching a bare "must use the X chart" has five hits on this
    // page and would report the wrong chart about half the time.
    const chartRe = new RegExp(
      "For all employment-based preference categories, you must use the " +
        "(Final Action Dates|Dates for Filing) chart in the Department of State " +
        `Visa Bulletin for (${MONTH_NAMES.join("|")}) (\\d{4})`,
      "g",
    );
    let employmentChart: UscisGuidance["employmentChart"] = null;
    let best = "";
    for (const m of text.matchAll(chartRe)) {
      const idx = MONTH_NAMES.indexOf(m[2]!);
      if (idx < 0) continue;
      const key = `${m[3]}-${String(idx + 1).padStart(2, "0")}`;
      // Pair the chart with ITS OWN month and keep the newest, rather than
      // assuming document order puts the newest last.
      if (key > best) {
        best = key;
        employmentChart = m[1] as UscisGuidance["employmentChart"];
      }
    }
    // Only report a chart that belongs to the month being reported.
    return { month, employmentChart: best === month ? employmentChart : null };
  } catch {
    return null;
  }
}

const FAQS = [
  {
    q: "What’s a priority date?",
    a: "For an employment-based case it’s the date DOL received the PERM application, or the date USCIS received the I-140 where no labor certification was required. It’s your place in the queue for a visa number, and it stays with you across most category changes.",
  },
  {
    q: "Why is this behind the current bulletin?",
    a: "The State Department publishes the bulletin on a site that refuses automated requests, so these figures come from a public archive of the same pages. In mid-July 2026 that site began refusing the archive's crawler too, so the bulletins published after July 2026 haven’t been captured anywhere this page can read, and the series stops there until that changes. Every figure is labelled with the bulletin it came from, and the current bulletin is one click away on the State Department's own site.",
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
    q: "Which chart should I use, final action or dates for filing?",
    a: "Final action dates govern when a green card can actually be approved. Dates for filing govern when the adjustment application can be submitted, but only in months when USCIS says it’s honouring that chart, which it announces separately.",
  },
];

export default async function PriorityDateCalculatorPage() {
  const [bulletins, uscis] = await Promise.all([
    fetchQuery(api.visaBulletin.getSeries, {}).catch(() => []),
    fetchUscisGuidance(),
  ]);

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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="visa-bulletin" />
      <div className="pt-10 sm:pt-12" />
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
        <PriorityDateEstimator
          bulletins={bulletins}
          today={today}
          currentBulletinMonth={uscis?.month ?? null}
          currentEmploymentChart={uscis?.employmentChart ?? null}
        />
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
