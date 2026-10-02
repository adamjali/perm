/**
 * How much PERM work DOL actually clears, day by day.
 *
 * WHY A PAGE OF ITS OWN. The daily series was already ingested and already
 * drawn, as a single weekly line at the bottom of /perm-cases where it
 * answers "is the case browser current". Everything else in it was unread:
 * the shape of the working week, what happens to the cases that get decided,
 * the extremes, and the fact that the record has holes in it. A line at the
 * foot of another page cannot carry any of that, and the pace of the queue is
 * the second question every person waiting on a case asks after "where am I".
 *
 * WHAT THIS PAGE REFUSES. No forecast, no "at this rate you will be decided
 * in N weeks", no blended index. The estimator on /tools/perm-timeline-calculator
 * is where a reader who wants a position in the queue goes, and it says what
 * it assumes. This page reports what has already happened.
 */

import { Fragment } from "react";
import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { PageBasics } from "@/components/data/PageBasics";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { getDatasetSchema } from "@/lib/structuredData";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DecisionPaceChart } from "@/components/activity/DecisionPaceChart";
import { PermPulse } from "@/components/pulse/PermPulse";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { OutcomeMix } from "@/components/activity/OutcomeMix";
import { WeekdayShape } from "@/components/activity/WeekdayShape";
import { ChangeFeedBrowser } from "@/components/activity/ChangeFeedBrowser";
import { getActivitySeries } from "@/lib/turso/activity";
import { getChangeActivity } from "@/lib/turso/changes";
import { getCoverageWindows, type CoverageWindows } from "@/lib/turso/decidedDays";
import { getLiveMirrorSize } from "@/lib/turso/publicData";
import {
  fillZeros,
  outcomeByQuarter,
  pace,
  weekdayExtremes,
  weekdayProfile,
  zeroWeekdays,
  type ActivityDay,
} from "@/lib/activityStats";
import { formatInt } from "@/lib/format";
import { MS_PER_DAY } from "@/lib/time";
import { SITE_URL } from "@/lib/constants/site";

const TITLE = "PERM Decision Activity";
const DESCRIPTION =
  "How many PERM decisions DOL issues each day and week, the shape of its working week, and what happened to the cases it decided.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-decision-activity" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-decision-activity",
  },
}, "perm-decision-activity");

