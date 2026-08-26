/**
 * The methodology page.
 *
 * Public PERM estimators disagree with each other by months on the same
 * filing date, and almost none of them say why. This page is the answer to
 * that, and it is the product's position stated once: every number carries
 * its source and its date, and a number we cannot support does not appear.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { DataNav } from "@/components/tools/DataNav";

const TITLE = "How These Numbers Are Computed";
const DESCRIPTION =
  "Why PERM estimators disagree by months on the same case, where our figures come from, and what we refuse to publish.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/methodology" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/methodology",
  },
};

export const dynamic = "force-static";

/**
 * Readings of the same headline number across the public tools, taken on one
 * day (2026-08-24). Kept as a dated record on purpose: the spread is the
 * point, and a live comparison would put us in the business of monitoring
 * competitors rather than DOL.
 */
const SPREAD = [
  { source: "DOL's own published average", value: "372 days" },
  { source: "Crowd-sourced tracker", value: "335 days" },
  { source: "Queue estimator A", value: "387 days" },
  { source: "Queue estimator B", value: "462–480 days" },
  { source: "Analytics site", value: "467 days" },
  { source: "Stale calculator (March data)", value: "503 days" },
] as const;

const SOURCES = [
  {
    name: "DOL FLAG processing times",
    seal: "/agency/dol-seal.png",
    sealAlt: "Seal of the US Department of Labor",
    what: "Queue positions and average days, the figures on the processing times page.",
    cadence: "Checked weekly. A new snapshot is stored only when the figures change.",
    href: "https://flag.dol.gov/processingtimes",
  },
  {
    name: "DOL PERM disclosure files",
    seal: "/agency/dol-seal.png",
    sealAlt: "Seal of the US Department of Labor",
    what: "Case-level decisions, the basis of the timeline calculator's cohort record. The files are unioned and de-duplicated by case number: 259,489 cases at last ingest.",
    cadence: "Quarterly, when DOL publishes.",
    href: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  {
    name: "USCIS I-140 quarterly counts",
    seal: "/agency/dhs-seal.png",
    sealAlt: "Seal of the US Department of Homeland Security",
    what: "Pending and completed petitions by category, the I-140 calculator's queue.",
    cadence: "Quarterly, when USCIS publishes.",
    href: "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
  },
  {
    name: "State Department visa bulletin",
    seal: "/agency/dos-seal.png",
    sealAlt: "Seal of the US Department of State",
    what: "Employment-based cutoff dates. The live page refuses automated readers, so our series comes from the Internet Archive and lags the current month. That’s why the priority date calculator is framed as a history.",
    cadence: "Monthly.",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
] as const;

export default function MethodologyPage() {
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Methodology", href: "/methodology" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={breadcrumb} />

      <DataNav active="methodology" />

      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Methodology
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          How these numbers are computed
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          On one day in August 2026, public PERM tools reported the same
          headline figure as anywhere from 335 to 503 days, while DOL&apos;s own
          published average was 372.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-black">
          One number, six answers
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          Readings taken 2026-08-24, all describing average PERM processing
          time. Most of the spread has a mechanical cause.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-2 border-border text-left text-sm shadow-hard-sm">
            <thead className="bg-foreground text-background">
              <tr>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
                  Source
                {" "}</th>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
                  Reported
                </th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {SPREAD.map((row) => (
                <tr key={row.source} className="border-t border-border/40">
                  <td className="p-3">{row.source}{" "}</td>
                  <td className="p-3 font-mono font-bold tabular-nums">{row.value}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70">
          Four causes account for nearly all of it. A tool can measure cases
          <em> decided</em> recently or cases <em>filed</em> in a month, and
          those are different populations. It can include audited cases or set
          them aside. It can run on this quarter&apos;s data or on a file from
          March. And a tool built on crowd reports measures its own users
          rather than the queue. None of these choices is wrong on its own. What
          matters is saying which one produced the number.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">What our figures are</h2>
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4">
          {SOURCES.map((s, i) => (
            <div
              key={s.name}
              className={
                "border-2 border-border p-6 shadow-hard-sm " +
                (i % 2 === 0 ? "bg-card" : "bg-tint-primary")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {/* The agency's own seal, sourced from its published
                      artwork - identification, not endorsement. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.seal}
                    alt={s.sealAlt}
                    width={44}
                    height={44}
                    loading="lazy"
                    className="h-11 w-11 shrink-0"
                  />
                  <h3 className="font-heading text-lg font-black">{s.name}</h3>
                </div>{" "}
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold underline underline-offset-2 hover:text-primary"
                >
                  Source
                  <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-2 text-base leading-relaxed text-foreground/70">{s.what}</p>{" "}
              <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {s.cadence}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">What we refuse to publish</h2>
        <ul className="mt-4 grid gap-3 text-base leading-relaxed text-background/80">
          <li className="border-l-4 border-primary pl-4">
            A single blended estimate. Each calculator shows every model its
            data supports, labelled, and lets them disagree.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Medians over immature cohorts. A month whose only decided cases are
            instant withdrawals has a median of one day.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Stages nobody can measure. Where a wait depends on visa-number
            availability, the timeline says so instead of inventing a figure.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Undated numbers. Every figure carries the date of the data behind it.
          </li>
        </ul>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <div>
          <h2 className="font-heading text-xl font-black">See it applied</h2>{" "}
          <p className="mt-1 text-base text-foreground/70">
            The calculators put all of this into practice.
          </p>
        </div>
        <Link
          href="/tools"
          className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          Open the calculators
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
