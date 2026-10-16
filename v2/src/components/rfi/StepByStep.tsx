import { Fragment, type ReactNode } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatAsOf } from "@/lib/dolFormat";
import type { RfiClock } from "@/lib/perm";
import { stageDurationFor, type StageStats } from "@/lib/db/stageStats";
import {
  MOVE_FILL,
  moveLabel,
  movesFrom,
  parseRfiPath,
  reconsiderationOutcome,
  sumOutcomes,
  type MoveRow,
} from "@/lib/stageMoves";
import { cn } from "@/lib/utils";

/**
 * What happens next at each step, from our own sweep of every PERM case: the
 * RFIs it watched DOL issue (how many are still open, how long the reply takes,
 * how long the decision takes after it, how the decided ones ended) and, for
 * every review stage, where its cases went next.
 *
 * Built Oct 16 2026 so the page answers what a competitor answers for RFIs,
 * from a sweep of every case rather than a watch list, and for every stage
 * rather than the RFI alone. Each figure names its count and window.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;
const int = (n: number) => n.toLocaleString("en-US");

/** The stages a case can be diverted into, in the order the process runs. */
const STEPS: ReadonlyArray<{ status: string; title: string }> = [
  { status: "RFI ISSUED", title: "After an RFI" },
  { status: "APPLICATION ON HOLD", title: "After a hold" },
  { status: "DENIED", title: "After a denial" },
  { status: "RECONSIDERATION APPEALS", title: "After a motion to reconsider" },
  { status: "NORD ISSUED", title: "After a NORD" },
  { status: "REQUEST FOR REVIEW", title: "After a request for review" },
  { status: "BALCA APPEALS", title: "After a BALCA appeal" },
];

function Figure({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col border-2 border-border bg-card p-4 shadow-hard-sm sm:p-5">
      <p className="text-sm font-semibold">{label}</p>{" "}
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{value}</p>{" "}
      {children ? <div className="mt-2 text-sm leading-relaxed text-soft">{children}</div> : null}
    </div>
  );
}

