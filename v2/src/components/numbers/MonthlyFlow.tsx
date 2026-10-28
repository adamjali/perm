"use client";

import { Fragment, useState } from "react";

import { monthTick, monthYear } from "@convex/lib/months";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { choiceVariants } from "@/components/ui/choice";
import { flowTotals, type FlowMonth } from "@/lib/byTheNumbers";
import { formatInt, formatShareOf } from "@/lib/format";

/** The outcome colours, the status code used everywhere: certified green, denied red, withdrawn purple. */
const OUTCOMES = [
  { key: "certified", label: "certified", fill: "bg-primary" },
  { key: "denied", label: "denied", fill: "bg-chart-red" },
  { key: "withdrawn", label: "withdrawn", fill: "bg-chart-purple" },
  { key: "other", label: "other final", fill: "bg-chart-blue" },
] as const;

/** The months a reader can pick: every year held, the last twelve, or the whole run. */
export function flowPeriods(months: readonly FlowMonth[]): { key: string; label: string }[] {
  const first = months[0]?.month.slice(0, 4);
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];
  return [{ key: "all", label: `Since ${first ?? ""}` }, ...years.map((y) => ({ key: y, label: y })), { key: "12", label: "Last 12 months" }];
}

export function monthsIn(months: readonly FlowMonth[], period: string): FlowMonth[] {
  if (period === "all") return [...months];
  if (period === "12") return months.slice(-12);
  return months.filter((m) => m.month.startsWith(period));
}

const monthLong = (ym: string) => monthYear(ym) ?? ym;

/**
 * PERM cases filed and decided each calendar month, with a period picker.
 * Filed counts each case in its filing month; decided counts each decision in
 * the month DOL made it, so the two answer different questions and sit in two
 * charts on one time axis. Each month opens its own filing-month page.
 */
/** "July 2026", "July and August 2026", "May, July and August 2026": months named once, in order. */
export function namedMonths(months: readonly string[]): string {
  const names = months.map(monthLong);
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function MonthlyFlow({ months, gapReason }: { months: readonly FlowMonth[]; /** Why a month has no record, from the sources' own dates. */ gapReason: string }) {
  const [period, setPeriod] = useState("all");
  const shown = monthsIn(months, period);
  if (shown.length === 0) return null;
  const totals = flowTotals(shown);
  const first = monthTick(`${shown[0]!.month}-01`) ?? shown[0]!.month;
  const last = monthTick(`${shown[shown.length - 1]!.month}-01`) ?? shown[shown.length - 1]!.month;

  const filed: Column[] = shown.map((m) => ({
    key: m.month,
    value: m.filed,
    label: monthLong(m.month),
    tip: `${monthLong(m.month)}\n${formatInt(m.filed)} filed${m.current ? " so far" : ""}`,
    partial: m.current,
    href: `/perm-queue/${m.month}`,
  }));
  const decided: Column[] = shown.map((m) => {
    if (!m.decided) {
      return { key: m.month, value: 0, label: monthLong(m.month), gap: true, tip: `${monthLong(m.month)}\nNo complete record of DOL's decisions` };
    }
    const d = m.decided;
    const lines = OUTCOMES.filter((o) => d[o.key] > 0).map((o) => `${formatInt(d[o.key])} ${o.label}`);
    return {
      key: m.month,
      value: d.total,
      label: monthLong(m.month),
      tip: `${monthLong(m.month)}${m.current ? " so far" : ""}\n${lines.join("\n")}`,
      partial: m.current,
      parts: OUTCOMES.map((o) => ({ value: d[o.key], fill: o.fill })),
    };
  });

  return (
    <div>
      <div role="group" aria-label="Months shown" className="flex flex-wrap gap-2">
        {flowPeriods(months).map((p) => (
          <Fragment key={p.key}>
            {" "}
            <button type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} className={choiceVariants({ on: period === p.key })}>
              {p.label}
            </button>
          </Fragment>
        ))}
      </div>{" "}
      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 [&>*]:min-w-0">
        <div className="bg-soft-wait p-3 sm:p-4 border-2 border-border">
          <dt className="text-sm font-bold">Filed</dt>{" "}
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums sm:text-3xl">{formatInt(totals.filed)}</dd>
        </div>{" "}
        <div className="bg-soft-good p-3 sm:p-4 border-2 border-border">
          <dt className="text-sm font-bold">Decided</dt>{" "}
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums sm:text-3xl">{formatInt(totals.decided)}</dd>
        </div>{" "}
        <div className="bg-soft-good p-3 sm:p-4 border-2 border-border">
          <dt className="text-sm font-bold">Of those, certified</dt>{" "}
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums sm:text-3xl">{totals.decided ? formatShareOf(totals.certified, totals.decided) : "None"}</dd>
        </div>
      </dl>{" "}
      <h3 className="mt-6 text-base font-bold">Filed each month</h3>{" "}
      <ColumnChart className="mt-2" label="PERM cases filed each month" unit="Filed" tone="yellow" first={first} last={last} columns={filed} />{" "}
      <h3 className="mt-6 text-base font-bold">Decided each month</h3>{" "}
      <ColumnChart className="mt-2" label="PERM decisions each month, by outcome" unit="Decided" first={first} last={last} columns={decided} />{" "}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {OUTCOMES.slice(0, 3).map((o) => (
          <li key={o.key} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-3 border border-input ${o.fill}`} /> {o.label}{" "}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 border-2 border-dashed border-input" /> no complete record{" "}
        </li>
      </ul>{" "}
      {totals.noRecord.length > 0 ? (
        <p className="mt-3 text-sm text-soft">
          {`${namedMonths(totals.noRecord)} ${totals.noRecord.length === 1 ? "has" : "have"} no complete record: ${gapReason}`}
        </p>
      ) : null}
    </div>
  );
}
