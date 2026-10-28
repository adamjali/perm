import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FilingMonthBars } from "@/components/data/FilingMonthBars";
import { buildSorterRun } from "@/components/figures/card-sorter/model";
import { BulletinCalendar } from "@/components/numbers/BulletinCalendar";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { StageBar, StageLegend } from "@/components/queue/StageBar";
import { groupByStage } from "@/components/queue/stages";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buttonVariants } from "@/components/ui/button";
import { bulletinCalendar, bulletinTally, type WeekCount } from "@/lib/byTheNumbers";
import { SITE_URL } from "@/lib/constants/site";
import { getBacklogCensus } from "@/lib/db/backlog";
import {
  NEW_EMPLOYER_DAYS,
  RECENT_DAYS,
  getNewEmployers,
  getRecentFilings,
  getRfiWeeks,
  getVisaBulletinsHeld,
} from "@/lib/db/byTheNumbers";
import { getEmployerStages } from "@/lib/db/employerStages";
import { getProcessingTimesArchive } from "@/lib/db/openData";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { getObservedDays } from "@/lib/db/pulse";
import { getPwdSummary } from "@/lib/db/pwdCases";
import { getRfiClock } from "@/lib/db/rfiClock";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import { HOLD_STATUS, heldRanking, holdSinceShort } from "@/lib/employerStages";
import { entityHref } from "@/lib/entityPayload";
import { formatInt, formatShareOf } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { lastDays, pulseHeadline, pulseSummary } from "@/lib/pulseStats";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import { checkedLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { longDate, monthDay, monthTick, monthYear } from "@convex/lib/months";

/**
 * PERM by the numbers: the totals DOL's own case records add up to, which DOL
 * doesn't publish itself. One board, one count per tile, each with its chart.
 *
 * Every figure is a count of DOL's records as our sweep last read them:
 * nothing is modelled, estimated or graded here. A tile whose source document
 * is missing is left out rather than drawn as zero, and a failed read throws,
 * so the page keeps its last good render.
 *
 * The board is the "well-kept board" direction: tiles fitted edge to edge on
 * the tint, one object (the waiting line), each tile a figure, its claim, its
 * chart and one way on.
 */

// The drawing and its kit load only here.
const CardSorterFigure = dynamic(() => import("@/components/figures/card-sorter/CardSorterFigure"));

const TITLE = "PERM Statistics From DOL's Own Records";
const H1 = "PERM by the numbers";
const DESCRIPTION =
  "The PERM totals DOL doesn't publish: cases waiting by stage, holds by employer, decisions per day, new filings by job, new sponsors and RFIs.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/perm-by-the-numbers" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/perm-by-the-numbers" },
  },
  "perm-by-the-numbers",
);

// Every sweep, DOL republication and new bulletin expires the page
// (/api/revalidate-sweep, -dol, -bulletin); six hours is the backstop.
export const revalidate = 21600;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;

/** "Week of Oct 19\n2,117 cases so far". */
function weekColumns(weeks: readonly WeekCount[], noun: string, unitOne: string): Column[] {
  return weeks.map((w, i) => {
    const last = i === weeks.length - 1;
    return {
      key: w.week,
      value: w.count,
      label: `Week of ${monthDay(w.week)}`,
      tip: `Week of ${monthDay(w.week)}\n${formatInt(w.count)} ${w.count === 1 ? unitOne : noun}${w.partial ? " so far" : ""}`,
      now: last,
      partial: w.partial,
    };
  });
}

