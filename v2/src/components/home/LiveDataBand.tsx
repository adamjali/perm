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
  /** Share of all cases sitting in the 250 largest law-firm rows. */
  /** Denial rate and the fraction behind it. */
  denial: { rate: number; denied: number; decided: number } | null;
}

export interface LiveDataBandProps {
  frontierMonth: string | null;
  asOf: string | null;
  figures?: DataPageFigures;
}

export function LiveDataBand({
  frontierMonth,
  asOf,
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
            </h2>
            {/* The "N days on average to a determination. The tracker turns
                dates like these into your case's own deadlines." line was cut
                on 2026-08-30: the headline above already states DOL's position
                as a fact, and a second sentence restating it as an average and
                then explaining the product was the band's own too-many-words
                problem. The live average still has a home on
                /perm-processing-times, which the tape below links. */}
          </div>
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-background px-5 py-2.5 font-bold shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
          >
            {/* "Open the data" says nothing about what opens. The hero's
                card was renamed off this phrasing; this button points at the
                same place and kept it, which is the drift a reader has to
                translate. */}
            Browse every dataset
            <ArrowRight />
          </Link>
        </div>

        <QueueTape
          frontierMonth={frontierMonth}
          className="mt-8"
          monthsBehind={6}
          monthsAhead={8}
        />

        {/* A CARD CARRIES A FIGURE ONLY IF THE FIGURE ANSWERS SOMETHING.
            An earlier version gave all five one, on the reasoning that a card
            without a number was "a menu pretending to be a page". That pushed
            it the other way: to fill the sponsor and law-firm slots it printed
            "N% of cases, top 250", and "top 250" is not a cohort anyone chose -
            it is the residue of a storage cap, the old 1 MB document that could
            hold 250 entity rows. A figure shaped by a former database limit,
            printed because the slot wanted one.

            Two survive because they answer the question their page exists for:
            the wage ladder IS the wage page, and the denial rate IS the denial
            page. The other three say what you will see. A label that promises
            plainly beats a number that impresses and tells you nothing.

            NO ENTITY IS NAMED OR RANKED anywhere here. DOL prints one law firm
            under six spellings, so any "#1 by volume" claim from these files is
            wrong until entity identity is normalised. */}
        <nav
          aria-label="Data pages"
          className="mt-10 grid grid-cols-2 gap-3 [&>*]:min-w-0 sm:grid-cols-3 lg:grid-cols-5"
        >
          {[
            {
              href: "/perm-by-state",
              label: "By state",
              what: "View number of filings and wages by state",
              // The most/least-filings pair is gone. Which state leads is not a
              // question anyone arrives with, and the runner-up fact ("39 in
              // VI, fewest") is trivia about a territory with 39 cases. The
              // card now says what the page does and lets the page do it.
              figure: null,
            },
            {
              href: "/perm-wages",
              label: "Wages",
              what: "View median offered wage by occupation",
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
              what: "View employer filing metrics",
              // The "N% of cases, top 250 sponsors" share is DELETED, and it
              // should never have shipped. "Top 250" was not a cohort anyone
              // chose - it is the residue of a storage cap (the old Convex 1 MB
              // document that could only hold 250 entity rows), so the figure
              // was shaped by a database limit rather than by anything true
              // about sponsorship. It also answered a question no visitor
              // asked. It existed because the five cards were designed to each
              // carry a figure, which is decoration wearing evidence's clothes.
              figure: null,
            },
            {
              href: "/perm-attorneys",
              label: "Law firms",
              what: "View law firm filing metrics",
              // Deleted for the same reason as the sponsor share above.
              figure: null,
            },
            {
              href: "/perm-denial-risk",
              label: "Denial rates",
              what: "View why cases are denied",
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
