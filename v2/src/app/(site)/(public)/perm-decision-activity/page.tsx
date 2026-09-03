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
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { PageBasics } from "@/components/data/PageBasics";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { getDatasetSchema } from "@/lib/structuredData";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DecisionPaceChart } from "@/components/activity/DecisionPaceChart";
import { OutcomeMix } from "@/components/activity/OutcomeMix";
import { WeekdayShape } from "@/components/activity/WeekdayShape";
import { ChangeFeedBrowser } from "@/components/activity/ChangeFeedBrowser";
import { getActivitySeries } from "@/lib/turso/activity";
import { getChangeActivity } from "@/lib/turso/changes";
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

const TITLE = "PERM Decision Activity";
const DESCRIPTION =
  "How many PERM decisions DOL issues each day and week, the shape of its working week, and what happened to the cases it decided.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-decision-activity" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-decision-activity",
  },
};

// SIX HOURS, NOT ONE (changed 2026-09-01 on cost evidence). The old comment
// said it plainly and then picked the wrong number: "the live scan moves daily
// and the disclosure series quarterly". An hour therefore bought nothing, it
// just regenerated a ~290 KB page 24 times to express one change. Six hours is
// still four times faster than the faster of the two inputs.
export const revalidate = 21600;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DecisionActivityPage() {
  const [series, mirrorSize, activity] = await Promise.all([
    getActivitySeries(),
    getLiveMirrorSize(),
    // The event record is days old, so a failure here must not take the whole
    // page down: the counts above it come from a different table entirely.
    //
    // 60 ROWS, NOT THE WHOLE DAY. This is the slice that goes in the
    // prerendered HTML, so it is sized for the page rather than for the
    // instrument: the browser below fetches the rest on its own, once, through
    // a cached route. Putting 1,090 rows here would add ~267 KB to every
    // regeneration of a page that revalidates six-hourly, and an ISR write unit
    // is 8 KB.
    getChangeActivity(null, 60).catch(() => null),
  ]);

  const disclosure = series.find((s) => s.source === "dol-disclosure");
  const live = series.find((s) => s.source === "flag-live");
  // The live scan is the current instrument, so it sets the headline pace. The
  // disclosure series is the fallback, never a splice of the two: the 43 days
  // between them hold no measurement at all.
  const current = live?.days.length ? live : disclosure;
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

  const schema = getDatasetSchema("https://permtracker.app", {
    name: "PERM decisions per day",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-decision-activity",
    isBasedOn: "https://flag.dol.gov/processingtimes",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Decisions, as DOL issued them
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          How fast the queue is moving
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every PERM determination carries the date it was issued. Counted by
          day, that is the pace of the queue.
        </p>
      </header>

      {currentPace ? (
        <section className="mt-8 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
          <h2 className="font-heading text-2xl font-black">
            The last {currentPace.weekdays + currentPace.weekendDays} days
          </h2>{" "}
          <dl className="mt-6 grid [&>*]:min-w-0 grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              {
                k: "Per weekday",
                v: fmt(currentPace.perWeekday),
                sub: `${currentPace.weekdays} weekdays counted`,
              },
              {
                k: "Per weekend day",
                v:
                  currentPace.perWeekendDay === null
                    ? "none"
                    : fmt(currentPace.perWeekendDay),
                sub:
                  currentPace.perWeekendDay === null
                    ? "no weekend in the window"
                    : `${currentPace.weekendDays} weekend days counted`,
              },
              {
                k: "Cases in the scan",
                v: fmt(mirrorSize),
                // A row count, not a status claim. Four fifths of the pending
                // rows carry a check older than 2026-08-01, so "tracked live"
                // would be false about the statuses even though the total is
                // exact.
                sub: "per-case scan of flag.dol.gov",
              },
              {
                k: "Decisions on record",
                v: fmt(recordTotal),
                sub: `over ${fmt(record.length)} days`,
              },
            ].map((d) => (
              // Keyed Fragment with a trailing space: array items render with
              // NOTHING between them, so "852" glues to "10 weekdays counted".
              <Fragment key={d.k}>
              <div>
                <dt className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
                  {d.k}
                </dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
                  {d.v}
                </dd>{" "}
                <dd className="mt-1 text-xs text-background/70">{d.sub}</dd>
              </div>{" "}
              </Fragment>
            ))}
          </dl>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-background/70">
            Weekday and weekend counted apart: one rate over both understates
            the weekday pace by about a fifth, and DOL does decide at
            weekends. {longDate(currentPace.from)} to {longDate(currentPace.to)}.
          </p>
        </section>
      ) : null}

      {activity ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">
            The cases DOL moved, day by day
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
            Every PERM, prevailing wage and LCA case whose status changed on a
            given day, with what it changed from and what it changed to. Search
            it, filter it by either end of the transition, and sort on any
            column.
          </p>{" "}
          <ChangeFeedBrowser
            calendar={activity.calendar}
            initialDay={activity.day}
          />{" "}
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/70">
            Dated when our scan <b>saw</b> the change, not when DOL made it: a
            Friday determination read on Monday is a Monday row.
          </p>{" "}
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
                      label: "Live case scan",
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
            The quarterly disclosure file ends 2026-06-30 and the per-case scan
            of flag.dol.gov begins 2026-08-13. Drawing those 44 days as zero
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
          subject={`Mean decisions by day of week, ${fmt(record.length)} days`}
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
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                  {col.title}
                </h3>{" "}
                <ol className="mt-3 m-0 list-none p-0">
                  {col.rows.map((d) => (
                    <Fragment key={d.date}>
                    <li className="flex items-baseline justify-between gap-3 border-t-2 border-border py-2 first:border-t-0 first:pt-0">
                      <span className="text-sm font-bold">{longDate(d.date)}</span>{" "}
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {fmt(d.total)}
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
                {fmt(idleWeekdays.length)} weekdays carry no determination at
                all, so the quietest list is a list of ties: federal holidays
                and the October 2025 stoppage.
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