/** One tile of the board: its claim as the heading (the figure first), then its picture. */
function Tile({
  id,
  figure,
  claim,
  sub,
  children,
  foot,
  more,
  action,
  object = false,
  className,
}: {
  id: string;
  figure?: ReactNode;
  claim: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  more?: { href: string; label: string };
  /** The tile's one button, after everything else. */
  action?: ReactNode;
  object?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-h`}
      className={cn("flex min-w-0 flex-col p-5 sm:p-6", object ? "object bg-card" : "bg-tint", className)}
    >
      <h2 id={`${id}-h`} className="font-heading">
        {figure !== undefined ? (
          <span className="block text-4xl font-bold leading-none tabular-nums">{figure}</span>
        ) : null}{" "}
        <span className={cn("block font-bold", figure !== undefined ? "mt-2 text-xl" : "text-2xl")}>{claim}</span>
      </h2>{" "}
      {sub ? <p className="mt-2 text-base text-soft">{sub}</p> : null}{" "}
      {children ? <div className="mt-5 flex flex-1 flex-col">{children}</div> : null}{" "}
      {foot ? <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{foot}</div> : null}{" "}
      {more ? (
        <p className="mt-4">
          <Link href={more.href} className="link inline-flex min-h-[44px] items-center text-base font-semibold">
            {more.label}
          </Link>
        </p>
      ) : null}{" "}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export default async function PermByTheNumbersPage() {
  const [census, observed, coverage, stages, filings, newEmployers, rfiWeeks, rfiClock, pwd, snapshot, readings, bulletins] =
    await Promise.all([
      getBacklogCensus(),
      getObservedDays(),
      getSweepCoverage(),
      getEmployerStages(),
      getRecentFilings(),
      getNewEmployers(),
      getRfiWeeks(),
      getRfiClock(),
      getPwdSummary(),
      getProcessingTimes(),
      getProcessingTimesArchive(),
      getVisaBulletinsHeld(),
    ]);

  // The waiting line, by DOL's own month.
  const { stages: lineStages } = groupByStage(census.statuses);
  const dolMonth = snapshot ? analystReviewQueue(snapshot.permQueues)?.priorityDate?.slice(0, 7) ?? null : null;
  const atRfi = census.statuses.find((s) => s.status === "RFI ISSUED")?.count ?? 0;

  // The newest working day DOL decided, and the thirty days before it.
  const pulse = pulseHeadline(observed);
  const days = lastDays(observed, 30);
  const summary = pulseSummary(observed);
  const sorter = buildSorterRun({ statuses: census.statuses, decided: pulse?.day.total ?? null, decidedOn: pulse?.day.date ?? null });

  // Holds by employer.
  const onHold = stages?.nationwide[HOLD_STATUS] ?? 0;
  const held = stages ? heldRanking(stages.employers, 5, 6) : [];
  const topThree = held.slice(0, 3).reduce((a, r) => a + (r.byStatus[HOLD_STATUS] ?? 0), 0);

  // DOL's analyst-review month, reading by reading, one per PERM date.
  const steps = [...new Map(readings.map((r) => [r.permAsOf, r])).values()]
    .map((r) => ({ asOf: r.permAsOf, month: analystReviewQueue(r.permQueues)?.priorityDate?.slice(0, 7) ?? null }))
    .filter((s): s is { asOf: string; month: string } => !!s.month)
    .sort((a, b) => (a.asOf < b.asOf ? -1 : 1));
  const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));
  const base = steps.length ? Math.min(...steps.map((s) => monthIndex(s.month))) - 1 : 0;
  const lastStep = steps[steps.length - 1] ?? null;
  const firstStep = steps[0] ?? null;
  const moved = lastStep && firstStep ? monthIndex(lastStep.month) - monthIndex(firstStep.month) : 0;

  const pwdMonth =
    snapshot?.pwdQueues.find((q) => q.program.toUpperCase() === "PERM")?.oewsReceiptDate?.slice(0, 7) ?? null;

  const calendar = bulletinCalendar(bulletins);
  const tally = bulletinTally(calendar);
  const firstBulletin = bulletins[0] ?? null;
  const lastBulletin = bulletins[bulletins.length - 1] ?? null;

  const holdRows: BarRow[] = held.map((r) => ({
    key: r.slug ?? r.name,
    label: r.slug ? (
      <Link href={entityHref("employer", r.slug)} className="link">
        {r.name}
      </Link>
    ) : (
      r.name
    ),
    sub: holdSinceShort(r, stages?.logFrom ?? null) ?? undefined,
    value: r.byStatus[HOLD_STATUS] ?? 0,
    text: formatInt(r.byStatus[HOLD_STATUS] ?? 0),
    tone: "blue",
    tip: `${r.name}\n${formatInt(r.byStatus[HOLD_STATUS] ?? 0)} on hold${holdSinceShort(r, stages?.logFrom ?? null) ? `, ${holdSinceShort(r, stages?.logFrom ?? null)}` : ""}`,
  }));

  const jobRows: BarRow[] = filings.jobs.slice(0, 8).map((j) => ({
    key: j.label,
    label: j.label,
    sub: j.employers === 1 ? "one employer" : `${formatInt(j.employers)} employers`,
    value: j.cases,
    text: formatInt(j.cases),
    tone: "yellow",
  }));

  const employerRows: BarRow[] = filings.employers.map((e) => ({
    key: e.slug ?? e.label,
    label: e.slug ? (
      <Link href={entityHref("employer", e.slug)} className="link">
        {e.label}
      </Link>
    ) : (
      e.label
    ),
    value: e.cases,
    text: formatInt(e.cases),
    tone: "yellow",
    tip: `${e.label}\n${formatInt(e.cases)} filed in ${RECENT_DAYS} days`,
  }));

  const datasetSchema = getDatasetSchema(SITE_URL, {
    name: "PERM by the numbers",
    description:
      "Totals from DOL's PERM case records that DOL doesn't publish: pending cases by stage and filing month, holds by employer, decisions per day, new filings by job and employer, employers new to PERM, and RFIs issued per week.",
    url: `${SITE_URL}/perm-by-the-numbers`,
    isBasedOn: "https://flag.dol.gov/case-status-search",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <JsonLdScript schema={datasetSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight">{H1}</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">
          What DOL&rsquo;s own case records add up to, counted each night from its case-status search. DOL doesn&rsquo;t
          publish these totals itself.
        </p>{" "}
        {coverage ? (
          <p className="mt-3 font-mono text-sm text-muted-foreground">Checked against DOL {checkedLabel(coverage.checkedAt)}</p>
        ) : null}
      </header>{" "}

      <div className="mt-10 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12 [&>*]:min-w-0">
        <Tile
          id="line"
          object
          className="md:col-span-2 lg:col-span-7"
          figure={formatInt(census.pending)}
          claim="PERM cases waiting with DOL"
          sub={
            dolMonth
              ? `DOL's analyst review is working cases filed in ${monthYear(dolMonth)}. The rest wait behind it, or outside the line.`
              : "Most wait in filing order. The rest are outside the line."
          }
          more={{ href: "/perm-queue", label: "Every filing month" }}
        >
          <StageBar stages={lineStages} scale="composition" tipHeading="Waiting now" />{" "}
          <StageLegend stages={lineStages} className="mt-4" />{" "}
          <FilingMonthBars
            months={census.months.map((m) => ({ month: m.month, total: m.total, pending: m.pending }))}
            frontier={dolMonth}
            nouns="PERM cases"
            label="PERM cases by filing month, decided and still waiting"
            className="mt-6"
          />
        </Tile>{" "}

        {pulse ? (
          <Tile
            id="decided"
            className="lg:col-span-5"
            figure={formatInt(pulse.day.total)}
            claim={`decided on ${weekdayOf(pulse.day.date)}, ${monthDay(pulse.day.date)}`}
            sub={
              pulse.typical !== null
                ? `A typical ${weekdayOf(pulse.day.date)} is about ${formatInt(pulse.typical)}.`
                : undefined
            }
            more={{ href: "/perm-decision-activity", label: "Day by day" }}
          >
            {summary ? (
              <dl className="m-0 mb-5 grid grid-cols-3 gap-4 [&>*]:min-w-0">
                {[
                  { label: "Last 7 days", value: formatInt(summary.last7) },
                  { label: "Last 30 days", value: formatInt(summary.last30) },
                  { label: "Certified", value: summary.certifiedPct === null ? null : `${summary.certifiedPct}%` },
                ]
                  .filter((f): f is { label: string; value: string } => f.value !== null)
                  .map((f) => (
                    <Fragment key={f.label}>
                      {" "}
                      <div>
                        <dt className="text-sm text-muted-foreground">{f.label}</dt>{" "}
                        <dd className="m-0 mt-1 font-heading text-2xl font-bold tabular-nums">{f.value}</dd>
                      </div>
                    </Fragment>
                  ))}
              </dl>
            ) : null}{" "}
            <ColumnChart
              label={`PERM decisions per day, the last ${days.length} days`}
              unit="Decided"
              first={monthDay(days[0]!.date) ?? ""}
              last={monthDay(days[days.length - 1]!.date) ?? ""}
              height="min-h-44"
              grow
              columns={days.map((d) => ({
                key: d.date,
                value: d.total,
                label: longDate(d.date) ?? d.date,
                now: d.date === pulse.day.date,
                href: `/perm-decision-activity?day=${d.date}#day`,
                tip: `${weekdayOf(d.date).slice(0, 3)}, ${monthDay(d.date)}\n${formatInt(d.total)} decided\n${formatInt(d.certified)} certified\n${formatInt(d.denied)} denied\n${formatInt(d.withdrawn)} withdrawn`,
                parts: [
                  { value: d.certified, fill: "bg-data-good-ink" },
                  { value: d.denied, fill: "bg-data-bad-ink" },
                  { value: d.withdrawn, fill: "bg-chart-purple" },
                ],
              }))}
            />{" "}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-good-ink" />
                Certified
              </li>{" "}
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-bad-ink" />
                Denied
              </li>{" "}
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-chart-purple" />
                Withdrawn by the employer
              </li>
            </ul>
          </Tile>
        ) : null}{" "}

        {stages && held.length > 0 ? (
          <Tile
            id="holds"
            className="lg:col-span-5"
            figure={formatInt(onHold)}
            claim="cases DOL has put on hold"
            sub={
              onHold > 0
                ? `Three employers hold ${formatShareOf(topThree, onHold)} of them. DOL puts them on hold in batches, an employer at a time.`
                : undefined
            }
            more={{ href: "/perm-employers/under-review", label: "Every employer under review" }}
          >
            <BarRows rows={holdRows} label="PERM cases on hold, by employer" />
          </Tile>
        ) : null}{" "}

        <Tile
          id="filed"
          className="lg:col-span-7"
          figure={formatInt(filings.cases30)}
          claim={`new PERM cases in ${RECENT_DAYS} days`}
          sub={`Filed by ${formatInt(filings.employers30)} employers. DOL publishes a case only once it's decided.`}
          more={{ href: "/perm-cases", label: "Browse new cases" }}
        >
          <ColumnChart
            label="New PERM cases filed per week"
            unit="Filed"
            first={`Week of ${monthDay(filings.weeks[0]?.week) ?? ""}`}
            last={`Week of ${monthDay(filings.weeks[filings.weeks.length - 1]?.week) ?? ""}`}
            height="min-h-44"
            grow
            columns={weekColumns(filings.weeks, "cases", "case")}
          />
        </Tile>{" "}

        {jobRows.length > 0 ? (
          <Tile
            id="jobs"
            className="lg:col-span-6"
            claim="The jobs filed most"
            sub={`In the last ${RECENT_DAYS} days, as DOL prints the job title.`}
          >
            <BarRows rows={jobRows} label={`PERM cases by job title, the last ${RECENT_DAYS} days`} />
          </Tile>
        ) : null}{" "}

        {employerRows.length > 0 ? (
          <Tile
            id="employers"
            className="lg:col-span-6"
            claim="The employers filing most"
            sub={`In the last ${RECENT_DAYS} days. Each name opens the employer's record.`}
          >
            <BarRows rows={employerRows} label={`PERM cases by employer, the last ${RECENT_DAYS} days`} />
          </Tile>
        ) : null}{" "}

        {newEmployers.employers > 0 ? (
          <Tile
            id="new-employers"
            className="lg:col-span-7"
            figure={formatInt(newEmployers.employers)}
            claim="employers new to PERM"
            sub={`Their first case came in the last ${NEW_EMPLOYER_DAYS} days: ${formatInt(newEmployers.cases)} cases between them.`}
            foot="New means no decided PERM case in DOL's files since October 2015 under the same name. A company that filed before under another spelling can still appear."
          >
            <ColumnChart
              label="Employers filing their first PERM case, per week"
              unit="Employers"
              first={`Week of ${monthDay(newEmployers.weeks[0]?.week) ?? ""}`}
              last={`Week of ${monthDay(newEmployers.weeks[newEmployers.weeks.length - 1]?.week) ?? ""}`}
              columns={weekColumns(newEmployers.weeks, "new employers", "new employer")}
            />{" "}
            <ol className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {newEmployers.top.slice(0, 6).map((e) => (
                <Fragment key={e.slug ?? e.label}>
                  {" "}
                  <li className="flex min-h-[44px] items-baseline justify-between gap-3 border-t border-border py-2">
                    {e.slug ? (
                      // the link fills its 44px row, so the whole row is the tap target
                      <Link href={entityHref("employer", e.slug)} className="link -my-2 block min-w-0 truncate py-2.5">
                        {e.label}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate">{e.label}</span>
                    )}{" "}
                    <span className="shrink-0 font-mono text-base font-bold tabular-nums">{formatInt(e.cases)}</span>
                  </li>
                </Fragment>
              ))}
            </ol>
          </Tile>
        ) : null}{" "}

        <Tile
          id="rfi"
          className="lg:col-span-5"
          figure={formatInt(atRfi)}
          claim="cases at an RFI right now"
          sub={rfiWeeks.weeks[0] ? `DOL has issued ${formatInt(rfiWeeks.total)} since ${longDate(rfiWeeks.weeks[0].week)}.` : undefined}
          foot={
            rfiClock
              ? `Of ${formatInt(rfiClock.watched)} RFIs we followed from their first day, most left on day ${Math.round(rfiClock.leaveDays.p50)}, when the 30-day reply window closed. DOL then decided a median ${Math.round(rfiClock.afterLeaveDays.p50)} days later.`
              : undefined
          }
          more={{ href: "/perm-rfi-audit", label: "RFIs and audits" }}
        >
          <ColumnChart
            tone="blue"
            label="RFIs DOL issued per week"
            unit="RFIs"
            first={`Week of ${monthDay(rfiWeeks.weeks[0]?.week) ?? ""}`}
            last={`Week of ${monthDay(rfiWeeks.weeks[rfiWeeks.weeks.length - 1]?.week) ?? ""}`}
            height="min-h-40"
            grow
            columns={weekColumns(rfiWeeks.weeks, "RFIs", "RFI")}
          />
        </Tile>{" "}

        {pwd ? (
          <Tile
            id="wage-requests"
            className="lg:col-span-4"
            figure={formatInt(pwd.pending)}
            claim="wage requests waiting"
            sub={pwdMonth ? `DOL is deciding PERM requests filed in ${monthYear(pwdMonth)}.` : undefined}
            more={{ href: "/pwd-cases", label: "Wage requests" }}
          >
            <FilingMonthBars
              months={pwd.byMonth}
              frontier={pwdMonth}
              nouns="wage requests"
              label="Wage requests by filing month, decided and still waiting"
            />
          </Tile>
        ) : null}{" "}

        {lastStep && steps.length >= 2 ? (
          <Tile
            id="dol-page"
            className="lg:col-span-4"
            figure={monthYear(lastStep.month)}
            claim={`where DOL's line stood on ${monthDay(lastStep.asOf)}`}
            sub={`Up ${moved} ${moved === 1 ? "month" : "months"} since ${monthDay(firstStep!.asOf)}. DOL replaces its page each time; we keep every reading.`}
            more={{ href: "/perm-processing-times", label: "Processing times" }}
          >
            <ColumnChart
              tone="green"
              label="The filing month DOL's analyst review had reached, at each reading"
              unit="Month reached"
              height="min-h-40"
              grow
              showMax={false}
              first={monthDay(steps[0]!.asOf) ?? ""}
              last={monthDay(lastStep.asOf) ?? ""}
              columns={steps.map((s, i) => ({
                key: s.asOf,
                value: monthIndex(s.month) - base,
                label: `${longDate(s.asOf)}: ${monthYear(s.month)}`,
                tip: `DOL's page, ${monthDay(s.asOf)}\nAnalyst review at ${monthYear(s.month)}`,
                top: monthTick(s.month) ?? undefined,
                now: i === steps.length - 1,
              }))}
            />
          </Tile>
        ) : null}{" "}

        {calendar.length > 0 ? (
          <Tile
            id="bulletins"
            className="md:col-span-2 lg:col-span-4"
            figure={formatInt(tally.held)}
            claim="visa bulletins in one table"
            sub={
              firstBulletin && lastBulletin
                ? `${monthYear(firstBulletin.slice(0, 7))} to ${monthYear(lastBulletin.slice(0, 7))}, every cutoff as State printed it.`
                : undefined
            }
            foot={tally.missing > 0 ? `A blank month is one we haven't been able to read yet (${tally.missing} of them).` : undefined}
            action={
              <Link href="/open-data" className={buttonVariants({ size: "lg" })}>
                Download the files
              </Link>
            }
          >
            <BulletinCalendar years={calendar} />
          </Tile>
        ) : null}
      </div>{" "}

      {sorter ? (
        <section aria-labelledby="count-h" className="mt-16">
          <h2 id="count-h" className="font-heading text-2xl font-bold">
            How we count it
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
            Every night our sweep asks DOL&rsquo;s case-status search about each case still waiting, 50 numbers at a time,
            and files each one by the status DOL gives back. Every count on this page adds up those answers.
          </p>{" "}
          <div className="mt-6">
            <CardSorterFigure run={sorter} />
          </div>
        </section>
      ) : null}{" "}

      <DataProvenance
        datasets={["perm-case-status", "live-recent", "review-stages", "decisions-observed", "pwd-status", "processing-times", "visa-bulletin"]}
        className="mt-10 border-t-2 border-border pt-4"
      />
    </div>
  );
}
