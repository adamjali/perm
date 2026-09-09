import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { WageLevelsTool } from "@/components/tools/WageLevelsTool";
import { openGraphBase } from "@/lib/openGraphBase";
import { SOC_RE } from "@/lib/wageLevels";
import { withSocialCard } from "@/lib/socialCard";

/**
 * DOL's four prevailing wage levels for an occupation in an area, read live
 * from the OFLC wage search. The one wage question every PERM and every
 * H-1B starts with, answered from the source that sets it.
 */

const TITLE = "Prevailing Wage Levels by Occupation and Area";
const DESCRIPTION =
  "DOL's four OEWS prevailing wage levels for any occupation in any metro or non-metro area, read live from the OFLC wage search, with the series year each figure belongs to.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/wage-levels" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/wage-levels" },
}, "wage-levels");

export const dynamic = "force-dynamic";

const FAQS = [
  {
    q: "Where do these numbers come from?",
    a: "From DOL's own wage search on flag.dol.gov, the same lookup the National Prevailing Wage Center's determinations are drawn from, using the all-industries OEWS series. This page asks DOL for the occupation and area you pick and prints what DOL answers, with the series year.",
  },
  {
    q: "Which level will my case get?",
    a: "The level is set from the job's requirements against what the occupation normally requires: education, experience, supervision, special skills. Level I is entry, Level IV fully competent. DOL decides it on the ETA-9141; this page shows the four figures so a determination can be read against them.",
  },
  {
    q: "Why does the series matter?",
    a: "OEWS wages turn over every July 1. A determination issued between July 1 and June 30 uses that July's series, and its validity runs to the next June 30 or 90 days, whichever the rule gives. Pick the series a determination was issued in to read the figures it was set from.",
  },
  {
    q: "What if DOL prints no wage for my area?",
    a: "Some occupation and area pairs have no OEWS estimate, and DOL's search answers with zeros. The page says so instead of showing zero dollars. The wage request itself can still be determined; the center uses a broader area or another source when the local estimate is missing.",
  },
];

export default async function WageLevelsPage({ searchParams }: { searchParams: Promise<{ soc?: string }> }) {
  const { soc } = await searchParams;
  const initialSoc = soc && SOC_RE.test(soc) ? soc.slice(0, 7) : "";
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
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Prevailing wage levels</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          DOL&apos;s four wage levels for an occupation in a metro or non-metro area, read live from the OFLC wage
          search. Pick the series a determination was issued in and read it against the four.
        </p>
      </header>
      <section className="mt-10">
        <WageLevelsTool initialSoc={initialSoc} />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/wage-levels"
        reading={[
          { href: "/guides/how-dol-sets-a-prevailing-wage", label: "How DOL sets a prevailing wage", note: "the level rule and the survey behind it" },
          { href: "/tools/salary-explorer", label: "Salary explorer", note: "what certified PERM jobs actually offered, by occupation and state" },
          { href: "/tools/pwd-validity", label: "Wage determination validity", note: "when a determination expires" },
        ]}
      />
    </div>
  );
}
