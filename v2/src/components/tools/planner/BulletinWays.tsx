"use client";

import { useId } from "react";

import { bulletinCheckSentence, type BulletinCheck } from "@/lib/bulletinCheck";
import { cutoffLabel } from "@/lib/bulletinNext";
import type { BulletinMethod, PaceBasis, Plan } from "@/lib/perm";
import type { PlanAnswer } from "@/lib/planQuery";
import { cn } from "@/lib/utils";
import { monthYear } from "@convex/lib/months";

import { dayLabel, rangeLabel } from "./format";
import { NumberBox } from "./NumberBox";

export interface BulletinControls {
  method: BulletinMethod;
  setMethod: (m: BulletinMethod) => void;
  paceDaysPerMonth: number | null;
  setPace: (n: number | null) => void;
  perYear: number | null;
  setPerYear: (n: number | null) => void;
}

/** Whether the people-ahead count is in, still being read, failed, or can't be asked yet. */
export type LineState = "ready" | "loading" | "failed" | "not-yet";

/**
 * When the reader's priority date becomes current, answered as dates two ways side by side:
 * the final action cutoff moving at the pace it has kept, and the people ahead of the date at
 * the green cards the line is issued a year. The chosen one dates the plan; one press switches.
 */
export function BulletinNote({
  plan,
  cell,
  lineName,
  bulletinMonth,
  line,
  lineState,
  controls,
  onMore,
  today,
}: {
  plan: Plan;
  cell: PaceBasis | null;
  lineName: string;
  bulletinMonth: string | null;
  line: PlanAnswer["line"];
  lineState: LineState;
  controls: Pick<BulletinControls, "method" | "setMethod">;
  onMore: () => void;
  today: string;
}) {
  const month = monthYear(bulletinMonth) ?? "newest";
  const b = plan.bulletin;
  const pd = plan.priorityDate;
  if (plan.current || cell?.latest.kind === "unavailable" || !pd) {
    const text = plan.current
      ? `Your priority date is already current for ${lineName} in the ${month} bulletin, so the I-485 goes in with the I-140.`
      : cell?.latest.kind === "unavailable"
        ? `${lineName} is unavailable in the ${month} bulletin: no green cards go to it this month, so nothing can date when your priority date becomes current.`
        : `${lineName}'s cutoff can't date your priority date yet.`;
    return <p className="mt-8 max-w-3xl border-l-4 border-data-info-ink pl-4 text-base leading-relaxed">{text}</p>;
  }
  const perMonth = cell?.movedDays && cell.spanMonths ? Math.round(cell.movedDays / cell.spanMonths) : null;
  const options = [
    {
      method: "pace" as const,
      title: "At the cutoff's pace",
      reach: b.reachByPace,
      how: perMonth !== null ? `The cutoff has moved about ${perMonth} days a month` : "How fast the cutoff has moved",
      none: "The cutoff hasn't moved enough to measure a pace.",
    },
    {
      method: "supply" as const,
      title: "By the people ahead of you",
      reach: b.reachBySupply,
      how: line
        ? `${line.peopleAhead.mid.toLocaleString("en-US")} people ahead, ${line.perYear.toLocaleString("en-US")} green cards a year`
        : "Counting the people ahead of your date",
      none:
        lineState === "loading"
          ? "Counting the people ahead of your date..."
          : lineState === "failed"
            ? "The count didn't load. Try again in a minute."
            : lineState === "not-yet"
              ? "People are still filing ahead of your date, so they can't be counted yet. This way works once it has passed."
              : "USCIS's counts for this line don't support a count.",
    },
  ];
  return (
    <section aria-labelledby="bulletin-when" className="mt-10">
      <h3 id="bulletin-when" className="font-heading text-xl font-bold">
        When your priority date becomes current
      </h3>{" "}
      <p className="mt-1 text-base text-soft">
        {lineName}: the {month} cutoff is {cutoffLabel(cell?.latest ?? null)}; your date is {dayLabel(pd.mid, today, true)}.
      </p>{" "}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {options.map((o) => {
          const chosen = controls.method === o.method;
          return (
            <button
              key={o.method}
              type="button"
              aria-pressed={chosen}
              disabled={!o.reach}
              onClick={() => controls.setMethod(o.method)}
              className={cn(
                "flex flex-col items-start border-2 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed sm:p-5",
                chosen ? "border-foreground bg-soft-good shadow-hard-sm" : "border-border bg-background hover:border-foreground",
              )}
            >
              <span className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden="true"
                  className={cn("size-3.5 shrink-0 rounded-full border-2", chosen ? "border-foreground bg-primary" : "border-input bg-background")}
                />{" "}
                <span>{o.title}</span>{" "}
                {chosen ? <span className="ml-auto border-2 border-foreground bg-primary px-2 py-0.5 text-sm font-semibold text-black">In your plan</span> : null}
              </span>{" "}
              {o.reach ? (
                <>
                  <span className="mt-2 font-heading text-3xl font-bold tabular-nums">{dayLabel(o.reach.mid, today)}</span>{" "}
                  {o.reach.low !== o.reach.high ? <span className="text-sm text-soft">{rangeLabel(o.reach, today)}</span> : null}{" "}
                  <span className="mt-2 text-sm">{o.how}</span>
                </>
              ) : (
                <span className="mt-2 text-base text-soft">{o.none}</span>
              )}
            </button>
          );
        })}
      </div>{" "}
      <button type="button" onClick={onMore} className="link mt-2 inline-flex min-h-11 items-center text-sm">
        Change the pace or the green cards a year
      </button>
    </section>
  );
}

