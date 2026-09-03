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

/**
 * A figure for every card, and a DIFFERENT SHAPE for each.
 *
 * Adam, 2026-08-30: "the 5 boxes/links are boring low effort lazy ai slop and
 * flat and nothing and superficial not deep, no visuals? no unique structure
 * or layout or skeleton?" He was right, and the reason is documented two
 * comments below: three of the five carried a numeric figure that was deleted
 * for being meaningless, and nothing replaced it. Deleting them was correct.
 * Leaving the slot empty was not.
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS: employers and law firms have no
 * honest number to print. DOL spells one practice six ways, so any count or
 * ranking off these files overstates until entity identity is normalised, and
 * the deleted "top 250 sponsors" share was the residue of a 1 MB document
 * limit rather than a cohort anyone chose. So those two cards get a DIAGRAM of
 * the shape of their data, which is true and needs no disputed figure, while
 * wages and denial keep the real numbers they already had.
 *
 * Each figure is drawn from what its page is actually about rather than from a
 * house chart style: a grid for geography, a ladder for a range, a long tail
 * for a population of mostly-small filers, a fan for the many-to-one relation
 * between employers and the firms that file for them, and a proportion bar for
 * a rate. Five questions, five geometries.
 *
 * All of them: `currentColor` and the theme's own tokens, never a raw hex; the
 * `-ink` variants, which are the ones that clear 3:1 against this surface in
 * light mode; `aria-hidden`, because each sits beside text that already says
 * what the card is; and no animation, so nothing here can pulse.
 */
const FIG = "h-[54px] w-full";

/** Geography: a grid where filings cluster unevenly, which is the point. */
function StateFigure() {
  // Deliberately schematic and unlabelled. A real choropleth needs per-state
  // values in the card, and the page itself is where those belong; this says
  // "this data varies by place" without asserting which place leads.
  const cells = [
    0.15, 0.3, 0.15, 0.55, 0.15, 0.15, 0.15, 0.85, 0.4, 0.15, 0.3, 1, 0.15,
    0.55, 0.15, 0.15, 0.7, 0.15, 0.3, 0.15, 0.15, 0.4, 0.15, 0.15,
  ];
  return (
    <svg viewBox="0 0 96 30" className={FIG} aria-hidden="true">
      {cells.map((v, i) => (
        <rect
          key={i}
          x={(i % 8) * 12 + 1}
          y={Math.floor(i / 8) * 10 + 1}
          width="10"
          height="8"
          fill="var(--data-good-ink)"
          fillOpacity={v}
        />
      ))}
    </svg>
  );
}

/** A population of mostly-small filers: the long tail, drawn as itself. */
function EmployersFigure() {
  const bars = [30, 22, 17, 13, 10, 8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 3];
  return (
    <svg viewBox="0 0 96 30" className={FIG} aria-hidden="true">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 6}
          y={30 - h}
          width="4.5"
          height={h}
          fill="currentColor"
          fillOpacity={0.55}
        />
      ))}
    </svg>
  );
}

/** Many employers, far fewer firms filing for them: a fan, not a bar chart. */
function FirmsFigure() {
  const rows = [3, 9, 15, 21, 27];
  return (
    <svg viewBox="0 0 96 30" className={FIG} aria-hidden="true">
      {rows.map((y, i) => (
        <Fragment key={y}>
          <line
            x1="4"
            y1={y}
            x2="60"
            y2={i < 2 ? 11 : i === 2 ? 15 : 19}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth="1"
          />
          <rect x="1" y={y - 2} width="4" height="4" fill="currentColor" fillOpacity={0.5} />
        {" "}
        </Fragment>
      ))}
      {[11, 15, 19].map((y) => (
        <rect key={y} x="60" y={y - 3} width="7" height="6" fill="var(--data-good-ink)" />
      ))}
    </svg>
  );
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
              // The most/least-filings pair stays gone: which state leads is
              // not a question anyone arrives with, and "39 in VI, fewest" is
              // trivia about a territory with 39 cases. What replaces it is a
              // SHAPE rather than a fact - filings cluster unevenly across
              // places - which is what the page is for and asserts no ranking.
              figure: <StateFigure />,
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
              //
              // The long tail replaces it: most sponsors file a handful of
              // cases and a few file thousands. That is true of the corpus,
              // needs no disputed count, and is the thing the page shows.
              figure: <EmployersFigure />,
            },
            {
              href: "/perm-attorneys",
              label: "Law firms",
              what: "View law firm filing metrics",
              // Deleted for the same reason as the sponsor share above. The
              // fan says the thing that actually distinguishes this page from
              // the employers one: many employers, far fewer firms filing for
              // them. A second long-tail chart here would have made two
              // different questions look like one.
              figure: <FirmsFigure />,
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
                  </span>{" "}
                  {/* THE BAR IS DRAWN TO SCALE, which is the whole reason to
                      draw it. The denial rate is a couple of percent, so an
                      honest bar is a sliver against a long remainder - and
                      that IS the finding this page exists to deliver, since
                      the number people arrive fearing is far larger. A bar
                      padded to a visible minimum would quietly argue the
                      opposite of the data. `Math.max(0.6, ...)` keeps a
                      non-zero rate from rounding away to an empty track
                      entirely, and 0.6% of the width stays visually tiny. */}
                  <span
                    className="mt-2 block h-1.5 w-full bg-border/40"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full bg-[var(--data-bad-ink)]"
                      style={{
                        width: `${Math.min(100, Math.max(0.6, figures.denial.rate))}%`,
                      }}
                    />
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
