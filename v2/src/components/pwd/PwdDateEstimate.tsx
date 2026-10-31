"use client";

import { useId, useState } from "react";

import { DateInput } from "@/components/forms/DateInput";
import { DateRuler } from "@/components/tools/DateRuler";
import { Label } from "@/components/ui/label";
import { formatInt } from "@/lib/format";
import { estimatePwdDay } from "@/lib/perm";
import type { PwdDayData } from "@/lib/pwdDay";
import { easternDay } from "@/lib/time";
import { longDate, weekdayName } from "@convex/lib/months";

/**
 * When might a wage request filed on a given day be decided? The same
 * estimate the case page gives a P- number (estimatePwdDay: the PERM requests
 * still in process filed before it, over DOL's measured pace a working day),
 * for someone who knows the day it was filed and not its number. Nothing is
 * sent anywhere: the queue is in the page.
 */
export function PwdDateEstimate({
  data,
  lineDay,
  filedByDay = [],
}: {
  data: PwdDayData;
  lineDay: string | null;
  /** Every request filed each day (our check's document), for "N of that day's requests are decided". */
  filedByDay?: readonly (readonly [string, number])[];
}) {
  const id = useId();
  const [filed, setFiled] = useState("");
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(filed);
  // Read only once a day is picked: the page is cached, and a day computed in
  // the first render could differ between the server and the reader.
  const today = ok ? easternDay() : "";
  const future = ok && filed > today;
  const est = ok && !future ? estimatePwdDay({ filingDate: filed, today, queue: data.queue, measuredRange: data.measuredRange }) : null;
  const dated = est && est.kind === "estimate" ? est : null;
  // Filed on or before the day DOL is deciding: DOL has reached it already.
  const reached = dated && lineDay !== null && filed <= lineDay;
  // That day's requests: how many were filed and how many DOL has finished.
  const sameDay = ok ? filedByDay.find(([d]) => d === filed)?.[1] ?? null : null;
  const waitingThatDay = ok ? data.queue.byDay.find(([d]) => d === filed)?.[1] ?? 0 : 0;
  const decidedThatDay = sameDay !== null ? Math.max(0, sameDay - waitingThatDay) : null;

  return (
    <div>
      <Label htmlFor={id}>The day the wage request was filed</Label>{" "}
      <DateInput id={id} value={filed} onChange={(e) => setFiled(e.target.value)} className="mt-1.5 max-w-xs" />{" "}
      <div aria-live="polite" className="mt-5">
        {future ? (
          <p className="text-base text-soft">That day hasn&apos;t come yet. Pick the day it was filed.</p>
        ) : est && est.kind === "refused" ? (
          <p className="text-base text-soft">{est.detail} The estimate comes back with the next check.</p>
        ) : dated ? (
          <>
            <p className="font-heading text-3xl font-bold leading-tight">
              {reached ? "Any day now" : `Around ${weekdayName(dated.date)}, ${longDate(dated.date)}`}
            </p>{" "}
            <p className="mt-2 text-base text-soft">
              {reached
                ? `DOL is already deciding requests filed that day. One still waiting may have an RFI or another review.`
                : `Most likely between ${longDate(dated.earliest)} and ${longDate(dated.latest)}. ${formatInt(dated.requestsAhead)} requests filed before it are still waiting; DOL finishes about ${formatInt(Math.round(dated.pace))} a working day.`}
            </p>{" "}
            {sameDay !== null && sameDay > 0 && decidedThatDay !== null ? (
              <p className="mt-2 text-base">
                {formatInt(decidedThatDay)} of the {formatInt(sameDay)} requests filed that day are decided.
              </p>
            ) : null}{" "}
            <DateRuler
              className="mt-5"
              from={filed}
              to={dated.date}
              fromLabel="Filed"
              toLabel="Estimate"
              today={today}
              leftWord="to go"
              emptyHint="Pick the day it was filed"
              marks={
                reached
                  ? []
                  : [
                      { at: dated.earliest, label: "Earliest" },
                      { at: dated.latest, label: "Latest" },
                    ]
              }
            />
          </>
        ) : (
          <DateRuler from={null} to={null} fromLabel="Filed" toLabel="Estimate" emptyHint="Pick the day it was filed" />
        )}
      </div>{" "}
      <p className="mt-4 text-sm text-muted-foreground">
        An estimate from DOL&apos;s recent pace, not a promise. Have the number? The lookup above checks the request itself.
      </p>
    </div>
  );
}
