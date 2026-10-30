"use client";

/**
 * The DOL decision card at the foot of a saved case's Overview.
 *
 * One `detail-card`, shaped like every other card on the page: a head with
 * the title, DOL's live status and the per-case watch switch; a body with the
 * estimated day and its range beside a bar from filing to the decision
 * window; a footer with the line ahead drawn as one queue; and everything
 * about how it's worked out folded under "How this is worked out".
 *
 * Owner, Oct 30 2026: the first version sat under "Next up" as two full page
 * sections, 866 px tall on a 1,934 px Overview, louder than the case itself.
 * "Move this to the bottom ... compact, concise, visual."
 *
 * ## Where each figure comes from
 *
 * - **The estimate** is built from the case's OWN dates (the PWD request
 *   filing date, or the ETA-9089 filing date) by the SAME central estimators
 *   the public case page uses (`caseStepEstimate`), so the app and the public
 *   site can never name different days. A DOL case number is optional: it
 *   only adds the live status and sharpens the read.
 * - **DOL's live status** is the case's own `liveStatus` / `liveStatusSeenAt`,
 *   written by the 5-minute watch. It never overwrites the firm's own stage.
 * - **The line ahead** is `lineAheadByMonth`, which splits the same count the
 *   date is built from, so the bar can't add up to a different figure.
 *
 * A range is labelled for what it is: a measured spread and a pace scenario
 * are different claims (see `CaseEstimate.modelId`). Every figure is dated and
 * called an estimate; nothing reads as a promise on a case being managed.
 *
 * @module
 */

import { Fragment, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { HourglassMediumIcon } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Switch } from "@/components/ui/switch";
import { ChartTips } from "@/components/data/ChartTips";
import { FinePrint } from "@/components/data/FinePrint";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { daysBetween, easternDay } from "@/lib/time";
import { useCaseCorpus } from "@/components/app/CaseCorpusProvider";
import { caseStepEstimate } from "@/lib/caseStepEstimate";
import type { CaseEstimate } from "@/lib/caseEstimate";
import type { LineAheadRow } from "@/lib/queueAhead";
import { CaseNumberSuggestion } from "./CaseNumberSuggestion";
import { canonicalStatus } from "@/lib/caseStatusVocabulary";

