import { Fragment } from "react";
import Link from "next/link";

import { ArrowRight } from "./icons";

import { QueueTape } from "@/components/tools/QueueTape";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";

/**
 * The homepage's evidence band.
 *
 * It replaces a count-up stats section whose four numbers were definitional
 * ("5 PERM stages covered") rather than evidential. This shows the one thing
 * a visitor cannot get from any brochure: where DOL's queue actually stands,
 * today, from DOL's own figures — the same data the product runs on.
 *
 * Server component; the page passes the already-fetched snapshot so the
 * homepage makes exactly one Convex query.
 */

/**
 * One derived figure per data page, so a card carries evidence rather than a
 * label. Every field is nullable: a frontend deployed ahead of its backend
 * renders the card without its figure rather than throwing.
 */
export interface DataPageFigures {
  /** Jurisdictions covered, and the largest and smallest by case count. */
  states: {
    count: number;
    top: string;
    topCases: number;
    low: string;
    lowCases: number;
  } | null;
  /** Offered-wage ladder, 10th / 50th / 90th percentile. */
  wages: { p10: number; p50: number; p90: number } | null;
  /** Share of all cases sitting in the 250 largest sponsor rows. */
  employerShare: number | null;
  /** Share of all cases sitting in the 250 largest law-firm rows. */
  attorneyShare: number | null;
  /** Denial rate and the fraction behind it. */
  denial: { rate: number; denied: number; decided: number } | null;
}

export interface LiveDataBandProps {
  frontierMonth: string | null;
  asOf: string | null;
  averageDays: number | null;
  figures?: DataPageFigures;
}

export function LiveDataBand({
  frontierMonth,
  asOf,
  averageDays,
  figures,
}: LiveDataBandProps) {
  if (!frontierMonth) return null;

  return (
    <section
      aria-label="Live DOL queue position"
      className="border-y-2 border-border bg-card"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-foreground/55">
              Live from the Department of Labor
              {asOf ? ` · ${formatAsOf(asOf)}` : null}
            </p>{" "}
            <h2 className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
              DOL is deciding cases filed{" "}
              <span className="whitespace-nowrap bg-primary px-2 text-black">
                {formatMonth(frontierMonth)}
              </span>
            </h2>{" "}
            {averageDays != null ? (
              <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/70">
                {averageDays} days on average to a determination. The tracker
                turns dates like these into your case&apos;s own deadlines.
              </p>
            ) : null}
          </div>
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-background px-5 py-2.5 font-bold shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
          >
            Open the data
            <ArrowRight />
          </Link>
        </div>

        <QueueTape
          frontierMonth={frontierMonth}
          className="mt-8"
          monthsBehind={6}
          monthsAhead={8}
        />

        {/* THE CARDS CARRY EVIDENCE, NOT LABELS. Five identical text tiles
            reading "Who sponsors the most" was the same defect as a hero with
            no data in it: a menu pretending to be a page. Each card now shows
            one real figure from the same disclosure files the pages are built
            from, and each takes the shape its own content has - a span for
            geography, a ladder for a distribution, a share for concentration,
            a rate for an outcome.

            NO ENTITY IS NAMED OR RANKED. DOL prints one law firm under six
            spellings, so any "#1 by volume" claim from these files is wrong
            until entity identity is normalised. A SHARE is safe: merging the
            duplicate rows would only pull more distinct firms into the top
            250, so the figure understates rather than overstates. */}
        <nav
          aria-label="Data pages"
          className="mt-10 grid grid-cols-2 gap-3 [&>*]:min-w-0 sm:grid-cols-3 lg:grid-cols-5"
        >
          {[
            {
              href: "/perm-by-state",
              label: "By state",
              what: "Filings and wages per worksite state",
              figure: figures?.states ? (
                <>
                  <span className="block font-heading text-2xl font-black leading-none">
                    {figures.states.topCases.toLocaleString("en-US")}
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm font-semibold text-foreground/60">
                    in {figures.states.top}, most of any
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm text-foreground/55">
                    {figures.states.lowCases.toLocaleString("en-US")} in{" "}
                    {figures.states.low}, fewest
                  </span>
                </>
              ) : null,
            },
            {
              href: "/perm-wages",
              label: "Wages",
              what: "Median offered wage by occupation",
              figure: figures?.wages ? (
                <>
                  {(
                    [
                      ["90th", figures.wages.p90],
                      ["Median", figures.wages.p50],
                      ["10th", figures.wages.p10],
                    ] as const
                  ).map(([rung, value]) => (
                    // React renders array items with NOTHING between them, so
                    // the rungs reached extractors as "$176,500Median". The
                    // separator has to be part of each iteration.
                    <Fragment key={rung}>
                      {" "}
                      <span className="flex items-baseline justify-between gap-2 border-b border-border/25 py-[3px] font-mono text-sm last:border-b-0">
                        <span className="text-foreground/55">{rung}</span>{" "}
                        <span className="font-semibold tabular-nums">
                          ${value.toLocaleString("en-US")}
                        </span>
                      </span>
                    </Fragment>
                  ))}
                </>
              ) : null,
            },
            {
              href: "/perm-employers",
              label: "Employers",
              what: "Who sponsors, and how concentrated it is",
              figure:
                figures?.employerShare != null ? (
                  <>
                    <span className="block font-heading text-2xl font-black leading-none">
                      {figures.employerShare}%
                    </span>{" "}
                    <span className="mt-1 block font-mono text-sm font-semibold text-foreground/60">
                      of cases, top 250 sponsors
                    </span>
                  </>
                ) : null,
            },
            {
              href: "/perm-attorneys",
              label: "Law firms",
              what: "Who files, and how concentrated it is",
              figure:
                figures?.attorneyShare != null ? (
                  <>
                    <span className="block font-heading text-2xl font-black leading-none">
                      {figures.attorneyShare}%
                    </span>{" "}
                    <span className="mt-1 block font-mono text-sm font-semibold text-foreground/60">
                      of cases, top 250 filers
                    </span>
                  </>
                ) : null,
            },
            {
              href: "/perm-denial-risk",
              label: "Denial rates",
              what: "What gets denied",
              figure: figures?.denial ? (
                <>
                  <span className="block font-heading text-2xl font-black leading-none">
                    {figures.denial.rate}%
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm font-semibold text-foreground/60">
                    denied
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm text-foreground/55">
                    {figures.denial.denied.toLocaleString("en-US")} of{" "}
                    {figures.denial.decided.toLocaleString("en-US")}
                  </span>
                </>
              ) : null,
            },
          ].map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group flex flex-col border-2 border-border bg-background p-4 shadow-hard-sm transition-all duration-150 hover:-translate-y-[2px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
            >
              <span className="font-heading text-base font-black">
                {d.label}
              </span>{" "}
              {d.figure ? (
                <span className="mt-3 block border-t-2 border-border/30 pt-3">
                  {d.figure}
                </span>
              ) : null}{" "}
              <span className="mt-3 block text-sm leading-snug text-foreground/60">
                {d.what}
              </span>{" "}
              <span className="mt-auto inline-flex items-center gap-1.5 pt-3 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-foreground/55 group-hover:text-foreground">
                Open{" "}
                <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
