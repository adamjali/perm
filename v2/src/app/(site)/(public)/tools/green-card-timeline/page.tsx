import type { Metadata } from "next";

import { DataProvenance } from "@/components/data/DataProvenance";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { GreenCardPlanner } from "@/components/tools/GreenCardPlanner";
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
  "Enter where your case is and its dates. See every step to an employment-based green card dated from today's DOL and USCIS figures, with the fees.";

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
    a: "The wage request and the PERM use how long DOL's middle decision on its last working day waited, filed to decided. The I-140 and the I-485 use USCIS's newest quarterly medians. Recruitment is the shortest the rules allow: a 30-day job order, then 30 days before filing. The bulletin wait moves your line's final action cutoff forward at the pace it has kept. You can change any of them under \"Change the assumptions\".",
  },
  {
    q: "Why is there no date for my green card?",
    a: "When your line is unavailable in the newest bulletin, or its cutoff hasn't moved enough to measure a pace, nothing honest can date the wait. The planner says so instead of guessing, and every step before the bulletin is still dated.",
  },
  {
    q: "Which parts can an employer control?",
    a: "Recruitment and the day the PERM is filed. Both are fixed arithmetic on the wage determination, and missing them restarts the case. Every other step is a queue at DOL, USCIS or the State Department.",
  },
  {
    q: "Can I file the I-485 with the I-140?",
    a: "Only when your priority date is already current. Then the planner files them together, which is called concurrent filing. Otherwise the I-485 waits until the bulletin reaches your date.",
  },
  {
    q: "Does premium processing shorten the whole timeline?",
    a: "It shortens one step. Premium processing applies to the I-140 only, so it does nothing for the wage request, recruitment, the PERM decision or the wait for a visa number.",
  },
  {
    q: "Does the total include the attorney?",
    a: "No. It's the government's fees from USCIS's fee schedule. DOL charges nothing for the wage request or the PERM, and the employer must pay the PERM's own costs, including the attorney and the ads (20 CFR 656.12(b)).",
  },
];

export default async function GreenCardTimelinePage() {
  const [{ figures, standing }, check] = await Promise.all([getPlanReading(), getBulletinCheck().catch(() => null)]);
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
          Where your case is and its dates in. Every step to the green card out, dated from today&apos;s DOL and USCIS
          figures, with the government&apos;s fees for the whole way.
        </p>
      </header>
      <section data-embed="green-card-timeline" className="mt-10">
        <SearchParamsBoundary>
          <GreenCardPlanner figures={figures} standing={standing} check={check} today={easternDay()} />
        </SearchParamsBoundary>
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>{" "}
        <FaqList items={FAQS} />
      </section>
      <DataProvenance datasets={["pwd-status", "perm-case-status", "uscis-form-quarters", "visa-bulletin"]} />
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
