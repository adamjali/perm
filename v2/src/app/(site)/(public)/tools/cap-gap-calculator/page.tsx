import type { Metadata } from "next";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CapGapPart, OptDaysPart } from "@/components/tools/CapGapCalculator";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Two F-1 dates, as calculators: how far the cap-gap carries status and OPT to an H-1B start, and the OPT
 * unemployment days left. Both from 8 CFR 214.2(f), read on eCFR (Oct 28 2026 edition), cited under each answer.
 */

const TITLE = "Cap-Gap and OPT Unemployment Calculator";
const DESCRIPTION =
  "How long the H-1B cap-gap extends F-1 status and OPT (until April 1 since 2025), and how many OPT unemployment days are left, by the regulation.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/cap-gap-calculator" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/cap-gap-calculator" },
}, "cap-gap-calculator");

export const dynamic = "force-static";

const FAQS = [
  {
    q: "What is the cap-gap?",
    a: "The months between an F-1 student's OPT ending in spring or summer and an H-1B starting on October 1. Under 8 CFR 214.2(f)(5)(vii), a timely filed, nonfrivolous cap petition asking for a change of status extends the student's F-1 status and OPT work authorization across it.",
  },
  {
    q: "Until when does the cap-gap last now?",
    a: "Until April 1 of the H-1B fiscal year, or the approved petition's start date if that comes first. The H-1B modernization rule (89 FR 103054, effective January 17, 2025) moved it from October 1, so a petition still pending on October 1 no longer ends the extension that day.",
  },
  {
    q: "What ends it early?",
    a: "The petition being rejected, denied, revoked or withdrawn, or the change of status being denied or withdrawn, even when the petition is approved for consular processing instead (8 CFR 214.2(f)(5)(vii)(B)).",
  },
  {
    q: "How many unemployment days does OPT allow?",
    a: "90 in all during post-completion OPT. With a 24-month STEM extension granted, 150 in all across the whole OPT period, the first part included (8 CFR 214.2(f)(10)(ii)(E)).",
  },
  {
    q: "Is this legal advice?",
    a: "No. It's the regulation's arithmetic on the dates you enter. Whether a petition was timely or nonfrivolous, and which days count as employment, are for the school's DSO and the attorney who files.",
  },
];

export default function CapGapCalculatorPage() {
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
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Cap-gap and OPT days</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          How far a pending H-1B carries F-1 status and OPT, and the unemployment days OPT has left. Dates and citations.
        </p>
      </header>
      <section data-embed="cap-gap" aria-labelledby="capgap-h" className="mt-10">
        <h2 id="capgap-h" className="mb-4 font-heading text-2xl font-bold sm:text-3xl">
          How long the cap-gap lasts
        </h2>{" "}
        <CapGapPart />
      </section>{" "}
      <section id="opt-days" aria-labelledby="optdays-h" className="mt-14">
        <h2 id="optdays-h" className="mb-4 font-heading text-2xl font-bold sm:text-3xl">
          OPT unemployment days left
        </h2>{" "}
        <OptDaysPart />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/cap-gap-calculator"
        reading={[
          { href: "/opt-employers", label: "OPT and CPT employers", note: "who hires students, by school year" },
          { href: "/tools/h1b-lottery-odds-calculator", label: "H-1B lottery calculator", note: "an offer's chance in the draw" },
          { href: "/tools/h1b-six-year-limit", label: "H-1B six-year limit", note: "and the 240-day rule while an extension waits" },
        ]}
      />
    </div>
  );
}