/**
 * The two figures behind the dates above, in the "Change the figures" fold: how fast the cutoff
 * moves, and how many green cards the line is issued a year. Each starts at what was measured.
 */
export function BulletinChoice({
  plan,
  cell,
  check,
  line,
  controls,
}: {
  plan: Plan;
  cell: PaceBasis | null;
  check: BulletinCheck | null;
  line: PlanAnswer["line"];
  controls: Omit<BulletinControls, "method" | "setMethod">;
}) {
  const id = useId();
  if (plan.current || cell?.latest.kind === "unavailable") return null;
  const b = plan.bulletin;
  const measuredPace = cell?.movedDays && cell.spanMonths ? Math.round(cell.movedDays / cell.spanMonths) : null;
  const checkLine = b.gapDays && b.gapDays > 0 ? bulletinCheckSentence(check, b.gapDays) : null;
  return (
    <fieldset className="mt-10">
      <legend className="font-semibold">When your priority date becomes current</legend>{" "}
      <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <NumberBox
            id={`${id}-ppm`}
            label="The cutoff moves, days a month"
            value={controls.paceDaysPerMonth}
            placeholder={measuredPace !== null ? `${measuredPace} measured` : "Not measured"}
            onChange={controls.setPace}
            min={1}
          />{" "}
          {checkLine ? <p className="mt-2 text-sm leading-relaxed text-soft">{checkLine}</p> : null}
        </div>{" "}
        <div>
          {line ? (
            <>
              <NumberBox
                id={`${id}-py`}
                label="Green cards to the line a year"
                value={controls.perYear}
                placeholder={`${line.perYear.toLocaleString("en-US")} in FY${line.fy}`}
                onChange={controls.setPerYear}
                min={1}
              />{" "}
              <p className="mt-2 text-sm leading-relaxed text-soft">
                {line.peopleAhead.mid.toLocaleString("en-US")} people ahead ({line.peopleAhead.low.toLocaleString("en-US")} to{" "}
                {line.peopleAhead.high.toLocaleString("en-US")}), counted from USCIS&apos;s approved petitions and pending applications.
              </p>
            </>
          ) : (
            <p className="text-sm text-soft">People ahead are counted once your priority date has passed.</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
