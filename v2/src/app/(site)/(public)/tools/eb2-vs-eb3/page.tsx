import type { Metadata } from "next";
import Link from "next/link";

import { Eb2VsEb3 } from "@/components/tools/Eb2VsEb3";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getLineSnapshot } from "@/lib/turso/greenCardLine";

/**
 * EB-2 and EB-3 for one priority date, side by side. The counts are the green
 * card line's (`lib/greenCardLine.ts`); the only new rule is when one line can
 * be called shorter (`lib/greenCardLineCompare.ts`).
 */

const TITLE = "EB-2 vs EB-3: People Ahead at Your Date";
const DESCRIPTION =
  "EB-2 and EB-3 side by side for one country and priority date: this month's cutoffs and how many people stand ahead in each line, from USCIS and State.";
const PATH = "/tools/eb2-vs-eb3";

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
}, "eb2-vs-eb3");

export const revalidate = 86400;

const FAQS = [
  {
    q: "When does this say one line is shorter?",
    a: "Only when the whole range for one line sits below the whole range for the other. Where the two overlap, the counts can't tell them apart and the page says so rather than pick the lower midpoint.",
  },
  {
    q: "Does fewer people ahead mean a shorter wait?",
    a: "Not by itself. EB-2 and EB-3 got different numbers of green cards for each country last year, and unused family numbers spill into both after the fact. Each card prints what its line got in fiscal 2024 so the two can be read together.",
  },
  {
    q: "Can I move from EB-2 to EB-3 and keep my priority date?",
    a: "A second I-140 in EB-3 can be filed on the same certified PERM when the job's requirements support it, and it keeps the original priority date under 8 CFR 204.5(e). Whether that's worth it depends on the case and costs a second filing fee.",
  },
  {
    q: "Why do the two counts include the same people?",
    a: "Someone who has already downgraded holds an approved I-140 in each line, and USCIS counts petitions, not people. So both counts can include them. Nobody publishes how many.",
  },
];

export default async function Eb2VsEb3Page() {
  const snapshot = await getLineSnapshot();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "Calculators", href: "/calculators" },
    { name: "EB-2 vs EB-3", href: PATH },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumbSchema} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/tools" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Data
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href="/calculators" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Calculators
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">EB-2 or EB-3, for your date</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The two lines side by side for one country and priority date: what this month&apos;s bulletin prints for each,
          and how many people stand ahead of you in each.
        </p>
      </header>

      <section className="mt-10">
        <Eb2VsEb3 snapshot={snapshot} />
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
            href: "/tools/green-card-line",
            label: "The green card line",
            note: "One line at a time, with where the people ahead sit by priority date.",
          },
          {
            href: "/guides/eb2-vs-eb3-perm",
            label: "EB-2 vs EB-3 on a PERM",
            note: "What decides the category, and what a downgrade keeps.",
          },
          {
            href: "/tools/priority-date-retention",
            label: "Priority date retention",
            note: "When an earlier priority date carries to a new petition.",
          },
        ]}
      />
    </div>
  );
}
