import { Fragment } from "react";
import Link from "next/link";

import type { ReviewStage, StageRecord } from "@/lib/turso/rfi";
import { GROUP_STYLE, stageMeta, type StageGroup } from "./stageMeta";

/**
 * How many cases sit at each stage right now.
 *
 * SET IN TYPE, NOT IN BARS, AND THAT IS THE POINT. The counts run from 94,432
 * down to 1. On a linear scale everything below the analyst-review bar is a
 * hairline; on a log scale a general reader is being asked to decode an axis
 * to learn that four cases is a small number. Printing the figures at one size
 * gives the one-case stage exactly as much presence as the 94,000-case stage,
 * which is what a census of rare things has to do. A bar would encode a
 * magnitude the reader can already read off the number.
 *
 * Grouped by what the stage means, because the reader's real question is
 * "which of these am I in" and the answer is a group before it is a row.
 */

const ORDER: StageGroup[] = ["queue", "review", "appeal"];

export function StageCensus({
  stages,
  smallRecords,
  smallMax,
}: {
  stages: ReviewStage[];
  smallRecords: StageRecord[];
  smallMax: number;
}) {
  const total = stages.reduce((n, s) => n + s.cases, 0);
  const byGroup = ORDER.map((group) => ({
    group,
    stages: stages.filter((s) => stageMeta(s.status).group === group),
  })).filter((g) => g.stages.length > 0);

  return (
    <div className="grid gap-6">
      {byGroup.map(({ group, stages: inGroup }) => {
        const style = GROUP_STYLE[group];
        const n = inGroup.reduce((a, s) => a + s.cases, 0);
        return (
          <Fragment key={group}>{" "}
          <section className="border-2 border-border bg-card">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-border px-4 py-3">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 border-2 border-border"
                style={{ backgroundColor: style.fill }}
                aria-hidden="true"
              />{" "}
              <h3 className="font-heading text-base font-black">
                {style.name}
              </h3>{" "}
              <span className="ml-auto font-mono text-sm font-bold tabular-nums">
                {n.toLocaleString()}
              </span>{" "}
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {pct(n, total)} of pending
              </span>
            </header>
            <ul>
              {inGroup.map((s) => (
                <Fragment key={s.status}>{" "}
                <StageRow
                  stage={s}
                  total={total}
                  smallMax={smallMax}
                  records={smallRecords.filter((r) => r.status === s.status)}
                />
                </Fragment>
              ))}
            </ul>
          </section>
          </Fragment>
        );
      })}
    </div>
  );
}

function StageRow({
  stage,
  total,
  smallMax,
  records,
}: {
  stage: ReviewStage;
  total: number;
  smallMax: number;
  records: StageRecord[];
}) {
  const meta = stageMeta(stage.status);
  const dominant =
    stage.cases >= smallMax &&
    stage.topEmployer !== null &&
    stage.topEmployerCases / stage.cases >= 0.2
      ? stage
      : null;

  return (
    <li className="border-b border-border/30 px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-heading text-sm font-bold">{meta.label}</h4>{" "}
        <span className="ml-auto font-mono text-lg font-bold tabular-nums">
          {stage.cases.toLocaleString()}
        </span>{" "}
        <span className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {pct(stage.cases, total)}
        </span>
      </div>{" "}

      <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        {stage.employerNames.toLocaleString()}{" "}
        {stage.employerNames === 1 ? "employer name" : "distinct employer names"}
        {stage.seenTo ? <> · checked {fmtDate(stage.seenFrom, stage.seenTo)}</> : null}
      </p>{" "}

      {/*
        CONCENTRATION IS PART OF THE COUNT, NOT A FOOTNOTE. "1,789 applications
        on hold" reads as a thing happening across the programme. 1,768 of them
        are one employer, and a reader who does not know that has been told
        something false by a true number.
      */}
      {dominant ? (
        <p className="mt-2 border-l-2 border-border bg-secondary px-3 py-2 text-sm">
          <b className="font-bold">
            {dominant.topEmployerCases.toLocaleString()} of these (
            {pct(dominant.topEmployerCases, dominant.cases)})
          </b>{" "}
          are filed by {dominant.topEmployer}.
        </p>
      ) : null}{" "}

      {records.length > 0 ? (
        <div className="mt-2 border-l-2 border-border bg-secondary px-3 py-2">
          <p className="text-sm">
            At this size one record moves the number, so here is every case
            rather than a statistic about them.
          </p>
          <ul className="mt-1.5 grid gap-0.5">
            {records.map((r, i) => (
              <Fragment key={`${r.employer ?? "?"}-${r.jobTitle ?? "?"}-${i}`}>{" "}
              <li className="font-mono text-[11px] text-muted-foreground">
                {r.employer ?? "No employer name"}
                {", "}
                {r.jobTitle ?? "no job title"}
                {r.filingMonth ? <> · filed {r.filingMonth}</> : null}
              </li>
              </Fragment>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * A share, floored at the smallest figure that is still true.
 *
 * `toFixed(1)` turns four cases in 97,647 into "0.0%", which reads as none.
 * Anything under a twentieth of a percent gets "under 0.1%" instead, because
 * a rare stage rounding to zero on a page about rare stages is the failure
 * this whole component is arranged to avoid.
 */
function pct(n: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (n / total) * 100;
  if (p > 0 && p < 0.05) return "under 0.1%";
  return `${p >= 10 ? p.toFixed(0) : p.toFixed(1)}%`;
}

/** One date, or a range when the stage was not all read on one day. */
function fmtDate(from: string | null, to: string | null): string {
  if (!to) return "date unknown";
  if (!from || from === to) return short(to);
  return `${short(from)} to ${short(to)}`;
}

function short(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/**
 * The counts feed the rest of the site, so the census links back out.
 *
 * Kept in this file rather than the page because the destinations follow from
 * the census rows: an employer named here has a page, and the queue the
 * analyst-review count belongs to has one too.
 */
export function CensusLinks() {
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      The 94,000-case analyst-review queue is broken down by filing month on{" "}
      <Link href="/perm-queue" className="font-bold text-primary underline">
        the queue page
      </Link>
      , and the employers behind these filings have their own pages under{" "}
      <Link href="/perm-employers" className="font-bold text-primary underline">
        employers
      </Link>
      .
    </p>
  );
}
