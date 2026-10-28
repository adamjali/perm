"use client";

import { useMemo, useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

import { RequestFailed } from "@/components/tools/RequestFailed";
import { useDebounce } from "@/hooks/useDebounce";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import type { BacklogMonth } from "@/lib/backlogMonths";
import { formatAsOf } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";
import { findFront } from "@/lib/liveQueue";
import { findVolumeAnomalies } from "@/lib/queueAhead";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

import { BacklogWall, type BacklogWallProps } from "./BacklogWall";

/**
 * The wall on any day since the event log settled (owner, Oct 27 2026: see the
 * queue on a past day). A slider and two steps pick the day; a past day's bars
 * are drawn filled with today's lengths outlined on the same scale, and DOL's
 * line moves to where DOL had put it by then. The days come from
 * perm_census_days (scripts/build_census_days.py); with none held, it's the
 * wall alone. Today is the server's render, so the page reads no address and
 * stays cached.
 */

interface QueueDay {
  day: string;
  months: BacklogMonth[];
  dol: { month: string; asOf: string } | null;
}

/** How long the slider rests before the day is asked for. */
const ASK_AFTER_MS = 250;

const STEP = "inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-input bg-background disabled:opacity-40";

/** The wall's month inputs from a day's months: where the queue's front is, and which months collapsed. */
function wallFor(months: readonly BacklogMonth[]) {
  const cohort = months.map((m) => ({ month: m.month, total: m.total, pending: m.pending, decided: m.decided, decidedPct: m.decidedPct }));
  return {
    frontMonth: findFront(cohort)?.month ?? null,
    anomalies: findVolumeAnomalies(cohort.map(({ month, ...rest }) => ({ filingMonth: month, ...rest }))),
  };
}

export function QueueDayPicker({
  days,
  today,
}: {
  /** Past days held, oldest first. */
  days: readonly string[];
  /** Today's wall as the server drew it. */
  today: BacklogWallProps;
}) {
  // The slider's last stop is today; every other stop is a past day.
  const [at, setAt] = useState(days.length);
  const day = at < days.length ? (days[at] ?? null) : null;
  // Asked once the slider rests: a drag across sixty days is one request, not sixty (nginx allows 60 a minute on /api).
  const asked = useDebounce(day, ASK_AFTER_MS);
  const q = usePublicQuery<QueueDay>(asked ? `/api/queue-day?day=${asked}` : "skip");
  const shown = day ? (q.data ?? q.previous) : undefined;
  const settled = day !== null && q.data?.day === day;
  const todayPending = useMemo(() => new Map(today.months.map((m) => [m.month, m.pending])), [today.months]);
  const total = (months: readonly BacklogMonth[]) => months.reduce((n, m) => n + m.pending, 0);

  if (days.length === 0) return <BacklogWall {...today} />;

  const label = day ? (longDate(day) ?? day) : "Today";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-tint p-4">
        <span className="text-sm font-bold">The queue on</span>{" "}
        <button type="button" className={STEP} aria-label="A day earlier" disabled={at === 0} onClick={() => setAt(at - 1)}>
          <CaretLeftIcon aria-hidden="true" className="size-4" weight="bold" />
        </button>{" "}
        <input
          type="range"
          min={0}
          max={days.length}
          value={at}
          onChange={(e) => setAt(Number(e.target.value))}
          aria-label="Day"
          aria-valuetext={label}
          className="min-h-11 min-w-0 flex-1 accent-[var(--primary-text)]"
        />{" "}
        <button type="button" className={STEP} aria-label="A day later" disabled={at === days.length} onClick={() => setAt(at + 1)}>
          <CaretRightIcon aria-hidden="true" className="size-4" weight="bold" />
        </button>{" "}
        <span className="min-w-36 font-heading text-lg font-bold tabular-nums" aria-live="polite">
          {label}
        </span>{" "}
        {day ? (
          <button type="button" className="link min-h-11 text-sm" onClick={() => setAt(days.length)}>
            Back to today
          </button>
        ) : (
          <span className="text-sm text-soft">Slide back as far as {longDate(days[0] ?? "")}</span>
        )}
      </div>{" "}
      {day && shown ? (
        <p className="mt-3 text-base text-soft">
          {formatInt(total(shown.months))} cases still pending at the end of {label}, against {formatInt(total(today.months))} today.
        </p>
      ) : null}{" "}
      {day && q.failed ? (
        <RequestFailed className="mt-4 bg-tint p-4 border-2 border-border" what={`The queue on ${label}`} failure={q.failure} onRetry={q.retry} />
      ) : null}{" "}
      <div className={cn("mt-4", day && !settled && !q.failed && "opacity-60")} aria-busy={day !== null && !settled && !q.failed}>
        {day && shown ? (
          <BacklogWall
            {...today}
            {...wallFor(shown.months)}
            months={shown.months}
            frontierMonth={shown.dol?.month ?? null}
            frontierAsOf={shown.dol ? formatAsOf(shown.dol.asOf) : null}
            outline={{ label: "Today", pending: todayPending }}
          />
        ) : (
          <BacklogWall {...today} />
        )}
      </div>
    </div>
  );
}
