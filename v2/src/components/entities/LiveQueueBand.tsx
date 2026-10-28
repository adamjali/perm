import { Fragment } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { statusMeaning } from "@/lib/caseStatusVocabulary";
import { caseStatusTint, type CaseStatusTint } from "@/lib/statusTone";
import type { EntityPending } from "@/lib/db/entityDetail";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { DAYS_PER_MONTH, MS_PER_DAY } from "@/lib/time";

/**
 * Each stage's rule in the soft chart colour of what the stage means (round 3,
 * Oct 15 2026: no black or grey in charts): the ordinary line yellow, held or
 * diverted blue, appeals and denials red, withdrawn purple, decided green.
 * Each rule carries a thin edge in its own hue's stronger shade, so the shape
 * reads on paper; the count and share beside it carry the figure.
 */
const STAGE_BAR: Record<CaseStatusTint, string> = {
  wait: "bg-chart-yellow border-data-warn",
  good: "bg-chart-green border-data-good-ink",
  withdrawn: "bg-chart-purple border-data-purple-ink",
  bad: "bg-chart-red border-data-bad",
  aside: "bg-chart-blue border-data-info",
  flat: "bg-chart-sage border-data-good-ink",
};

/**
 * Where one sponsor's cases are standing in the queue TODAY.
 *
 * The rest of an entity page is history: every row in DOL's disclosure files
 * carries a decision date, so a case still waiting appears in none of those
 * counts. This module is the only thing on the site that can answer "how many
 * of their cases are in the queue right now, and where", because it reads the
 * live per-case mirror instead.
 *
 * ## Why this is a census and not a pipeline
 *
 * The obvious drawing is a funnel: analyst review, then RFI, then decision.
 * DOL's stages do not run in that order. A case can go to audit without an
 * RFI, an appeal re-enters after a decision, and "application on hold" is not
 * a step at all. Numbering them, or drawing arrows between them, would encode
 * a sequence that is not there. So the stages are a CENSUS - one row each,
 * ordered by how many cases are standing in them - and the only ordering
 * claim the module makes is "biggest first", which is true.
 *
 * ## Why the two totals are not put side by side
 *
 * `pending` and the page's `filings` count come from different corpora with
 * different as-of dates, and a sponsor's pending count routinely exceeds its
 * lifetime filings because the mirror sees cases filed after the last
 * disclosure file was cut. Setting them in one row of stat cards would invite
 * a subtraction that means nothing. `tracked` is the mirror's own denominator
 * and is the only figure `pending` may be read against.
 */

/** Whole months between an ISO date and today, or null if unparseable. */
function monthsSince(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.now();
  if (then > now) return null;
  return Math.floor((now - then) / (MS_PER_DAY * DAYS_PER_MONTH));
}

function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
  );
}

export function LiveQueueBand({
  pending,
  subject,
  asOf,
  className,
}: {
  pending: EntityPending;
  /** What the page is about: "sponsor", "firm". */
  subject: string;
  /** As-of date of the live mirror, ISO. */
  asOf: string | null;
  className?: string;
}) {
  const { tracked, pending: waiting, stages, oldest } = pending;
  if (tracked <= 0) return null;

  const biggest = stages[0]?.n ?? 0;
  const months = oldest ? monthsSince(oldest) : null;
  const decided = Math.max(0, tracked - waiting);

  return (
    <FigurePlate
      title="In the queue right now"
      subject={`${formatInt(tracked)} cases in the live tracker`}
      caption={
        waiting > 0 ? (
          <>
            From DOL&apos;s live status of {formatInt(tracked)} of this {subject}&apos;s
            cases: read this share against {formatInt(tracked)}, never against the
            lifetime filings above.
          </>
        ) : (
          <>
            All {formatInt(tracked)} of this {subject}&apos;s cases in DOL&apos;s live
            status are decided: nothing of theirs is in the queue.
          </>
        )
      }
      source={asOf ? `Live case tracker, as of ${longDate(asOf)}` : "Live case tracker"}
      className={className}
    >
      {waiting > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8">
            <div>
              <p className="text-sm font-bold text-muted-foreground">
                Waiting on a decision
              </p>{" "}
              <p className="mt-1 font-heading text-5xl font-bold leading-none tabular-nums">
                {formatInt(waiting)}
              </p>{" "}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                of {formatInt(tracked)} tracked cases. The other {formatInt(decided)} have
                been decided.
              </p>
              {oldest ? (
                <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-soft">
                  The oldest one still waiting was filed{" "}
                  <span className="font-bold">{longDate(oldest)}</span>
                  {months != null && months >= 1 ? (
                    <>
                      , {formatInt(months)} month{months === 1 ? "" : "s"} ago
                    </>
                  ) : null}
                  .
                </p>
              ) : null}
            </div>

            <div>
              <p className="mb-3 border-b border-border/40 pb-1.5 text-sm font-bold text-muted-foreground">
                Where those {formatInt(waiting)} are standing
              </p>
              <ChartTips label={`Where those ${formatInt(waiting)} cases are standing`}>
              <dl className="space-y-4">
                {stages.map((s) => {
                  const meaning = statusMeaning(s.status);
                  const share = waiting > 0 ? (s.n / waiting) * 100 : 0;
                  return (
                    // Keyed Fragment with a leading space: array items render
                    // with NOTHING between them, so every stage name welded to
                    // the previous stage's percentage for any extractor walking
                    // the DOM. A whitespace-only node is not laid out as a grid
                    // or flex item, so it costs nothing visually.
                    <Fragment key={s.status}>{" "}
                    {/* One group per stage, as a <dl> allows: the name, its
                        count, and its rule and meaning as a second description. */}
                    <div
                      data-tip={`${s.status}\n${formatInt(s.n)} waiting\n${share >= 0.5 ? `${share.toFixed(0)}%` : "Under 1%"} of the ${formatInt(waiting)} waiting`}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    >
                      <dt className="text-sm font-bold">
                        {s.status}
                      </dt>{" "}
                      <dd className="font-mono text-sm font-bold tabular-nums">
                        {formatInt(s.n)}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {share >= 0.5 ? `${share.toFixed(0)}%` : "<1%"}
                        </span>
                      </dd>{" "}
                      <dd className="w-full">
                        {/* One rule per stage, and NO track behind it. The
                            rule is scaled against the BIGGEST stage rather
                            than the total, because with 96% of cases in one
                            stage every other rule would be too short to see;
                            the percentage beside the count carries the share. */}
                        <div
                          aria-hidden="true"
                          className={cn("mt-1.5 h-2 border", STAGE_BAR[caseStatusTint(s.status)])}
                          style={{
                            width: `${biggest > 0 ? Math.max(2, (s.n / biggest) * 100) : 0}%`,
                          }}
                        />
                        {meaning ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {meaning}
                          </p>
                        ) : null}
                      </dd>
                    </div>
                    </Fragment>
                  );
                })}
              </dl>
              </ChartTips>
            </div>
          </div>

          <p className="mt-6 border-t-2 border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            None of this changes one case&apos;s wait: DOL works one national
            line.{" "}
            <Link
              href="/perm-processing-times"
              className={cn(
                "font-bold link",
                "hover:text-primary",
              )}
            >
              Where DOL is working now
            </Link>{" "}
            is the figure that does.
          </p>
        </>
      ) : (
        <p className="max-w-2xl text-base leading-relaxed text-soft">
          Nothing for this {subject} is waiting on a decision. All{" "}
          {formatInt(tracked)} of their cases in the live tracker are closed.
        </p>
      )}
    </FigurePlate>
  );
}
