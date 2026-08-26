import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../../convex/_generated/api";
import { buildGreenCardTimeline } from "@/lib/perm";
import {
  getI140ProcessingTime,
  type I140Category,
} from "@/lib/processing-times/i140ProcessingTimes";
import { GreenCardTimelineView } from "@/components/tools/GreenCardTimelineView";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { getEstimatorData } from "@/lib/turso/estimate";

/**
 * The whole employment-based green card in one view.
 *
 * Composes the other calculators rather than adding data. Its job is
 * proportion: which stages are queues, which are statutory, and which cannot
 * be given a number at all.
 */

const TITLE = "Employment Green Card Timeline";
const DESCRIPTION =
  "Every stage of an employment-based green card, drawn to scale from published DOL and USCIS figures, from the prevailing wage queue to the visa number wait.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/green-card-timeline" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/green-card-timeline",
  },
};

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

const FAQS = [
  {
    q: "How long does an employment-based green card take?",
    a: "The labor certification and petition stages together run a bit over two years on current published figures. After that comes the wait for a visa number, which depends on category and country of birth and for some applicants is longer than everything before it combined. Any single total that covers all of it hides that variation.",
  },
  {
    q: "Which parts of the process can an employer actually control?",
    a: "The recruitment window and the filing window, and that’s roughly two months of the total. Both are fixed arithmetic on the prevailing wage determination date, and both restart the case if they’re missed. Everything else is queue time at DOL or USCIS.",
  },
  {
    q: "Why is there no number on the visa bulletin stage?",
    a: "Because the cutoff dates come only from the monthly visa bulletin published by the State Department, and we don’t have an automated way to read it.",
  },
  {
    q: "Does premium processing shorten the whole timeline?",
    a: "It shortens one stage. Premium processing applies to the I-140 only, so it does nothing for the prevailing wage queue, the recruitment window, the PERM decision, or the wait for a visa number.",
  },
];

/** Months from DOL's published average calendar days to a determination. */
function monthsFromDays(days: number | null): number | null {
  return days === null ? null : Math.round(days / 30.44);
}

export default async function GreenCardTimelinePage() {
  const [permData, uscisData] = await Promise.all([
    getEstimatorData(),
    fetchQuery(api.uscisI140.getLatest, {}).catch(() => null),
  ]);

  // The I-140 stage uses USCIS's PUBLISHED processing time, not the time it
  // would take to drain the whole backlog. Both are real, and they differ a
  // lot: the national interest waiver publishes 29 to 32 months against about
  // 42 months of queue. The published figure is what attaches to a case, so it
  // belongs in a duration timeline; the queue figure belongs on the I-140 page,
  // shown beside it with the gap explained.
  //
  // The category is the largest by pending volume, because that is the one most
  // visitors are in. Taking the fastest category would flatter the total.
  let i140Months: number | null = null;
  let i140Label: string | null = null;
  if (uscisData && uscisData.subtypes.length > 0) {
    const biggest = [...uscisData.subtypes].sort((a, b) => b.pending - a.pending)[0]!;
    const CATEGORY_OF: Record<string, I140Category> = {
      E11: "EB-1", E12: "EB-1", E13: "EB-1", E21: "EB-2",
      NIW: "EB-2-NIW", E31: "EB-3", E32: "EB-3", EW3: "EB-3",
    };
    const range = getI140ProcessingTime(CATEGORY_OF[biggest.code] || "");
    const published = range?.subtypes.find((s) => s.code === biggest.code);
    if (published) {
      i140Months = Math.round((published.lowMonths + published.highMonths) / 2);
      i140Label = published.label;
    }
  }

  const timeline = buildGreenCardTimeline({
    // DOL does not publish a prevailing-wage clearance rate, so this stage has
    // no figure until it can be measured from consecutive snapshots.
    pwdQueueMonths: null,
    permDecisionMonths: monthsFromDays(
      permData && permData.frontier ? permData.frontier.officialAvgDays : null,
    ),
    i140Months,
  });

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
      <DataNav active="calculators" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Green card timeline
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Every stage of an employment-based green card, drawn to scale from what
          DOL and USCIS publish.
        </p>
      </header>

      <div className="pop mt-10">
      <section className="border-2 border-border bg-card p-6 sm:p-8">
        <GreenCardTimelineView timeline={timeline} />
        {i140Label ? (
          <p className="mt-6 text-sm text-foreground/60">
            The I-140 stage uses the published processing time for {i140Label},
            the largest category by pending volume. Its queue runs longer than
            that, which the{" "}
            <Link href="/tools/i140-calculator" className="underline underline-offset-2">
              I-140 calculator
            </Link>{" "}
            sets out.
          </p>
        ) : null}
      </section>
      </div>

      {/* Who controls what: the single most useful fact about the timeline,
          drawn as structure rather than said in a paragraph. */}
      <section className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            You control
          </p>{" "}
          <p className="mt-2 font-heading text-lg font-black">Recruitment and filing</p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The recruitment window and the filing dates are the only stages an
            employer paces. Missing one restarts the case.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            DOL controls
          </p>{" "}
          <p className="mt-2 font-heading text-lg font-black">The two queues</p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The prevailing wage determination and the PERM decision move at
            DOL&apos;s published pace, oldest first.
          </p>
        </div>
        <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard-sm">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
            USCIS and State control
          </p>{" "}
          <p className="mt-2 font-heading text-lg font-black">The petition and the number</p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-background/70">
            The I-140 runs on USCIS&apos;s queue. The visa number depends on the
            bulletin, which is why that stage carries no figure.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        {[
          { href: "/tools/pwd-calculator", name: "Prevailing wage queue", blurb: "How many requests sit ahead of yours." },
          { href: "/tools/perm-deadline-calculator", name: "Your deadlines", blurb: "Every deadline in your case." },
          { href: "/tools/perm-timeline-calculator", name: "PERM decision", blurb: "When DOL is likely to reach your month." },
          { href: "/tools/i140-calculator", name: "I-140 queue", blurb: "How deep the petition backlog is." },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col border-2 border-border bg-card p-6 shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:shadow-hard-sm"
          >
            <h2 className="font-heading text-lg font-black">{t.name}</h2>{" "}
            <p className="mt-2 flex-1 text-base leading-relaxed text-foreground/70">{t.blurb}</p>{" "}
            <span className="mt-4 inline-flex items-center gap-2 font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4">
              Open
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <ToolPageFooter
        currentHref={"/tools/green-card-timeline"}
        reading={[
          { href: "/guides/ultimate-perm-guide-2026", label: "The full PERM guide", note: "The stages in detail, and the rules behind the ones you control." },
          { href: "/blog/what-is-perm-labor-certification", label: "What PERM actually is", note: "The labor certification stage, in plain terms." },
        ]}
      />
    </div>
  );
}
