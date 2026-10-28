import Link from "next/link";
import { Fragment } from "react";

import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/ssr";

import { monthDay, weekdayName } from "@convex/lib/months";
import type { StatusShift } from "@/lib/backlogMonths";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { prettyStatus } from "./stages";

/** Statuses shown as tiles; any beyond are counted in words, never dropped silently. */
export const SINCE_SHOWN = 6;

/** "−312" and "+290": the sign is part of the text, so the arrow is never the only cue. */
export function signed(n: number): string {
  return `${n < 0 ? "−" : "+"}${formatInt(Math.abs(n))}`;
}

/** The lead line: what DOL decided, what reopened, and the filings found, in the day's own words. */
export function sinceLead(shift: StatusShift): string | null {
  const parts: string[] = [];
  if (shift.decided > 0) parts.push(`${formatInt(shift.decided)} decided`);
  if (shift.decided < 0) parts.push(`${formatInt(-shift.decided)} reopened`);
  if (shift.total > 0) parts.push(`${formatInt(shift.total)} more filings on record`);
  if (shift.total < 0) parts.push(`${formatInt(-shift.total)} fewer on record`);
  return parts.length ? parts.join(", ") : null;
}

/**
 * How a set of cases moved since a past DOL day: today's live counts against
 * the replay's count at the end of that day (`perm_census_days`). The day is
 * always named, because "since yesterday" is wrong the morning the replay is late.
 */
export function SinceDay({
  shift,
  since,
  hrefFor,
  className,
}: {
  shift: StatusShift;
  /** The past day compared against, "YYYY-MM-DD". */
  since: string;
  /** Where a status's own cases are listed; the tile then opens them. */
  hrefFor?: (status: string) => string | null;
  className?: string;
}) {
  const day = `${weekdayName(since) ?? ""}, ${monthDay(since) ?? since}`;
  const lead = sinceLead(shift);
  const shown = shift.statuses.slice(0, SINCE_SHOWN);
  const rest = shift.statuses.length - shown.length;
  return (
    <div className={className}>
      <p className="text-base font-bold">
        {`Since the end of ${day}`}
        {lead ? <span className="font-normal text-soft">{`: ${lead}`}</span> : <span className="font-normal text-soft">: no status moved</span>}
      </p>{" "}
      {shown.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {shown.map((s) => {
            const href = hrefFor?.(s.status) ?? null;
            const body = (
              <>
                <span>{prettyStatus(s.status)}</span>{" "}
                <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums">
                  {s.change < 0 ? <ArrowDownIcon aria-hidden="true" className="size-3.5" /> : <ArrowUpIcon aria-hidden="true" className="size-3.5" />}
                  {signed(s.change)}
                </span>
              </>
            );
            const tile = "inline-flex min-h-11 items-center gap-2 border-2 border-border bg-card px-3 text-sm";
            return (
              <Fragment key={s.status}>
                {" "}
                <li>
                  {href ? (
                    <Link href={href} className={cn(tile, "hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary")}>
                      {body}
                    </Link>
                  ) : (
                    <span className={tile}>{body}</span>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      ) : null}{" "}
      {rest > 0 ? <p className="mt-2 text-sm text-soft">{`${formatInt(rest)} more ${rest === 1 ? "status" : "statuses"} moved by fewer.`}</p> : null}
    </div>
  );
}