export interface CaseEstimateSectionCase {
  _id: Id<"cases">;
  caseNumber?: string | null;
  caseStatus?: string | null;
  employerName?: string | null;
  liveStatus?: string | null;
  liveStatusSeenAt?: number | null;
  liveStatusIsFinal?: boolean | null;
  watchEnabled?: boolean | null;
  // The dates and per-step numbers the estimate reads, so it works without a
  // DOL case number.
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdCaseNumber?: string | null;
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089DenialDate?: string | null;
  eta9089CaseNumber?: string | null;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** "Dec 3, 2026" for a full date, "Dec 3" when the year is understood. */
function day(iso: string, withYear = true): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

const int = (n: number) => Math.round(n).toLocaleString("en-US");

/** A label's anchor on a bar: centred on its spot, unless that runs off an end. */
function anchor(pct: number): string {
  if (pct < 15) return "translate-x-0";
  if (pct > 85) return "-translate-x-full";
  return "-translate-x-1/2";
}

/**
 * What the range means, in a few words, per model. The public panel says the
 * same in a full sentence (`ESTIMATE_PANEL.en.window`); a scenario must never
 * read as a measured spread.
 */
function rangeCaption(est: Extract<CaseEstimate, { kind: "date" }>): string {
  switch (est.modelId) {
    case "decision-pace":
      return est.rangeFrom === "measured" ? "where recent decisions landed" : "if DOL keeps its recent pace";
    case "queue-advance":
      return "fastest to slowest queue movement";
    case "rfi-clock":
      return "going by how RFIs have gone";
    case "stragglers":
      return "8 in 10 cases behind the queue";
    default:
      return "";
  }
}

/** The employer, filing date and program to look a missing DOL number up by, or null. */
function suggestionParams(
  c: CaseEstimateSectionCase,
): { employerName: string; filingDate: string; program: "perm" | "pwd" } | null {
  const employer = c.employerName?.trim();
  if (!employer) return null;
  const perm = c.eta9089FilingDate?.trim();
  if (perm) return { employerName: employer, filingDate: perm, program: "perm" };
  const pwd = c.pwdFilingDate?.trim();
  if (pwd) return { employerName: employer, filingDate: pwd, program: "pwd" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** The per-case DOL watch switch. Absent `watchEnabled` means on. */
function WatchToggle({ caseId, enabled }: { caseId: Id<"cases">; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const setWatch = useMutation(api.cases.setWatchEnabled);
  const id = `watch-${caseId}`;
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        Watch DOL
      </label>{" "}
      <Switch
        id={id}
        checked={on}
        disabled={busy}
        onCheckedChange={async (next) => {
          setOn(next);
          setBusy(true);
          try {
            await setWatch({ id: caseId, enabled: next });
          } catch {
            setOn(!next); // roll back on failure
            toast.error("Couldn't change the watch. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

/** The share of the bar the time already gone takes, whatever its length. */
const PAST_SHARE = 32;

/** "9 months", "6 weeks", "12 days": how long a case has waited, said the way people say it. */
function waited(days: number): string {
  if (days >= 60) return `${Math.round(days / 30.44)} months`;
  if (days >= 21) return `${Math.round(days / 7)} weeks`;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Filing to decision on one bar, with the news drawn to scale.
 *
 * A single linear scale from filing spent nine months of width on the past and
 * left the next three weeks a sliver (owner's phone, Oct 30 2026). So the time
 * already gone takes a fixed third, soft and labelled with how long it was,
 * and everything from today to the window is to scale, a faint tick a week.
 * The window is a lime band with ink edges (lime alone is 2.05:1 on white; the
 * edges and the ink estimate tick carry the 3:1), and "Today" is the ink line
 * where the two parts meet.
 */
function DecisionBar({
  filed,
  date,
  earliest,
  latest,
  today,
}: {
  filed: string;
  date: string;
  earliest: string | null;
  latest: string | null;
  today: string;
}) {
  const end = latest && latest > date ? latest : date;
  const ahead = Math.max(7, daysBetween(today, end));
  const span = ahead + Math.max(2, Math.round(ahead * 0.12));
  const gone = Math.max(0, daysBetween(filed, today));
  const past = gone > 0 ? PAST_SHARE : 0;
  const at = (iso: string) => past + (100 - past) * Math.min(1, Math.max(0, daysBetween(today, iso) / span));
  const lo = at(earliest ?? date);
  const hi = at(latest ?? date);
  const weeks: number[] = [];
  for (let d = 7; d < span; d += 7) weeks.push(past + (100 - past) * (d / span));
  const toGo = daysBetween(today, date);

  return (
    <figure className="@container min-w-0" aria-label={`Filed ${day(filed)}, ${waited(gone)} ago; estimated around ${day(date)}`}>
      <div aria-hidden="true" className="relative h-5">
        <span
          className={cn("absolute bottom-0 whitespace-nowrap text-sm font-bold", past ? "-translate-x-1/2" : "translate-x-0")}
          style={{ left: `${past}%` }}
        >
          Today
        </span>
      </div>{" "}
      <div aria-hidden="true" className="relative mt-1 h-8 border border-input bg-card">
        {past ? (
          <div
            className="absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden bg-foreground/15 px-1 text-sm text-muted-foreground"
            style={{ width: `${past}%` }}
          >
            <span className="hidden truncate whitespace-nowrap @md:inline">{waited(gone)} so far</span>
          </div>
        ) : null}
        {weeks.map((w) => (
          <span key={w} className="absolute bottom-0 h-2 w-px bg-foreground/30" style={{ left: `${w}%` }} />
        ))}
        <div
          className="absolute inset-y-0 border-x-2 border-foreground bg-primary"
          style={{ left: `${lo}%`, width: `${Math.max(1.5, hi - lo)}%` }}
        />
        <span
          className="absolute -bottom-1.5 -top-1.5 w-1 -translate-x-1/2 bg-foreground"
          style={{ left: `${at(date)}%` }}
        />
        <span
          className="absolute -top-2 h-[calc(100%+1rem)] w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${past}%` }}
        />
      </div>{" "}
      {/* Each phrase stays whole: on a phone the second drops to its own line, right-aligned. */}
      <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
        <span className="whitespace-nowrap">
          Filed {day(filed)}
          <span className="@md:hidden">, {waited(gone)} ago</span>
        </span>{" "}
        <span className="ml-auto whitespace-nowrap text-right">
          {toGo > 0 ? (
            <>
              about <b className="font-semibold text-foreground tabular-nums">{int(toGo)}</b>{" "}
              {toGo === 1 ? "day" : "days"} to go
            </>
          ) : (
            "any day now"
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/** The date, its range and what the range means, set as the card's lead figure. */
function DateLead({ date, earliest, latest, caption }: { date: string; earliest: string | null; latest: string | null; caption: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">Around</p>{" "}
      <p className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">{day(date)}</p>{" "}
      {earliest && latest ? (
        <>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {day(earliest, earliest.slice(0, 4) !== latest.slice(0, 4))} to {day(latest)}
          </p>{" "}
          {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * The line ahead as one queue: the front of the line on the left (the oldest
 * months, decided first) and the reader's own month, lime, at the right end.
 * Each filing month is a segment as wide as its count; the per-month list is
 * in the fold for anyone who wants the figures.
 */
function QueueBar({ rows, perDay }: { rows: readonly LineAheadRow[]; perDay: number | null }) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (total <= 0) return null;
  const own = rows.find((r) => r.own);
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">
          <b className="font-heading text-xl font-bold text-foreground tabular-nums">{int(total)}</b>{" "}
          cases ahead of yours in line
        </p>{" "}
        {perDay && perDay > 0 ? (
          <p className="text-sm text-muted-foreground">
            DOL decides about <b className="font-semibold text-foreground tabular-nums">{int(perDay)}</b> a day
          </p>
        ) : null}
      </div>{" "}
      <ChartTips label="Cases ahead of yours in DOL's line, by filing month" className="mt-3 @container">
        <div className="flex h-9 border border-input bg-card">
          {rows.map((r) => {
            const share = r.n / total;
            return (
              <Fragment key={r.key}>
                {" "}
                <span
                  data-tip={`${r.label}${r.own ? ", your month, filed before you" : ""}\n${int(r.n)} still in line`}
                  className={cn(
                    "flex h-full min-w-0 items-center overflow-hidden border-r border-foreground/50 px-2 text-sm text-black last:border-r-0",
                    r.own ? "bg-primary" : "bg-chart-green",
                  )}
                  style={{ width: `${share * 100}%`, minWidth: r.n > 0 ? 3 : 0 }}
                >
                  {/* Named in place when there is room; the tip and the fold carry the rest. */}
                  {share >= 0.16 ? (
                    <span className="truncate whitespace-nowrap">
                      <b className="font-semibold">{r.label}</b>{" "}
                      <span className="hidden tabular-nums @lg:inline">{int(r.n)}</span>
                    </span>
                  ) : null}
                </span>
              </Fragment>
            );
          })}
        </div>
      </ChartTips>{" "}
      <div className="mt-1.5 flex justify-between gap-3 text-sm text-muted-foreground">
        <span>Front of the line</span>{" "}
        <span className="text-right">{own ? `Your month, ${own.label}` : "Behind these"}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

export function CaseEstimateSection({ caseData }: { caseData: CaseEstimateSectionCase }) {
  const corpus = useCaseCorpus();
  const today = easternDay();

  const watched = caseData.caseNumber?.trim() || null;
  const watchOff = caseData.watchEnabled === false;
  const live = watched && caseData.liveStatus ? canonicalStatus(caseData.liveStatus) : null;
  const seen =
    typeof caseData.liveStatusSeenAt === "number" ? day(easternDay(caseData.liveStatusSeenAt), false) : null;

  const result = caseStepEstimate({
    corpus,
    caseStatus: caseData.caseStatus,
    caseNumber: watched,
    pwdCaseNumber: caseData.pwdCaseNumber,
    eta9089CaseNumber: caseData.eta9089CaseNumber,
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089DenialDate: caseData.eta9089DenialDate,
    liveStatus: caseData.liveStatus,
    liveStatusIsFinal: caseData.liveStatusIsFinal,
    rfiEnteredOn: null, // the client has no per-case server read; the stage reading covers it
    today,
  });

  // With no DOL number, offer to find it from the employer + filing date.
  const suggest = !watched ? suggestionParams(caseData) : null;

  // Nothing to watch, estimate, or suggest: render nothing.
  if (!watched && result.step === null && !suggest) return null;

  const est = result.step === "perm" ? result.perm.estimate : null;
  const pwd = result.step === "pwd" ? result.pwd : null;
  const lineAhead =
    result.step === "perm" && live === "ANALYST REVIEW" && result.perm.lineAhead && result.perm.lineAhead.length > 0
      ? result.perm.lineAhead
      : null;
  const perDay = corpus?.decisionPace?.pace ?? null;

  const title = pwd
    ? "When the wage determination could come"
    : est
      ? "When DOL could decide"
      : "DOL’s record";

  return (
    <section aria-label="DOL decision estimate" className="detail-card">
      <div className={cn("detail-card-head", pwd ? "ch-pwd" : "ch-eta")}>
        <h2 className="flex items-start gap-1.5">
          <HourglassMediumIcon className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {title}
        </h2>{" "}
        {watched ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body text-sm font-normal">
            <span className="text-muted-foreground">
              {live ? (
                <>
                  <span className="head-badge">
                    DOL:{" "}
                    <b className="font-semibold text-foreground">{live}</b>
                  </span>
                  {seen ? <> seen {seen}</> : null}
                </>
              ) : watchOff ? (
                "Watch is off for this case."
              ) : (
                "Not seen on DOL yet. We check on weekdays."
              )}
            </span>{" "}
            <WatchToggle caseId={caseData._id} enabled={!watchOff} />
          </div>
        ) : null}
      </div>

      {suggest ? (
        <div className="px-5 pt-4">
          <CaseNumberSuggestion
            caseId={caseData._id}
            employerName={suggest.employerName}
            filingDate={suggest.filingDate}
            program={suggest.program}
          />
        </div>
      ) : null}

      {est && est.kind === "date" && result.step === "perm" ? (
        <div className="grid grid-cols-1 items-end gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] [&>*]:min-w-0">
          <DateLead
            date={est.estimatedDate}
            earliest={est.earliestDate}
            latest={est.latestDate}
            caption={rangeCaption(est)}
          />{" "}
          <DecisionBar
            filed={result.filingDate}
            date={est.estimatedDate}
            earliest={est.earliestDate}
            latest={est.latestDate}
            today={today}
          />
        </div>
      ) : null}

      {est && est.kind === "no-date" ? (
        <div className="space-y-2 px-5 py-4 text-sm">
          <p className="text-base">{est.note}</p>{" "}
          <p className="text-muted-foreground">
            {est.age.of === "stage" ? "Cases at this stage have been pending a measured average of " : "This case has been pending "}
            <b className="font-semibold text-foreground tabular-nums">{int(est.age.days)} days</b>
            {est.age.of === "stage" ? " since filing." : " since it was filed."}
          </p>{" "}
          {est.nextStep ? (
            <p className="text-muted-foreground">
              Of the {int(est.nextStep.observed)} cases we&rsquo;ve watched leave this stage,{" "}
              <b className="font-semibold text-foreground">{Math.round(est.nextStep.share * 100)}%</b>{" "}
              went to {est.nextStep.to.toLowerCase()}.
            </p>
          ) : null}
        </div>
      ) : null}

      {pwd ? (
        <div className="grid grid-cols-1 items-end gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] [&>*]:min-w-0">
          <DateLead
            date={pwd.date}
            earliest={pwd.earliest}
            latest={pwd.latest}
            caption={pwd.rangeFrom === "measured" ? "where recent determinations landed" : "if DOL keeps its recent pace"}
          />{" "}
          <DecisionBar
            filed={result.step === "pwd" ? result.filingDate : today}
            date={pwd.date}
            earliest={pwd.earliest}
            latest={pwd.latest}
            today={today}
          />
        </div>
      ) : null}

      {lineAhead ? <QueueBar rows={lineAhead} perDay={perDay} /> : null}

      {pwd ? (
        <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          <b className="font-heading text-xl font-bold text-foreground tabular-nums">{int(pwd.requestsAhead)}</b>{" "}
          wage requests filed earlier are still in line. DOL finishes about{" "}
          <b className="font-semibold text-foreground tabular-nums">{int(pwd.pace)}</b> a working day.
        </div>
      ) : null}

      {est || pwd ? (
        <div className="border-t border-border px-5 py-3">
          <FinePrint summary="How this is worked out">
            {est && est.kind === "date" ? (
              <>
                <p>
                  {est.modelLabel}: {est.basis} Source: {est.source}
                </p>{" "}
                <p>{est.totalDays.toLocaleString("en-US")} days from filing. An estimate, not a promise.</p>{" "}
                {est.stage ? (
                  <p>
                    {est.stage.note} Adjusted for the case&rsquo;s stage: the {est.stage.percentile}th percentile of its
                    filing month.
                  </p>
                ) : null}{" "}
                {est.caveats.map((c) => (
                  <Fragment key={c}>
                    {" "}
                    <p>{c}</p>
                  </Fragment>
                ))}
              </>
            ) : null}{" "}
            {pwd ? (
              <p>
                The day DOL is expected to reach this request, counting the wage requests filed before it and DOL&rsquo;s
                measured pace on its working days. An estimate, not a promise.
              </p>
            ) : null}{" "}
            {lineAhead ? (
              <>
                <ul className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-0.5 tabular-nums">
                  {lineAhead.map((r) => (
                    <Fragment key={r.key}>
                      {" "}
                      <li className="contents">
                        <span className={r.own ? "font-semibold text-foreground" : undefined}>{r.label}</span>{" "}
                        <span className="text-right">{int(r.n)}</span>
                      </li>
                    </Fragment>
                  ))}
                </ul>{" "}
                <p>
                  {lineAhead.some((r) => r.own) ? "Your own month counts only the days before yours. " : ""}
                  Cases on hold, at an RFI or on appeal aren&rsquo;t in the line and aren&rsquo;t counted.
                </p>
              </>
            ) : null}{" "}
            <p>
              Every model and its spread is on <Link href="/tools/perm-timeline-calculator">the timeline calculator</Link>
              , and how each is computed on <Link href="/methodology">the methodology page</Link>.
            </p>
          </FinePrint>
        </div>
      ) : null}
    </section>
  );
}
