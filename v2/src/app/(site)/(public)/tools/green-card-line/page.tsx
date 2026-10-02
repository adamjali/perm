import type { Metadata } from "next";

import { GreenCardLine } from "@/components/tools/GreenCardLine";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getBulletinBoard } from "@/lib/turso/bulletin";
import { getLineSnapshot } from "@/lib/turso/greenCardLine";
import type { PaceBasis } from "@/lib/bulletinNext";

/**
 * The whole employment-based line in front of one priority date: approved
 * petitions waiting for the bulletin, petitions still waiting for approval,
 * and applications already current and not yet finished. See
 * `src/lib/greenCardLine.ts` for the method and everything it leaves out.
 *
 * Placing approvals in the year USCIS RECEIVED them puts a 2023 priority
 * date a year or more ahead of where it sits, so this page moves each
 * approval back by the PERM time DOL's own decisions measure.
 */

const TITLE = "Green Card Line: People Ahead of Your Date";
const DESCRIPTION =
  "How many people stand ahead of your priority date in EB-2, EB-3 and EB-3 Other Workers, and how many years that is at last year's green card pace.";
const PATH = "/tools/green-card-line";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: PATH,
  },
}, "green-card-line");

// USCIS's I-485 inventory is monthly and the rest quarterly or yearly, so a
// day bounds staleness far below the data's own cadence.
export const revalidate = 86400;

const FAQS = [
  {
    q: "How is this different from the I-485 queue position?",
    a: "The I-485 queue position counts only people who have already filed to adjust status in the US, which USCIS publishes by priority date. This counts the whole line: those people, plus everyone with an approved I-140 who can't file yet, plus petitions still waiting for approval. For most priority dates the part that can't file yet is by far the largest.",
  },
  {
    q: "Why is the answer a range?",
    a: "USCIS counts approved petitions waiting for a visa number but doesn't say which priority dates they hold, so they're spread by when USCIS approved I-140s, moved back by the time the PERM took. That time is measured for petitions filed since October 2023 and assumed for older ones, and a family's size varies by year. The range carries all of it, and it never goes below what USCIS actually counted.",
  },
  {
    q: "Does it count my spouse and children?",
    a: "Yes. USCIS's count of approved petitions is primary applicants only, so each one is multiplied by the number of people DHS measured getting green cards per principal in this category in fiscal 2023 and 2024: about 2.0 for EB-2 and EB-3, and 2.3 to 2.5 for EB-3 Other Workers. The yearly green card figure beside it counts families too, so the two are in the same units.",
  },
  {
    q: "Where do the years come from?",
    a: "The people ahead divided by the green cards the line got in fiscal 2024, from Table V of the State Department's Report of the Visa Office, the newest year published. That's one real year's pace, not a forecast. Unused family numbers spill into employment categories after the fact, the bulletin doesn't move at a steady rate, and the count runs high where people give up or hold two petitions, so read it as how long at last year's pace, never as a date.",
  },
  {
    q: "Why doesn't it subtract people who give up?",
    a: "Because nobody publishes how many do. Some leave, some switch categories, some get a green card through marriage or another employer, and USCIS says one person can hold more than one approved petition. All of that makes the count run high. Other calculators assume a rate; this one says the count is high and shows where USCIS's own figures let it be checked.",
  },
  {
    q: "Why does my line say the estimate is rough?",
    a: "Where filing is open past the final action date, USCIS has counted everyone who filed, so the estimate can be checked against a real number. For EB-2, which mostly adjusts inside the US, a gap of more than double means the spread doesn't fit this line well, and the page shows what the estimate would be if it's off by the same amount everywhere.",
  },
];

/** The bulletin's country keys and categories, as the calculator keys its pace map. */
const PACE_CATEGORIES = new Set(["EB2", "EB3", "EW3"]);

export default async function GreenCardLinePage() {
  const [snapshot, board] = await Promise.all([
    getLineSnapshot(),
    getBulletinBoard().catch(() => null),
  ]);
  const pace: Record<string, PaceBasis> = {};
  for (const c of board?.finalAction ?? []) {
    if (!PACE_CATEGORIES.has(c.category)) continue;
    pace[`${c.category}|${c.country}`] = {
      latest: c.latest,
      movedDays: c.movedDays,
      spanMonths: c.spanMonths,
      retrogressions: c.retrogressions,
    };
  }

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
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          Your place in the green card line
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Everyone ahead of your priority date in EB-2, EB-3 or EB-3 Other Workers, counted from what USCIS and the
          State Department publish, and how many years that is at the pace the line got green cards last year.
        </p>
      </header>

      <section className="mt-10">
        <GreenCardLine snapshot={snapshot} pace={pace} />
      </section>{" "}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </section>

      <DataProvenance
        datasets={["uscis-eb-awaiting-visa", "uscis-i140-class-country", "i485-inventory", "visa-annual-limits", "visa-bulletin"]}
      />

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          {
            href: "/tools/eb2-vs-eb3",
            label: "EB-2 and EB-3 side by side",
            note: "The same count for both lines at one priority date.",
          },
          {
            href: "/i140-awaiting-visa",
            label: "Approved I-140s waiting for a visa",
            note: "USCIS's count this page spreads, by category and country.",
          },
          {
            href: "/tools/i485-queue-position",
            label: "I-485 queue position",
            note: "Only the people who have already filed, counted exactly by USCIS.",
          },
        ]}
      />
    </div>
  );
}