// SIX HOURS: the live scan moves with each sweep and the disclosure series
// quarterly, so an hourly window would regenerate a ~290 KB page 24 times a
// day to express a change or two. Each sweep expires the page anyway
// (/api/revalidate-sweep), so the window is only the backstop.
export const revalidate = 21600;

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "October 2015" from an ISO date, or null. */
function monthYear(iso: string | undefined): string | null {
  if (!iso) return null;
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default async function DecisionActivityPage() {
  const [series, mirrorSize, activity, windows, coverage] = await Promise.all([
    getActivitySeries(),
    getLiveMirrorSize(),
    // The event record is days old, so a failure here must not take the whole
    // page down: the counts above it come from a different table entirely.
    //
    // 60 ROWS, NOT THE WHOLE DAY. This is the slice that goes in the
    // prerendered HTML, so it is sized for the page rather than for the
    // instrument: the browser below fetches the rest on its own, once, through
    // a cached route. Putting 1,090 rows here would add ~267 KB to every
    // regeneration of a page that revalidates six-hourly.
    getChangeActivity(null, 60).catch(() => null),
    // WHAT EACH RECORD CAN ANSWER, read once per regeneration rather than
    // per visitor. Six index seeks. It moves only when a quarterly file
    // lands or the sweep runs, so a hardcoded pair of dates would silently
    // under-report coverage for months.
    getCoverageWindows().catch((): CoverageWindows => ({ decided: null, observed: null })),
    getSweepCoverage().catch(() => null),
  ]);

  const disclosure = series.find((s) => s.source === "dol-disclosure");
  const live = series.find((s) => s.source === "sweep-observed");
  // The live scan is the current instrument, so it sets the headline pace. The
  // disclosure series is the fallback, never a splice of the two: the 43 days
  // between them hold no measurement at all.
  const current = live?.days.length ? live : disclosure;
  // Days with no record between the two series, read off the series.
  const lastDisclosed = disclosure?.days.at(-1)?.date;
  const firstObserved = live?.days[0]?.date;
  const gapDays =
    lastDisclosed && firstObserved
      ? Math.round((Date.parse(`${firstObserved}T00:00:00Z`) - Date.parse(`${lastDisclosed}T00:00:00Z`)) / MS_PER_DAY) - 1
      : null;
  const currentPace = current ? pace(current.days, 28) : null;
  // ZERO-FILLED, and that is the difference between showing October 2025 and
  // hiding it. The disclosure series is GROUP BY decision_date over the case
  // corpus, so a day with no row is a day DOL decided nothing. The live scan
  // is contiguous and needs no fill.
  const record: ActivityDay[] = fillZeros(disclosure?.days ?? []);
  const profile = weekdayProfile(record);
  const quarters = outcomeByQuarter([...record, ...(live?.days ?? [])]);
  const extremes = weekdayExtremes(record, 5);
  const idleWeekdays = zeroWeekdays(record);
  const recordTotal = record.reduce((a, b) => a + b.total, 0);

  const schema = getDatasetSchema(SITE_URL, {
    name: "PERM decisions per day",
    description: DESCRIPTION,
    url: `${SITE_URL}/perm-decision-activity`,
    isBasedOn: "https://flag.dol.gov/processingtimes",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          How fast the queue is moving
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every PERM decision DOL makes, counted by day.
        </p>
      </header>

      {live?.days.length ? (
        <div className="mt-8">
          <PermPulse
            days={live.days.slice(-56)}
            checkedAt={coverage?.checkedAt ?? null}
            showLink={false}
            variant="block"
          />
        </div>
      ) : null}

      {currentPace ? (
        // ONE BAND, NOT TWO: a ledger row under the day-by-day charts, the
        // same four figures with no second heading, never a second slab
        // restating their pace.
        <section className="mt-6" aria-label={`The last ${currentPace.weekdays + currentPace.weekendDays} days`}>
          <dl className="grid [&>*]:min-w-0 grid-cols-2 gap-x-6 gap-y-4 border-y-2 border-border py-4 sm:grid-cols-4">
            {[
              {
                k: "Per weekday",
                v: formatInt(currentPace.perWeekday),
                sub: `${currentPace.weekdays} weekdays counted`,
              },
              {
                k: "Per weekend day",
                v:
                  currentPace.perWeekendDay === null
                    ? "none"
                    : formatInt(currentPace.perWeekendDay),
                sub:
                  currentPace.perWeekendDay === null
                    ? "no weekend in the window"
                    : `${currentPace.weekendDays} weekend days counted`,
              },
              {
                k: "Cases in the scan",
                v: formatInt(mirrorSize),
                // A row count, not a status claim: a pending row carries the
                // status of its last check, so "tracked live" would claim more
                // about the statuses than the exact total can.
                sub: "per-case scan of flag.dol.gov",
              },
              {
                k: "Decisions on record",
                v: formatInt(recordTotal),
                sub: `over ${formatInt(record.length)} days`,
              },
            ].map((d) => (
              // Keyed Fragment with a trailing space: array items render with
              // NOTHING between them, so "852" glues to "10 weekdays counted".
              <Fragment key={d.k}>
              <div>
                <dt className="text-sm font-bold text-foreground/70">
                  {d.k}
                </dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
                  {d.v}
                </dd>{" "}
                <dd className="mt-1 text-sm text-foreground/70">{d.sub}</dd>
              </div>{" "}
              </Fragment>
            ))}
          </dl>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70">
            {longDate(currentPace.from)} to {longDate(currentPace.to)}. Weekdays
            and weekends counted apart: one rate over both understates the
            weekday pace by about a fifth.
          </p>
        </section>
      ) : null}

      {activity ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">
            The cases DOL moved, day by day
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base text-foreground/75">
            Pick a day, or a range, and filter every case DOL moved.
          </p>{" "}
          <details className="mt-2 max-w-3xl">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-bold underline decoration-2 underline-offset-4">
              What each date gives you
            </summary>{" "}
            <p className="mt-1 text-base leading-relaxed text-foreground/75">
            Pick any date back to{" "}
            {monthYear(windows.decidedByProgram?.perm?.from ?? windows.decided?.from) ?? "October 2023"}{" "}
            for PERM
            {windows.decidedByProgram?.lca?.from
              ? `, ${monthYear(windows.decidedByProgram.lca.from)} for LCAs`
              : ""}
            {windows.decidedByProgram?.pwd?.from
              ? ` and ${monthYear(windows.decidedByProgram.pwd.from)} for wage requests`
              : ""}
            . On a date DOL has published, you get every case it decided, with
            the outcome, wage, worksite, occupation and law firm on each, and
            on PERM cases filed on DOL&apos;s old form, the worker&apos;s
            citizenship, visa and education. On a date newer
            than its last file, you get what our own daily check saw change,
            with what each case changed from and to. Search, filter and sort
            either one, and pick a range to cross both.
          </p>{" "}
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              A change row is dated when our scan <b>saw</b> it, not when DOL
              made it: a Friday determination read on Monday is a Monday row. A
              decided row carries DOL&apos;s own determination date.
            </p>
          </details>{" "}
          <ChangeFeedBrowser
            calendar={activity.calendar}
            initialDay={activity.day}
            windows={windows}
          />{" "}

          {/* WHERE THE SAME CASES LIVE, said plainly. A reader who has just
              found a case here has an obvious next question, and every one of
              these answers it from the same corpus. */}
          <nav
            aria-label="Related records"
            className="mt-6 max-w-3xl border-2 border-border bg-card p-4"
          >
            <p className="font-mono text-sm font-bold uppercase tracking-wider">
              The same cases, other ways in
            </p>{" "}
            <ul className="mt-2 grid grid-cols-1 gap-2 text-base sm:grid-cols-2">
              {[
                { href: "/perm-case-status", label: "Look up one case by its number" },
                { href: "/perm-cases", label: "Browse every decided PERM case" },
                { href: "/pwd-cases", label: "Prevailing wage requests, pending included" },
                { href: "/lca-cases", label: "H-1B labor condition applications" },
                { href: "/perm-queue", label: "Where DOL is in the filing queue" },
                { href: "/perm-processing-times", label: "DOL's published processing times" },
              ].map(({ href, label }) => (
                <Fragment key={href}>
                  <li>
                    <Link
                      href={href}
                      className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                    >
                      {label}
                    </Link>
                  </li>{" "}
                </Fragment>
              ))}
            </ul>
          </nav>{" "}
          <FinePrint summary="What this record covers, and what is left out">
            <p>
              DOL publishes no timestamp of its own. Observations begin{" "}
              {activity.calendar.observedSince
                ? longDate(activity.calendar.observedSince)
                : "recently"}
              , the day the per-case scan started, and the record cannot be
              extended backwards: nothing before that date was ever observed, so
              no amount of reading DOL now can recover it. This is a short record
              that grows nightly rather than a history.
            </p>{" "}
            <p>
              Prevailing wage and LCA changes join it later than PERM does.{" "}
              {activity.calendar.programSince.pwd
                ? `Wage requests from ${longDate(activity.calendar.programSince.pwd)}`
                : "Wage requests are not in it yet"}
              {"; "}
              {activity.calendar.programSince.lca
                ? `LCAs from ${longDate(activity.calendar.programSince.lca)}`
                : "LCAs are not in it yet"}
              . A day before those dates shows no rows for them because none were
              observed, not because DOL was idle.
            </p>{" "}
            <p>
              Two kinds of row are left out of every day, and the count each one
              costs that day is printed above the table rather than here, because
              it changes with the day the reader picks. A certification whose
              180-day I-140 window lapsed is a clock running out, not DOL acting
              on a case. And a single timestamp carrying more than 5,000 changes
              is a scan catching up on months of history: DOL{"\u2019"}s heaviest
              measured day is under 2,000, and one sweep wrote 94,523 rows at
              once, so the whole of such a timestamp is dropped.
            </p>
          </FinePrint>
        </section>
      ) : null}

      {series.length > 0 ? (
        <FigurePlate
          n="01"
          title="Decisions per week"
          subject="Every week in the record, with its holes left open"
          caption={
            <>
              A week at the floor and a break in the line mean opposite things.
              At the floor DOL decided nothing: October 2025 is three straight
              weeks there, two determinations in thirty days. The one break is
              ours, not DOL{"\u2019"}s. Why October stopped is not established
              here.
            </>
          }
          source="DOL PERM disclosure files and flag.dol.gov"
          className="mt-10"
        >
          <DecisionPaceChart
            annotations={[{ date: "2025-10-13", label: "Oct 2025" }]}
            series={[
              ...(disclosure
                ? [
                    {
                      label: "Disclosure corpus, through 2026-06-30",
                      // -ink, not the bare token: a chart line is a graphical
                      // object under WCAG 1.4.11's 3:1 floor and --primary
                      // measures 2.05:1 on this page.
                      color: "var(--data-good-ink)",
                      days: record,
                    },
                  ]
                : []),
              ...(live
                ? [
                    {
                      label: "Our daily check of DOL",
                      color: "var(--stage-pwd-ink)",
                      days: live.days,
                    },
                  ]
                : []),
            ]}
          />
        </FigurePlate>
      ) : null}

      {series.length > 0 ? (
        <FinePrint summary="The break, and October 2025" className="mt-4">
          <p>
            The quarterly disclosure file ends{" "}
            {disclosure?.days.at(-1)?.date ?? "with its last quarter"} and our
            daily check of DOL&apos;s case status begins{" "}
            {live?.days[0]?.date ?? "later"}
            {gapDays !== null ? `. Drawing those ${gapDays} days as zero` : ". Drawing that gap as zero"}{" "}
            would invent a second national stoppage that never happened.
          </p>{" "}
          <p>
            October 2025 ended when DOL announced on the 31st that it had{" "}
            <a
              href="https://flag.dol.gov/announcement/2025-10-31"
              rel="nofollow noopener"
            >
              resumed application processing
            </a>
            .
          </p>
        </FinePrint>
      ) : null}

      {record.length > 0 ? (
        <FigurePlate
          n="02"
          title="The working week"
          subject={`Mean decisions by day of week, ${formatInt(record.length)} days`}
          caption="Counting a Saturday as a working day drags a per-working-day rate down without saying so."
          source="DOL PERM disclosure files"
          className="mt-10"
        >
          <WeekdayShape profile={profile} />
        </FigurePlate>
      ) : null}

      {quarters.length > 0 ? (
        <FigurePlate
          n="03"
          title="What happened to them"
          subject="Share of decided cases, by federal quarter"
          caption="Denial and withdrawal have moved in opposite directions. Neither is explained here: a share of decisions cannot separate a change in how DOL adjudicates from a change in who is filing."
          source="DOL PERM disclosure files and flag.dol.gov"
          className="mt-10"
        >
          <OutcomeMix quarters={quarters} />
        </FigurePlate>
      ) : null}

      {extremes.busiest.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">
            The heaviest and lightest days
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
            Weekdays only: a quietest list full of Sundays says nothing.
          </p>
          <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                { title: "Busiest", rows: extremes.busiest },
                { title: "Quietest", rows: extremes.quietest },
              ] as const
            ).map((col) => (
              <Fragment key={col.title}>
              <div className="border-2 border-border bg-card p-5 shadow-hard-sm">
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/60">
                  {col.title}
                </h3>{" "}
                <ol className="mt-3 m-0 list-none p-0">
                  {col.rows.map((d) => (
                    <Fragment key={d.date}>
                    <li className="flex items-baseline justify-between gap-3 border-t-2 border-border py-2 first:border-t-0 first:pt-0">
                      <span className="text-sm font-bold">{longDate(d.date)}</span>{" "}
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {formatInt(d.total)}
                      </span>
                    </li>{" "}
                    </Fragment>
                  ))}
                </ol>
              </div>{" "}
              </Fragment>
            ))}
          </div>
          {idleWeekdays.length > 0 ? (
            <>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/60">
                {formatInt(idleWeekdays.length)} weekdays carry no determination at
                all, so the quietest list is a list of ties: federal holidays,
                the January 2018 shutdown and the October 2025 stoppage.
              </p>{" "}
              <FinePrint summary="Why a zero is a zero" className="mt-3">
                <p>
                  These are real days, not gaps. The series is counted from the
                  case corpus, so a day with no cases decided produces no row,
                  and those days are read as zero rather than as unmeasured.
                </p>
              </FinePrint>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on a case?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Pace alone does not place a case in the queue. The{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              decision estimator
            </Link>{" "}
            reads how many filings sit ahead of your month;{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              processing times
            </Link>{" "}
            carries DOL&apos;s own position.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Want the cases themselves?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Every decision counted here is one row in the{" "}
            <Link
              href="/perm-cases"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              case browser
            </Link>
            , and the{" "}
            <Link
              href="/methodology"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              methodology
            </Link>{" "}
            says how each figure is computed.
          </p>
        </div>
      </section>

      <PageBasics page="perm-decision-activity" />{" "}
      <DataProvenance datasets={["daily-decisions", "perm-case-status"]} />
    </div>
  );
}