/** One stacked bar of destinations, a mark per destination with its tooltip. */
function MoveBar({ rows, label }: { rows: MoveRow[]; label: string }) {
  return (
    <ChartTips label={label}>
      <div className="flex h-7 w-full overflow-hidden border-2 border-border" role="img" aria-label={label}>
        {rows.map((r) => (
          <span
            key={r.to}
            className={cn("h-full border-r border-foreground/30 last:border-r-0", MOVE_FILL[r.tone])}
            style={{ width: `${r.share * 100}%` }}
            data-tip={`${r.label}\n${int(r.n)} cases, ${pct(r.share)}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </ChartTips>
  );
}

function MoveKey({ rows }: { rows: MoveRow[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {rows.map((r) => (
        <Fragment key={r.to}>
          {" "}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-3 shrink-0 border border-foreground/40", MOVE_FILL[r.tone])} />
            <span>
              {r.label} <b className="font-bold tabular-nums">{pct(r.share)}</b>{" "}
              <span className="text-muted-foreground tabular-nums">({int(r.n)})</span>
            </span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

export function RfiJourney({ stats, clock }: { stats: StageStats | null; clock: RfiClock | null }) {
  const path = parseRfiPath(stats?.rfiPath);
  const decided = path ? sumOutcomes(path.decided) : 0;
  const afterReply = path ? sumOutcomes(path.afterReply) : 0;
  if (!path && !clock) return null;
  const outcomeRows: MoveRow[] = path && decided > 0
    ? (
        [
          ["CERTIFIED", path.decided.certified],
          ["WITHDRAWN", path.decided.withdrawn],
          ["DENIED", path.decided.denied],
          ["OTHER", path.decided.other],
        ] as const
      )
        .filter(([, n]) => n > 0)
        .map(([to, n]) => ({
          to,
          label: to === "OTHER" ? "Decided another way" : moveLabel(to),
          n,
          share: n / decided,
          tone: to === "CERTIFIED" ? "good" : to === "WITHDRAWN" ? "withdrawn" : to === "DENIED" ? "bad" : "other",
        }))
    : [];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        {path ? (
          <Figure label="RFIs we watched DOL issue" value={int(path.entered)}>
            {int(path.inRfi)} waiting on the reply, {int(path.repliedWaiting)} replied and back in review,{" "}
            {int(decided)} decided.
          </Figure>
        ) : null}{" "}
        {clock ? (
          <Figure label="Time to reply" value={`${clock.leaveDays.p50} days`}>
            Half of the RFIs left RFI status by day {clock.leaveDays.p50}: DOL gives the employer 30 days to answer.
          </Figure>
        ) : null}{" "}
        {clock ? (
          <Figure label="Once the reply is in" value={`${clock.afterLeaveDays.p50} days`}>
            Half were decided within {clock.afterLeaveDays.p50} days of going back to review
            {clock.afterLeaveDays.p75 !== null ? `, 3 in 4 within ${clock.afterLeaveDays.p75}` : ""}
            {clock.afterLeaveWatched ? `, over ${int(clock.afterLeaveWatched)} decided cases` : ""}.
          </Figure>
        ) : null}{" "}
        {path && afterReply > 0 ? (
          <Figure label="Certified after a reply" value={pct(path.afterReply.certified / afterReply)}>
            {int(path.afterReply.certified)} of the {int(afterReply)} decided after a reply so far.
          </Figure>
        ) : null}
      </div>{" "}
      {outcomeRows.length > 0 ? (
        <div className="mt-6">
          <p className="text-base font-semibold">How the {int(decided)} decided RFIs ended</p>{" "}
          <div className="mt-2">
            <MoveBar rows={outcomeRows} label={`How ${int(decided)} decided RFIs ended`} />
            <MoveKey rows={outcomeRows} />
          </div>
        </div>
      ) : null}{" "}
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {path ? (
          <>
            Decided so far, out of RFIs our sweep of every PERM case saw DOL issue
            {path.since ? ` since ${formatAsOf(path.since)}` : ""}. The slow cases are still open and some of them
            will be denied, so these shares will move.
          </>
        ) : (
          <>Measured over the RFIs our sweep of every PERM case saw DOL issue{clock ? ` since ${formatAsOf(clock.watchedFrom)}` : ""}.</>
        )}{" "}
        A case already at an RFI when our record began is left out: its start isn&apos;t known.
      </p>
    </div>
  );
}

export function StageMoves({ stats, since }: { stats: StageStats | null; since: string | null }) {
  const exits = stats?.exits ?? [];
  // The RFI's stay is the "Time to reply" figure above, from the RFI clock; a
  // second reading of it here, rounded differently, would print 30 beside 31.
  const rows = STEPS.map((s) => ({
    ...s,
    moves: movesFrom(exits, s.status),
    dwell: s.status === "RFI ISSUED" ? null : stageDurationFor(stats, s.status),
  }))
    .filter((s) => s.moves !== null);
  if (rows.length === 0) return null;
  const recon = reconsiderationOutcome(exits);

  return (
    <div>
      {recon ? (
        <p className="max-w-3xl text-base leading-relaxed">
          <b className="font-bold">
            {pct(recon.grantedShare)} of decided motions to reconsider were granted
          </b>{" "}
          ({int(recon.granted)} of {int(recon.decided)}): certified outright, or sent back for review. The other{" "}
          {int(recon.refused)} were refused with a NORD or a denial.
        </p>
      ) : null}{" "}
      <ol className="mt-5 divide-y-2 divide-border border-2 border-border bg-card">
        {rows.map((s) => (
          <Fragment key={s.status}>
            {" "}
            <li className="p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-heading text-lg font-bold">{s.title}</h3>{" "}
                <p className="text-sm text-muted-foreground">
                  {int(s.moves!.total)} moves seen
                  {s.dwell ? `, typically ${s.dwell.p50} days at this step` : ""}
                </p>
              </div>{" "}
              <div className="mt-3">
                <MoveBar rows={s.moves!.rows} label={`${s.title}: where ${int(s.moves!.total)} cases went next`} />
                <MoveKey rows={s.moves!.rows} />
              </div>
            </li>
          </Fragment>
        ))}
      </ol>{" "}
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Every status change our sweep has seen{since ? ` since ${formatAsOf(since)}` : ""}, from DOL&apos;s case-status
        service, for every PERM case. A move is counted whether or not we saw the case arrive at the step, so this
        says where cases go, not how long they stay; the typical stay is shown only where we watched enough cases
        arrive.
      </p>
    </div>
  );
}
