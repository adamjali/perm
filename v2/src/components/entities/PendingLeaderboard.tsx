import { Fragment } from "react";
import Link from "next/link";

import { FigurePlate } from "@/components/tools/FigurePlate";
import type { PendingLeader } from "@/lib/turso/entityDetail";

/**
 * Who has the most cases waiting on DOL right now.
 *
 * This is not the ranking above it and it is not meant to agree with it. The
 * volume ranking is a decade of decided filings; this is a photograph of one
 * morning. They disagree hard: Stoughton Trailers, a trailer manufacturer in
 * Wisconsin, is 1,207 cases deep in the queue and appears nowhere near the
 * top of any lifetime volume list.
 *
 * It exists because DOL's disclosure files cannot produce it. Every row in
 * them carries a decision date, so a pending case is absent from all of them.
 * The only source that knows is the live per-case tracker.
 *
 * ## The share is shown, and it is the interesting number
 *
 * "1,768 pending" is a size. "1,768 of 1,769 tracked" is a story: everything
 * that sponsor has filed is still in the queue, which means they arrived
 * recently and all at once. Beside it, "1,207 of 3,188" is a sponsor that has
 * been filing steadily for years. The count alone cannot tell those apart, so
 * the denominator is never dropped.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
  );
}

export function PendingLeaderboard({
  leaders,
  asOf,
  n = "02",
  className,
}: {
  leaders: PendingLeader[];
  asOf: string | null;
  n?: string;
  className?: string;
}) {
  if (leaders.length === 0) return null;
  const max = Math.max(1, ...leaders.map((l) => l.pending));
  const when = longDate(asOf);

  return (
    <FigurePlate
      n={n}
      title="Most cases waiting right now"
      subject={`${fmt(leaders.length)} sponsors, live tracker`}
      caption={
        <>
          A different list from the one above, and deliberately so. Volume
          counts a decade of decided filings; this counts what is sitting in
          the queue today, which DOL&apos;s disclosure files cannot show
          because every row in them already has a decision. Read each figure
          against the sponsor&apos;s own tracked total beside it: everything
          filed and still waiting is a very different position from a long
          steady record with a slice outstanding.
        </>
      }
      source={when ? `Live case tracker, as of ${when}` : "Live case tracker"}
      className={className}
    >
      <ol className="space-y-3">
        {leaders.map((l, i) => (
          <Fragment key={l.slug}>{" "}
            <li
              className={i > 0 ? "border-t border-border/40 pt-3" : undefined}
            >
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 [&>*]:min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-baseline">
                <p className="text-sm font-bold leading-snug">
                  <Link
                    href={`/perm-employers/${l.slug}`}
                    className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                  >
                    {l.name}
                  </Link>
                </p>{" "}
                <p className="font-mono text-xs tabular-nums text-foreground/70">
                  <span className="font-bold text-foreground">{fmt(l.pending)}</span> of{" "}
                  {fmt(l.tracked)} tracked
                </p>
              </div>
              {/* Trackless. The lime fill measures 1.38:1 against a
                  `border/40` track in light mode, under the 3:1 floor for a
                  graphical object; ink on card is 20.1:1. The row already
                  prints "N of M", which is what a track would have implied. */}
              <div
                aria-hidden="true"
                className="mt-1.5 h-1.5 bg-foreground"
                style={{ width: `${Math.max(2, (l.pending / max) * 100)}%` }}
              />
              {l.topStage ? (
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {fmt(l.topStageN)} in {l.topStage.toLowerCase()}
                </p>
              ) : null}
            </li>
          </Fragment>
        ))}
      </ol>
    </FigurePlate>
  );
}
