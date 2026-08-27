import Link from "next/link";
import { Fragment } from "react";
import { Warning } from "@phosphor-icons/react/ssr";

import { formatMonth } from "@/lib/dolFormat";
import { findFront, type CohortMonth } from "@/lib/liveQueue";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import { cn } from "@/lib/utils";

/**
 * Where DOL's queue actually stands, from a per-case scan.
 *
 * A server component: nothing here is interactive, so shipping a client
 * bundle for it would buy nothing. The per-cohort detail is a link, not a
 * disclosure, because a filing month is a thing a person arrives at from
 * search with their own month in mind.
 */

const int = (n: number) => n.toLocaleString("en-US");

export function LiveQueueBoard({ months }: { months: readonly CohortMonth[] }) {
  const front = findFront(months);
  const newest = months.length > 0 ? months[months.length - 1]!.month : null;

  return (
    <div className="border-2 border-border bg-card shadow-hard">
      {/* The provisional notice sits ABOVE every figure it qualifies, for the
          same reason a withheld statistic states its reason first: a number
          the reader has already absorbed cannot be un-absorbed by a footnote. */}
      {!MIRROR_COMPLETE ? (
        <p className="flex items-start gap-2 border-b-2 border-border bg-data-warn/8 px-6 py-4 text-base text-foreground/80 sm:px-8">
          <Warning
            className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>{PROVISIONAL_NOTICE}</span>
        </p>
      ) : null}

      <div className="border-b-2 border-border p-6 sm:p-8">
        {front ? (
          <>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              The queue is working
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-black leading-[1.05] sm:text-5xl">
              {formatMonth(front.month)}
            </p>{" "}
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
              The oldest filing month that is not substantially decided, which
              is {front.monthsBack}{" "}
              {front.monthsBack === 1 ? "month" : "months"} behind{" "}
              {formatMonth(newest)}, the newest month with filings.
              {front.decidedPct !== null ? (
                <> It is {front.decidedPct.toFixed(0)}% decided.</>
              ) : null}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {/* The big number first: this is what "how big is the wall"
                  means. The small one beside it is the movement. */}
              <div className="min-w-0 flex-1 basis-64 border-2 border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Still undecided
                </p>{" "}
                <p className="mt-1 font-heading text-4xl font-black leading-none tabular-nums">
                  {int(front.wallTotal)}
                </p>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  cases across every filing month, the whole wall
                </p>
              </div>
              <div className="min-w-0 flex-1 basis-64 border-2 border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  To clear this month
                </p>{" "}
                <p className="mt-1 font-heading text-4xl font-black leading-none tabular-nums">
                  {int(front.pendingToClear)}
                </p>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  undecided at or before {formatMonth(front.month)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-base text-foreground/70">
            No filing month is currently part-decided, so there is no work
            front to report. DOL&apos;s own published position is on the{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              processing times page
            </Link>
            .
          </p>
        )}
      </div>

      {months.length > 0 ? (
        <div className="p-6 sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            Every filing month
          </h2>{" "}
          <p className="mt-2 text-base text-foreground/70">
            Oldest first. The bar is the share of that month DOL has decided;
            the number beside it is what is still waiting.
          </p>

          <ol className="mt-6 space-y-1">
            {months.map((m) => {
              const pct = m.decidedPct ?? 0;
              const isFront = front !== null && m.month === front.month;
              const label = formatMonth(m.month) ?? m.month;
              return (
                // Fragment with an explicit space: mapped siblings arrive with
                // nothing between them and would read as one run of text.
                <Fragment key={m.month}>
                  {" "}
                  <li
                    className="grid grid-cols-[6.5rem_1fr_2.75rem_4rem] items-center gap-2 [&>*]:min-w-0 sm:grid-cols-[9.5rem_1fr_3.5rem_5rem] sm:gap-3"
                    aria-label={`${label}: ${pct.toFixed(0)}% decided, ${int(m.pending)} still pending`}
                  >
                    <Link
                      href={`/perm-queue/${m.month}`}
                      className={cn(
                        "truncate text-sm underline underline-offset-2 hover:text-primary",
                        isFront ? "font-black" : "text-foreground/70",
                      )}
                    >
                      {label}
                    </Link>{" "}
                    <span className="block h-6 w-full border-2 border-border bg-muted">
                      <span
                        className={cn(
                          "block h-full",
                          isFront ? "bg-primary" : "bg-foreground/70",
                        )}
                        style={{ width: `${Math.min(100, Math.max(pct, 0))}%` }}
                      />
                    </span>{" "}
                    <span
                      className={cn(
                        "text-right text-sm tabular-nums",
                        isFront ? "font-black" : "text-foreground/70",
                      )}
                    >
                      {pct.toFixed(0)}%
                    </span>{" "}
                    <span
                      className={cn(
                        "text-right text-sm tabular-nums",
                        isFront ? "font-black" : "text-foreground/70",
                      )}
                    >
                      {int(m.pending)}
                    </span>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
