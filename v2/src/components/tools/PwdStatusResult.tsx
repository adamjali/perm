import Link from "next/link";
import { estimatePwdDay, estimatePwdQueue } from "@/lib/perm";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { getPwdEstimatorData } from "@/lib/db/estimate";
import { getPwdDayData } from "@/lib/db/pwdDayQueue";
import { easternDay } from "@/lib/time";
import { DolUnanswered } from "@/components/tools/DolUnanswered";
import {
  lookupPwdCaseOutcome,
  lookupPwdDetermination,
  type PwdDisclosedRow,
} from "@/lib/db/pwdCases";
import { currentMonthUtc } from "@/lib/dolFormat";
import { calculatePWDExpiration } from "@/lib/perm";
import { formatWage } from "@/lib/wageFormat";
import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { QueueAlertForm } from "@/app/(site)/(public)/perm-processing-times/QueueAlertForm";
import { WatchThisNumber } from "@/components/tools/WatchThisNumber";
import { AnswerNext } from "@/components/tools/AnswerNext";
import { AnswerPanel } from "@/components/tools/Insight";
import { PageSection } from "@/components/data/PageSection";
import { RecordList } from "@/components/data/RecordList";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { isLookupGap } from "@/lib/dolMiss";
import { formatInt } from "@/lib/format";
import { formatDay } from "@/lib/dolFormat";
import { prettyStatus } from "@/components/queue/stages";

/**
 * A prevailing wage request (ETA-9141) by number: DOL's own status for it,
 * and where its filing month sits in DOL's wage queue.
 *
 * The estimate half composes `estimatePwdQueue`, the same calculator the
 * PWD queue page uses, from the same DOL processing-times snapshot, so a
 * number here and a month picked on the calculator page cannot disagree.
 * DOL runs two wage queues (OEWS survey wages and everything else) and a
 * case record does not say which one it is in, so both frontiers are
 * printed and the arithmetic is anchored on the OEWS one, which is the
 * common case and the later of the two.
 */



/** A share as a percent; one decimal just under 100, so 99.5% never reads as all of them. */
function sharePct(x: number): string {
  return x >= 0.99 && x < 1 ? `${(Math.floor(x * 1000) / 10).toFixed(1)}%` : `${Math.round(x * 100)}%`;
}


const ISSUED = /^(DETERMINATION ISSUED|REDETERMINATION|CENTER DIRECTOR REVIEW)/;

/**
 * How long the determination is good for. `calculatePWDExpiration` is the
 * central OEWS wage-year rule (a January determination expires June 30 of
 * that year, not 90 days on), and it throws on a malformed date, so the
 * date is shape-checked first and a failure prints nothing rather than a
 * wrong day.
 */
function validUntil(decisionDate: string | null): string | null {
  if (!decisionDate || !/^\d{4}-\d{2}-\d{2}$/.test(decisionDate)) return null;
  try {
    return calculatePWDExpiration(decisionDate);
  } catch {
    return null;
  }
}

