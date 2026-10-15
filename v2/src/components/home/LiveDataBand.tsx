import { Fragment } from "react";
import Link from "next/link";


import { QueueTape } from "@/components/tools/QueueTape";
import { TapeReveal } from "@/components/tools/TapeReveal";
import { formatAsOf } from "@/lib/dolFormat";

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
  /** The day-by-day charts, drawn under the tape (the homepage passes PermPulse). */
  children?: React.ReactNode;
}

/**
 * A figure for every card, and a DIFFERENT SHAPE for each.
 *
 * Each card carries its own visual, never a figure for the sake of having
 * one (see below).
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS: employers and law firms have no
 * honest number to print. DOL spells one practice six ways, so any count or
 * ranking off these files overstates until entity identity is normalised. So
 * those two cards get a DIAGRAM of
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
  children,
}: LiveDataBandProps) {
  if (!frontierMonth) return null;

  return (
    <section aria-labelledby="pace-title" className="bg-tint">
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div>
            <h2 id="pace-title" className="font-heading text-2xl font-bold sm:text-3xl">
              How fast DOL works through the line
            </h2>{" "}
            {asOf ? (
              <p className="mt-2 text-base text-soft">From DOL&apos;s own processing times, as of {formatAsOf(asOf)}</p>
            ) : null}
          </div>{" "}
          <Link href="/tools" className="link inline-flex min-h-11 items-center">
            Every dataset
          </Link>
        </div>

        {/* The homepage's one moment of motion: the processed months fill in
            once, left to right, when the tape first scrolls into view. */}
        <TapeReveal>
          <QueueTape frontierMonth={frontierMonth} className="mt-8" monthsBehind={6} monthsAhead={8} reveal />
        </TapeReveal>{" "}
        {children ? <div className="mt-8">{children}</div> : null}

      </div>
    </section>
  );
}

/**
 * The dataset doors, kept out of the queue band so each band does one job.
 * The search is the header's box, so there's no second one here.
 */
export function DataShelf({ figures }: { figures?: DataPageFigures }) {
  return (
    <section aria-labelledby="data-shelf-heading" className="bg-tint border-b-3 border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16">
        <h2 id="data-shelf-heading" className="font-heading text-2xl font-bold sm:text-3xl">
          Look through the record
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-soft">
          Every filing DOL has published, by state, wage, employer and law firm, and why cases are denied.
        </p>{" "}
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
          className="object mt-8 grid grid-cols-2 [&>*]:min-w-0 max-sm:[&>*:last-child]:col-span-2 sm:max-lg:grid-cols-6 sm:max-lg:[&>*]:col-span-2 sm:max-lg:[&>*:nth-child(n+4)]:col-span-3 lg:grid-cols-5"
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
                        <span className="text-muted-foreground">{rung}</span>{" "}
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
                  <span className="block font-heading text-2xl font-bold leading-none">
                    {figures.denial.rate}%
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm font-semibold text-muted-foreground">
                    denied
                  </span>{" "}
                  <span className="mt-1 block font-mono text-sm text-muted-foreground">
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
                    className="mt-2 block h-1.5 w-full bg-border"
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
              className="group flex flex-col bg-card p-4 transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:bg-accent border-2 shadow-hard-sm motion-safe:hover:-translate-y-[2px] hover:shadow-hard motion-safe:active:translate-y-0 active:shadow-hard-sm border-border"
            >
              {/* THE PICTURE AND THE NAME: no "View ..." line or OPEN row
                  restating the label; the whole card is the link, and `what`
                  names it for screen readers. */}
              <span className="flex items-center justify-between gap-2 font-heading text-lg font-bold">
                {d.label}{" "}
              </span>{" "}
              {d.figure ? (
                <span className="mt-3 block border-t-2 border-border">
                  {d.figure}
                </span>
              ) : null}{" "}
              <span className="sr-only">{d.what}</span>{" "}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
