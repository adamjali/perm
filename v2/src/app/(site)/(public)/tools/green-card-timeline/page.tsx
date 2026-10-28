import type { Metadata } from "next";

import { DataProvenance } from "@/components/data/DataProvenance";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { GreenCardPlanner } from "@/components/tools/planner/GreenCardPlanner";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { getBulletinCheck } from "@/lib/db/bulletinCheck";
import { getPlanReading } from "@/lib/db/planFigures";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { easternDay } from "@convex/lib/time";

/**
 * The employment-based green card for one case, every step dated (owner, Oct 27 2026:
 * "you put in dates and change stuff as you like but it maps out full process and full
 * price"). The lengths are what the site measures today (`getPlanReading`); the reader
 * can change any of them. The case's inputs live in the address, so a plan can be
 * shared and other pages link to one already filled in.
 *
 * Expired by the sweep (/api/revalidate-sweep) and the bulletin (/api/revalidate-bulletin).
 */
export const revalidate = 21600;

const TITLE = "Green Card Timeline and Planner";
const DESCRIPTION =
  "Enter your case's dates. See every step to an employment-based green card as a date range from today's DOL and USCIS figures, with every cost.";

export const metadata: Metadata = withSocialCard(
  {
    title: { absolute: `${TITLE} | PERM Tracker` },
    description: DESCRIPTION,
    alternates: { canonical: "/tools/green-card-timeline" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/green-card-timeline" },
  },
  "green-card-timeline"
);

const FAQS = [
  {
    q: "Where do the step lengths come from?",
    a: "The wage request and the PERM use the filing days DOL decided on its last working day: the latest-filed tenth is the quick end, the middle is typical, the earliest-filed tenth the slow end. A wage request or PERM you've already filed is dated from the cases still ahead of it at DOL's measured pace, as its own case page dates it. Recruitment uses how long employers took in DOL's own record, first recruitment step to filing, never under the 60 days the rules require. The I-140, the I-485, the work permit and the travel document use USCIS's quarterly medians over the last year. Through a consulate, the National Visa Center's own weekly figures date its case creation and document review. Every length is yours to change in its step.",
  },
  {
    q: "How is the wait for the visa bulletin worked out?",
    a: "Two ways, and you pick which one dates the plan. The first moves your line's final action cutoff forward at the pace it has kept, widened by how far off that pace has been on past bulletins. The second counts the people ahead of your priority date from USCIS's own figures and divides by the green cards your line is issued a year. Both stay on the page, and you can set the pace or the yearly number yourself.",
  },
  {
    q: "Why is there no date for my green card?",
    a: "When your line is unavailable in the newest bulletin, or its cutoff hasn't moved enough to measure a pace and no count of people ahead exists, nothing honest can date the wait. The planner says so instead of guessing, and every step before the bulletin is still dated.",
  },
  {
    q: "Which parts can an employer control?",
    a: "Recruitment, the day the PERM is filed and the day the I-140 goes in. The I-140 must be filed within 180 days of certification, and missing that restarts the case. Every other step is a queue at DOL, USCIS or the State Department.",
  },
  {
    q: "Can I file the I-485 with the I-140?",
    a: "Only inside the US, and only when your priority date is already current. Then the planner files them together, which is called concurrent filing. Otherwise the I-485 waits until the bulletin reaches your date.",
  },
  {
    q: "What if I'll get the green card at a consulate abroad?",
    a: "Choose \"At a US consulate abroad\". The I-485 step becomes the National Visa Center and the consulate: NVC takes the case once the I-140 is approved, the documents go in once your date is current, and NVC's review time comes from the State Department's own weekly figure. The consulate's interview wait has no public figure, so the planner assumes one to six months, and you set your consulate's. The fees change too: State's visa fee and USCIS's immigrant fee for each person, and no work permit or travel document.",
  },
  {
    q: "Does premium processing shorten the whole timeline?",
    a: "It shortens one step. Premium processing applies to the I-140 only, so it does nothing for the wage request, recruitment, the PERM decision or the wait for a visa number.",
  },
  {
    q: "What does it include in the cost, and who pays?",
    a: "USCIS's fees from its fee schedule for every form, on the day each is due, and any costs you add: the attorneys, the recruitment and the medical exam. DOL charges nothing for the wage request or the PERM. The employer must pay the PERM's own costs, the attorney and the recruitment included (20 CFR 656.12(b)); who pays the rest is for you and the employer to agree.",
  },
];

export default async function GreenCardTimelinePage() {
  const [reading, check] = await Promise.all([getPlanReading(), getBulletinCheck().catch(() => null)]);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Your green card timeline</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Enter your case&apos;s dates. Every step to the green card comes out dated, with its cost, from today&apos;s DOL
          and USCIS figures.
        </p>
      </header>
      <section data-embed="green-card-timeline" className="mt-10">
        <SearchParamsBoundary>
          <GreenCardPlanner reading={reading} check={check} today={easternDay()} />
        </SearchParamsBoundary>
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>{" "}
        <FaqList items={FAQS} />
      </section>
      <DataProvenance datasets={["pwd-status", "perm-case-status", "perm-cases", "uscis-form-quarters", "visa-bulletin", "i485-inventory", "nvc-timeframes"]} />
      <ToolPageFooter
        currentHref="/tools/green-card-timeline"
        reading={[
          { href: "/today", label: "Where every step stands today", note: "the live figures the plan is built on" },
          { href: "/tools/green-card-line", label: "Your place in the line", note: "how many people stand ahead of your date" },
          { href: "/tools/i485-queue-position", label: "How many are ahead of you", note: "who already holds a place in your category and country" },
          { href: "/guides/ultimate-perm-guide-2026", label: "The full PERM guide", note: "the steps in detail, and the rules behind the ones you control" },
        ]}
      />
    </div>
  );
}