/** DOL's own determination, from the quarterly disclosure file: the part the live endpoint never says. */
function Determination({ d }: { d: PwdDisclosedRow }) {
  const issued = ISSUED.test(d.status.toUpperCase());
  const wage = formatWage(d.wage, d.wageUnit);
  const until = issued ? validUntil(d.decisionDate) : null;
  return (
    <PageSection title="DOL's determination" lede="From DOL's quarterly disclosure file: the part the live record never says.">
      {issued && wage ? (
        <>
          <p className="font-heading text-3xl font-bold sm:text-4xl">{wage}</p>{" "}
          <YearlyPayNote wage={d.wage} unit={d.wageUnit} />
        </>
      ) : (
        <p className="font-heading text-2xl font-bold">{d.status.charAt(0) + d.status.slice(1).toLowerCase()}</p>
      )}{" "}
      <RecordList
        className="mt-6"
        rows={[
          ...(d.socTitle || d.socCode
            ? [
                {
                  label: "Occupation DOL used",
                  value: (
                    <>
                      {d.socTitle ?? "Not given"}
                      {d.socCode ? <span className="font-mono text-sm font-normal text-muted-foreground"> · {d.socCode}</span> : null}
                    </>
                  ),
                },
              ]
            : []),
          ...(d.worksiteState ? [{ label: "Worksite state", value: d.worksiteState }] : []),
          { label: "Received by DOL", value: formatDay(d.receivedDate) ?? "Unknown" },
          { label: issued ? "Determination date" : "Decided", value: formatDay(d.decisionDate) ?? "Unknown" },
          ...(until ? [{ label: "Valid until", value: formatDay(until) }] : []),
        ]}
      />{" "}
      {until ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The PERM must be filed, or recruitment started, before the determination expires. Every date after it is
          arithmetic on this one; the{" "}
          <Link href="/tools/perm-deadline-calculator" className="link">
            deadline calculator
          </Link>{" "}
          works them out.
        </p>
      ) : null}
    </PageSection>
  );
}

