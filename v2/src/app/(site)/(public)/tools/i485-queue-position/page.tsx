import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { I485QueuePosition } from "@/components/tools/I485QueuePosition";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { DataProvenance } from "@/components/data/DataProvenance";
import {
  getFreshness,
  getI485Cells,
  getI485Options,
  getI485Trend,
  getVisaBulletinSeries,
  type DatasetFreshness,
} from "@/lib/turso/publicData";
import type { I485CellTable } from "@/lib/i485/position";

/**
 * Queue position inside USCIS's employment-based I-485 pending inventory.
 *
 * The one page here whose answer is a RANGE rather than a figure. USCIS
 * replaces any cell holding 1 to 10 applications with the letter D, so an
 * exact total is not knowable from the release, and both bounds are published
 * instead of a midpoint dressed up as a measurement.
 *
 * It is also first-party and current. The rival's equivalent endpoint answers
 * `data_as_of: 2026-05-01` against a release USCIS dated 2026-08-05, so this
 * reads three months fresher and depends on nobody.
 */

const TITLE = "I-485 Queue Position Calculator";
const DESCRIPTION =
  "How many employment-based I-485 applications USCIS had pending ahead of a priority date, published as a range because USCIS withholds its smallest counts.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/i485-queue-position" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools/i485-queue-position",
  },
};

// USCIS publishes this monthly, so a day bounds staleness well below the
// data's own cadence and costs one regeneration a day. The ingest revalidates
// on demand when a new release lands.
export const revalidate = 86400;

const FAQS = [
  {
    q: "What’s the pending inventory?",
    a: "A count USCIS publishes each month of every employment-based adjustment of status application it has on hand and hasn’t decided, broken down by country of chargeability, preference category and priority date. It’s a count of the queue, taken from USCIS’s own records.",
  },
  {
    q: "Why a range instead of one number?",
    a: "USCIS replaces any cell holding between 1 and 10 applications with the letter D, to avoid identifying the people in it. So the exact total genuinely isn’t in the release. The low figure counts every withheld cell as 1 and the high figure counts every one as 10, and the truth is somewhere between them. Other tools resolve each D to 5 and publish a single number, which isn’t a figure USCIS released.",
  },
  {
    q: "Does this count people who haven't filed yet?",
    a: "No, and that's the one gap worth knowing about. An I-485 can only be filed once the Dates for Filing chart reaches your priority date, so this inventory is the filed cohort. Anyone with an earlier priority date than yours is past that same gate by definition, so they're counted. Anyone who's eligible and hasn't filed isn't, and USCIS publishes nothing that would size that group.",
  },
  {
    q: "Why does it say every published application is ahead of me?",
    a: "Usually because filing hasn’t opened for your priority date yet. USCIS publishes each category only as far as the priority dates it holds applications for, and it holds none past the Dates for Filing cutoff, because nobody past that cutoff has been allowed to file. India’s EB-2 chart stands at January 15, 2015 and its published inventory stops at 2015, which is the same boundary seen from two sides.",
  },
  {
    q: "Does this tell me when I’ll get my green card?",
    a: "No. It tells you how many applications sit in front of yours. Turning that into a date needs the rate at which visa numbers are issued in your category and country, which is set annually by statute and rationed month to month through the visa bulletin. The priority date calculator covers that half.",
  },
  {
    q: "Does everyone in my family count separately?",
    a: "Yes. A spouse and each child file their own I-485, and each one is a separate pending application in this inventory. That’s why these figures are larger than the number of households waiting.",
  },
  {
    q: "How current is this?",
    a: "USCIS publishes the inventory monthly and every figure here carries the release date it came from. USCIS keeps no archive of past releases, so the release-by-release comparison can only grow forward from the ones already captured.",
  },
];

export default async function I485QueuePositionPage() {
  const [cells, options, trend, freshness, bulletins] = await Promise.all([
    // Every read is defaulted rather than allowed to throw. A frontend
    // deployed ahead of its data hits exactly this window, and the component
    // renders its own empty state from an empty table.
    getI485Cells().catch((): I485CellTable => ({})),
    getI485Options().catch((): { country: string; categories: string[] }[] => []),
    getI485Trend().catch((): { asOf: string; total: number }[] => []),
    getFreshness().catch((): Record<string, DatasetFreshness> => ({})),
    getVisaBulletinSeries().catch(() => []),
  ]);

  const asOf = freshness["i485-inventory"]?.asOf ?? null;

  // The newest Dates for Filing chart, which explains the state most visitors
  // land in. Someone holding a 2019 priority date is beyond what USCIS
  // publishes BECAUSE filing has not opened for them yet, and the cutoff that
  // decides it is a figure this project already holds.
  //
  // The two boundaries coincide and that is worth stating: India EB-2's chart
  // reads 15JAN15 and USCIS publishes its inventory through 2015. So anyone
  // AHEAD of a given date is past the same gate by definition and IS counted;
  // the undercount is only people who could file and have not.
  const newestBulletin = bulletins[bulletins.length - 1] ?? null;

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
    { name: "I-485 queue position", href: "/tools/i485-queue-position" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="calculators" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumbSchema} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Data
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link
            href="/calculators"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Calculators
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          I-485 queue position
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How many employment-based adjustment applications USCIS had pending
          ahead of a priority date, from the inventory USCIS publishes each
          month.
        </p>{" "}
      </header>

      <section className="mt-10">
        {/* useSearchParams needs a boundary, same as the salary explorer and
            the case browser. The shared (public)/loading.tsx used to satisfy
            it for the whole group; when that file was removed (it was masking
            real 404 statuses on the entity routes), this page was the one
            mount without its own wrap and the build failed on it. */}
        <Suspense
          fallback={
            <div className="border-2 border-border bg-card p-6 shadow-hard sm:p-8">
              <p className="text-base text-foreground/70">Loading queue figures…</p>
            </div>
          }
        >
          <I485QueuePosition
            cells={cells}
            options={options}
            asOf={asOf}
            trend={trend}
            filingChart={newestBulletin?.datesForFiling ?? null}
            filingChartMonth={newestBulletin?.bulletinMonth ?? null}
          />
        </Suspense>
      </section>{" "}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </section>

      <DataProvenance datasets={["i485-inventory"]} />

      <ToolPageFooter
        currentHref={"/tools/i485-queue-position"}
        reading={[
          {
            href: "/tools/priority-date-calculator",
            label: "Whether your date is current",
            note: "This page counts who’s ahead. The bulletin decides when the queue moves.",
          },
          {
            href: "/tools/green-card-timeline",
            label: "The whole timeline",
            note: "Where the wait for a visa number sits against every stage before it.",
          },
        ]}
      />
    </div>
  );
}
