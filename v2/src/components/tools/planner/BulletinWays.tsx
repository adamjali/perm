"use client";

import { useId, type ReactNode } from "react";

import { aboutMonths } from "@/lib/board";
import { bulletinCheckSentence, type BulletinCheck } from "@/lib/bulletinCheck";
import { cutoffLabel } from "@/lib/bulletinNext";
import { monthsToDays, type BulletinMethod, type PaceBasis, type Plan, type Span } from "@/lib/perm";
import type { PlanAnswer } from "@/lib/planQuery";
import { cn } from "@/lib/utils";
import { monthYear } from "@convex/lib/months";

import { NumberBox } from "./NumberBox";

/** A wait in months as words: "about 2½ years". */
const wait = (months: number) => (months <= 0 ? "no wait" : aboutMonths(monthsToDays(months)));
const bare = (months: number) => wait(months).replace(/^about /, "");

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
 * The bulletin wait in one line under the chart: it's the least certain step, so both ways of
 * working it out are given, and the link opens the figures to choose between them.
 */
export function BulletinNote({
  plan,
  cell,
  lineName,
  bulletinMonth,
  onChange,
}: {
  plan: Plan;
  cell: PaceBasis | null;
  lineName: string;
  bulletinMonth: string | null;
  onChange: () => void;
}) {
  const month = monthYear(bulletinMonth) ?? "newest";
  const b = plan.bulletin;
  const ways = [
    b.byPace ? `${wait(b.byPace.mid)} at the cutoff's pace` : null,
    b.bySupply ? `${wait(b.bySupply.mid)} by the people ahead of you` : null,
  ].filter(Boolean);
  const text = plan.current
    ? `${lineName} is current in the ${month} bulletin, so the I-485 goes in with the I-140.`
    : cell?.latest.kind === "unavailable"
      ? `${lineName} is unavailable in the ${month} bulletin, so nothing can date the wait for a visa number.`
      : ways.length
        ? `The wait for the bulletin is the least certain step: ${ways.join(", or ")}.`
        : `${lineName}'s cutoff hasn't moved enough to date the wait for the bulletin.`;
  return (
    <div className="mt-6 max-w-3xl border-l-4 border-data-info-ink pl-4">
      <p className="text-base leading-relaxed">{text}</p>{" "}
      {plan.current || cell?.latest.kind === "unavailable" ? null : (
        <button type="button" onClick={onChange} className="link inline-flex min-h-11 items-center">
          Choose how it&apos;s worked out
        </button>
      )}
    </div>
  );
}

/**
 * The two ways to date the bulletin wait, side by side, the chosen one dating the plan: the
 * final action cutoff moving at the pace it has kept, and the people ahead of the priority date
 * at the green cards the line is issued a year. Each figure behind them is editable.
 */
export function BulletinChoice({
  plan,
  cell,
  lineName,
  bulletinMonth,
  check,
  line,
  lineState,
  controls,
}: {
  plan: Plan;
  cell: PaceBasis | null;
  lineName: string;
  bulletinMonth: string | null;
  check: BulletinCheck | null;
  line: PlanAnswer["line"];
  lineState: LineState;
  controls: BulletinControls;
}) {
  const id = useId();
  if (plan.current || cell?.latest.kind === "unavailable") return null;
  const b = plan.bulletin;
  const measuredPace = cell?.movedDays && cell.spanMonths ? Math.round(cell.movedDays / cell.spanMonths) : null;
  const checkLine = b.gapDays && b.gapDays > 0 ? bulletinCheckSentence(check, b.gapDays) : null;
  return (
    <fieldset className="mt-10">
      <legend className="font-semibold">
        The wait for the bulletin, {lineName}, cutoff {cutoffLabel(cell?.latest ?? null)} in the {monthYear(bulletinMonth) ?? "newest"} bulletin
      </legend>{" "}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <Way
          id={`${id}-pace`}
          name={`${id}-way`}
          title="The cutoff's pace"
          chosen={controls.method === "pace"}
          onChoose={() => controls.setMethod("pace")}
          months={b.byPace}
          empty={cell?.latest.kind === "date" ? "The cutoff hasn't moved enough to measure a pace." : "No cutoff to measure from."}
        >
          <NumberBox
            id={`${id}-ppm`}
            label="The cutoff moves, days a month"
            value={controls.paceDaysPerMonth}
            placeholder={measuredPace !== null ? `${measuredPace} measured` : "Not measured"}
            onChange={controls.setPace}
            min={1}
          />{" "}
          {checkLine ? <p className="mt-2 text-sm leading-relaxed text-soft">{checkLine}</p> : null}
        </Way>{" "}
        <Way
          id={`${id}-supply`}
          name={`${id}-way`}
          title="People ahead of you"
          chosen={controls.method === "supply"}
          onChoose={() => controls.setMethod("supply")}
          months={b.bySupply}
          disabled={!line}
          empty={
            lineState === "loading"
              ? "Counting the people ahead of your date..."
              : lineState === "failed"
                ? "The count didn't load. The cutoff's pace still dates the plan."
                : lineState === "not-yet"
                  ? "Counted once your priority date has passed."
                  : "USCIS's counts for this line don't support a count."
          }
        >
          {line ? (
            <>
              <p className="text-sm leading-relaxed text-soft">
                <b className="font-semibold text-foreground tabular-nums">{line.peopleAhead.mid.toLocaleString("en-US")}</b> people ahead
                ({line.peopleAhead.low.toLocaleString("en-US")} to {line.peopleAhead.high.toLocaleString("en-US")}), from USCIS&apos;s
                approved petitions and pending applications.
              </p>{" "}
              <div className="mt-3">
                <NumberBox
                  id={`${id}-py`}
                  label="Green cards to the line a year"
                  value={controls.perYear}
                  placeholder={`${line.perYear.toLocaleString("en-US")} in FY${line.fy}`}
                  onChange={controls.setPerYear}
                  min={1}
                />
              </div>
            </>
          ) : null}
        </Way>
      </div>
    </fieldset>
  );
}

function Way({
  id,
  name,
  title,
  chosen,
  onChoose,
  months,
  disabled,
  empty,
  children,
}: {
  id: string;
  name: string;
  title: string;
  chosen: boolean;
  onChoose: () => void;
  months: Span | null;
  disabled?: boolean;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("border-2 p-4 sm:p-5", chosen ? "border-data-info-ink bg-soft-info" : "border-border")}>
      <label htmlFor={id} className={cn("flex min-h-11 items-center gap-3 font-semibold", disabled && "text-soft")}>
        <input id={id} type="radio" name={name} checked={chosen} disabled={disabled} onChange={onChoose} className="size-5 accent-primary" /> {title}
        {chosen ? <span className="sr-only">, dates the plan</span> : null}
      </label>{" "}
      {months ? (
        <p className="mt-1">
          <span className="font-heading text-3xl font-bold tabular-nums">{wait(months.mid)}</span>{" "}
          <span className="block text-sm text-soft">
            {bare(months.low)} to {bare(months.high)}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-base text-soft">{empty}</p>
      )}{" "}
      <div className="mt-3">{children}</div>
    </div>
  );
}