export async function PwdLookup({ caseNumber }: { caseNumber: string }) {
  const [{ row, dolMiss }, disclosed, est, dayData] = await Promise.all([
    // A failure to read our own table is also "could not settle it", never "no record".
    lookupPwdCaseOutcome(caseNumber).catch(() => ({ row: null, dolMiss: "records" as const })),
    lookupPwdDetermination(caseNumber).catch(() => null),
    getPwdEstimatorData().catch(() => null),
    getPwdDayData().catch(() => null),
  ]);

  if (!row && disclosed) {
    // DOL's live endpoint has nothing (or did not answer) but the quarterly
    // file holds the decided record: show that, plainly labelled as the file.
    return (
      <div>
        <AnswerPanel
          verdict={ISSUED.test(disclosed.status.toUpperCase()) ? "Wage set" : "Decided"}
          direction={disclosed.status.toUpperCase() === "DENIED" ? "bad" : "good"}
          label={
            <>
              Wage request <span translate="no">{disclosed.caseNumber}</span>
            </>
          }
          source="From DOL's quarterly disclosure file, which lists decided requests only"
        >
          DOL decided this wage request:{" "}
          <b className="font-semibold" translate="no">
            {prettyStatus(disclosed.status)}
          </b>
          . Its live case system didn&apos;t return the number, so the record below is from the quarterly file.
        </AnswerPanel>
        <Determination d={disclosed} />
        <PageSection title="The record">
          <RecordList
            rows={[
              {
                label: "Employer",
                raw: true,
                value: disclosed.employerName ? (
                  <Link href={`/pwd-cases?q=${encodeURIComponent(disclosed.employerName)}`} className="link">
                    {disclosed.employerName}
                  </Link>
                ) : (
                  "Not given"
                ),
              },
              { label: "Job title", value: disclosed.jobTitle ?? "Not given", raw: !!disclosed.jobTitle },
            ]}
          />
        </PageSection>
      </div>
    );
  }

  if (!row && isLookupGap(dolMiss)) {
    return <DolUnanswered caseNumber={caseNumber} label="Prevailing wage request" miss={dolMiss} watch="pwd" />;
  }

  if (!row) {
    return (
      <AnswerPanel
        verdict="No record"
        direction="flat"
        label={
          <>
            Wage request <span translate="no">{caseNumber}</span>
          </>
        }
        actions={
          <div className="mt-6 border-t border-foreground/10 pt-6">
            <WatchThisNumber caseNumber={caseNumber} program="pwd" variant="inline" />
          </div>
        }
      >
        DOL&apos;s case system holds nothing under this number. It may be a typo, a filing from the last day, or a
        number from before DOL&apos;s current system. Check it on{" "}
        <a href="https://flag.dol.gov/case-status-search" className="link" rel="noopener">
          DOL&apos;s own case status page
        </a>
        , or find it by employer on the{" "}
        <Link href="/pwd-cases" className="link">
          wage request search
        </Link>
        .
      </AnswerPanel>
    );
  }

  const month = row.filingDate?.slice(0, 7) ?? null;
  const estimate =
    month && est && est.asOf && est.backlog.length > 0
      ? estimatePwdQueue({
          requestMonth: month,
          frontierMonth: est.frontier?.oewsMonth ?? null,
          backlog: est.backlog,
          asOf: est.asOf,
          clearancePerMonth: est.clearancePerMonth,
        })
      : null;
  const notPerm = row.visaType !== null && row.visaType.toUpperCase() !== "PERM";
  // THE DAY, for a PERM request still in line: the requests in process filed
  // before it over DOL's pace a working day, counted in the days DOL works
  // (estimatePwdDay). The month above stays the fallback when the count is
  // missing or stale.
  const dayEst =
    !notPerm && dayData && row.filingDate && row.status.trim().toUpperCase() === "IN PROCESS"
      ? estimatePwdDay({
          filingDate: row.filingDate.slice(0, 10),
          today: easternDay(),
          queue: dayData.queue,
          measuredRange: dayData.measuredRange,
        })
      : null;
  const dated = dayEst && dayEst.kind === "estimate" ? dayEst : null;

  const pending = !row.isFinal;
  const upper = row.status.toUpperCase();
  const issuedNow = ISSUED.test(upper);
  const filed = formatDay(row.submittedDate) ?? formatDay(row.filingDate);
  const oews = est?.frontier?.oewsMonth ?? null;

  return (
    <div>
      <AnswerPanel
        verdict={pending ? "Waiting" : issuedNow ? "Wage set" : "Decided"}
        direction={upper === "DENIED" ? "bad" : issuedNow ? "good" : "flat"}
        label={
          <>
            Wage request <span translate="no">{row.caseNumber}</span>
          </>
        }
        source={row.lastCheckedAt ? `DOL showed this status on ${formatDay(row.lastCheckedAt)}` : undefined}
        actions={
          pending ? (
            <AnswerNext
              caseNumber={row.caseNumber}
              program="pwd"
              dateLabel="Estimated determination"
              date={
                notPerm
                  ? null
                  : dated
                    ? `Around ${formatDay(dated.date)}`
                    : estimate?.estimatedMonth
                      ? formatMonth(estimate.estimatedMonth)
                      : null
              }
              note={
                !notPerm && (dated || estimate?.estimatedMonth) ? (
                  <a href="#wage-queue" className="link inline-flex min-h-11 items-center">
                    How this is worked out
                  </a>
                ) : null
              }
            />
          ) : undefined
        }
      >
        DOL&apos;s status for this wage request is{" "}
        <b className="font-semibold" translate="no">
          {prettyStatus(row.status)}
        </b>
        .{filed ? ` It was filed ${filed}.` : ""}
        {pending && !notPerm && oews
          ? ` DOL is working requests received in ${formatMonth(oews)} where the wage comes from the OEWS survey.`
          : ""}
      </AnswerPanel>

      {notPerm ? (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          DOL tags this request as {row.visaType}. The queue figures on this site cover PERM wage requests only, so
          none are shown for it.
        </p>
      ) : null}

      {disclosed ? <Determination d={disclosed} /> : null}

      {pending && !notPerm ? (
        <PageSection id="wage-queue" title="Where it sits in DOL's wage queue">
          {oews ? (
            <p className="max-w-2xl text-base leading-relaxed text-soft">
              As of {formatAsOf(est?.asOf ?? null) ?? est?.asOf}, DOL is working requests received in{" "}
              {formatMonth(oews)} where the wage comes from the OEWS survey
              {est?.frontier?.nonOewsMonth ? `, and ${formatMonth(est.frontier.nonOewsMonth)} where it doesn't` : ""}
              . A case record doesn&apos;t say which line this one is in.
            </p>
          ) : (
            <p className="text-base text-soft">
              DOL&apos;s current queue position didn&apos;t load. The{" "}
              <Link href="/tools/pwd-calculator" className="link">
                PWD queue calculator
              </Link>{" "}
              has it.
            </p>
          )}{" "}
          {estimate && month ? (
            <FigureRow className="mt-6">
              <Figure label={`Requests ahead of ${formatMonth(month)}`} value={formatInt(estimate.requestsAhead)} />
              <Figure label="Received the same month" value={formatInt(estimate.requestsSameMonth)} />
            </FigureRow>
          ) : null}{" "}
          {dated ? (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-soft">
              {dated.rangeFrom === "measured"
                ? "Going by how far recent determinations landed from their dates, between "
                : "If DOL keeps to its fastest or slowest recent week, between "}
              <b className="font-semibold text-foreground">{formatDay(dated.earliest)}</b> and{" "}
              <b className="font-semibold text-foreground">{formatDay(dated.latest)}</b>.{" "}
              {formatInt(dated.requestsAhead)} PERM wage requests filed before this one are still in process, and DOL
              has been finishing about {formatInt(Math.round(dated.pace))} on each day it works (weekdays that
              aren&apos;t federal holidays).
              {dayData?.tested
                ? ` Tested on ${formatInt(dayData.tested.decided)} requests DOL has since decided, the date was ${
                    dayData.tested.typicalMissDays === 0
                      ? "typically the day DOL decided them"
                      : `typically ${dayData.tested.typicalMissDays} ${dayData.tested.typicalMissDays === 1 ? "day" : "days"} off`
                  }${dayData.tested.within7Share !== null ? `, and ${sharePct(dayData.tested.within7Share)} were within a week` : ""}.`
                : ""}
            </p>
          ) : null}{" "}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An estimate only. It assumes DOL keeps clearing requests at its recent rate. The{" "}
            <Link href="/tools/pwd-calculator" className="link">
              PWD queue calculator
            </Link>{" "}
            shows the same figures for any month.
          </p>
        </PageSection>
      ) : null}

      <PageSection title="The record" lede="As DOL holds it.">
        <RecordList
          rows={[
            {
              label: "Employer",
              raw: true,
              value: row.employerName ? (
                <Link href={`/pwd-cases?q=${encodeURIComponent(row.employerName)}`} className="link">
                  {row.employerName}
                </Link>
              ) : (
                "Not given"
              ),
            },
            { label: "Job title", value: row.jobTitle ?? "Not given", raw: !!row.jobTitle },
            { label: "Case number", value: row.caseNumber, raw: true, mono: true },
            { label: "Filed with DOL", value: filed ?? "Unknown" },
            { label: "Last checked against DOL", value: formatDay(row.lastCheckedAt) ?? "Today" },
          ]}
        />
      </PageSection>

      {/* The broader signal: hear when DOL reaches this filing month. Same
          machinery as the calculator page's form, same PWD queues; the source
          tag says which page asked. */}
      {pending && !notPerm ? (
        <PageSection title="Or hear when DOL reaches this month" lede="One email when DOL's wage queue gets to your filing month.">
          <QueueAlertForm source="pwd-status" newestMonth={currentMonthUtc()} queue="pwd-oews" allowPwdChoice bare />
        </PageSection>
      ) : null}

      {row.isFinal && !disclosed ? (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The wage DOL set isn&apos;t in its live record. It arrives in the next quarterly disclosure file, which this
          page reads as soon as it lands.
        </p>
      ) : null}

      {row.isFinal ? (
        <PageSection title="What comes next">
          <p className="max-w-2xl text-base leading-relaxed text-soft">
            With the wage set, the employer recruits, then files the PERM. That gets its own G- case number. Once
            filed, the{" "}
            <Link href="/perm-cases" className="link">
              PERM case search
            </Link>{" "}
            finds it by employer, usually within a day.
          </p>
        </PageSection>
      ) : null}
    </div>
  );
}
