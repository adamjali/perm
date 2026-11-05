"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";

import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { RequestFailed } from "@/components/tools/RequestFailed";
import { choiceVariants } from "@/components/ui/choice";
import { Pagination } from "@/components/ui/pagination";
import { SortMark } from "@/components/ui/sort-mark";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { useUrlPatch, useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { FILINGS_FROM } from "@/lib/filingDay";
import {
  buckets,
  dayHref,
  FILING_PROGRAMS,
  fillDays,
  PERIODS,
  periodTotal,
  PROGRAM_NAMES,
  shiftDay,
  shortDay,
  shortMonth,
  type FilingDay,
  type FilingProgram,
} from "@/lib/filingsByDay";
import { formatInt } from "@/lib/format";
import { longDate, shortDate, weekdayName } from "@convex/lib/months";

/**
 * The daily filings for any program and any period since FY2020 (owner, Nov 5 2026: "ez to
 * click/check other days or time periods ... flexible sort filter search"). The page carries the
 * last PAGE_WINDOW_DAYS; an older period is asked of /api/filings-by-day. Picks live in the
 * address (`?program=lca&period=custom&from=2024-01-01&to=2024-03-31`), so a view can be shared.
 */

type SortKey = "day" | "filed" | "waiting" | "fileOnly" | "mismatch";
const SORT_COLS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "day", label: "Day", numeric: false },
  { key: "filed", label: "Filed", numeric: true },
  { key: "waiting", label: "Still waiting", numeric: true },
  { key: "fileOnly", label: "Only in DOL's files", numeric: true },
  { key: "mismatch", label: "Files give another day", numeric: true },
];
const PER_PAGE = 31;

type Range = { asOf: string; programs: Record<FilingProgram, FilingDay[]> };

export function FilingsExplorer({ asOf, windowFrom, programs }: { asOf: string; windowFrom: string } & Pick<Range, "programs">) {
  const params = useUrlSearchParams();
  const patch = useUrlPatch();
  const top = useRef<HTMLDivElement>(null);
  const program: FilingProgram = (FILING_PROGRAMS as readonly string[]).includes(params.get("program") ?? "")
    ? (params.get("program") as FilingProgram)
    : "perm";
  const periodKey = params.get("period") ?? "30";
  const preset = PERIODS.find((p) => p.key === periodKey);
  const custom = periodKey === "custom";
  const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const to = custom ? (day(params.get("to")) ?? asOf) : asOf;
  const fromAsked = custom ? (day(params.get("from")) ?? shiftDay(to, -29)) : shiftDay(asOf, -((preset?.days ?? 30) - 1));
  const from = fromAsked < FILINGS_FROM ? FILINGS_FROM : fromAsked > to ? to : fromAsked;

  // A period older than the page's own window is asked for; everything else is already here.
  const older = from < windowFrom;
  const remote = usePublicQuery<Range>(older ? `/api/filings-by-day?from=${from}&to=${to}` : "skip");
  const source = older ? remote.data?.programs : programs;
  const days = source?.[program] ?? [];

  const total = periodTotal(days, from, to);
  const chart = buckets(days, from, to, asOf);
  const names = PROGRAM_NAMES[program];
  const columns: Column[] = chart.rows.map((b) => ({
    key: b.key,
    value: b.filed,
    label: chart.unit === "day" ? longDate(b.from) ?? b.from : chart.unit === "week" ? `Week of ${longDate(b.from)}` : shortMonth(b.from),
    tip:
      `${chart.unit === "day" ? `${weekdayName(b.from)}, ${longDate(b.from)}` : chart.unit === "week" ? `${shortDay(b.from)} to ${shortDay(b.to)}` : shortMonth(b.from)}\n` +
      `${formatInt(b.filed)} filed${b.partial ? " so far" : ""}, ${formatInt(b.waiting)} still waiting`,
    href: chart.unit === "day" ? dayHref(b.from, program) : undefined,
    now: b.partial,
    partial: b.partial,
  }));

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "day", dir: "desc" });
  const [page, setPage] = useState(1);
  const rows = fillDays(days, from, to).sort((a, b) => {
    const v = sort.key === "day" ? a.day.localeCompare(b.day) : a[sort.key] - b[sort.key] || a.day.localeCompare(b.day);
    return sort.dir === "asc" ? v : -v;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((Math.min(page, pageCount) - 1) * PER_PAGE, Math.min(page, pageCount) * PER_PAGE);
  const sortBy = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(1);
  };

  const [jump, setJump] = useState(asOf);
  const setPeriod = (p: Record<string, string | null>) => {
    patch(p);
    setPage(1);
  };

  return (
    <div ref={top} className="scroll-mt-24">
      <div role="group" aria-label="Which filings" className="flex flex-wrap gap-2">
        {FILING_PROGRAMS.map((p) => (
          <Fragment key={p}>
            <button
              type="button"
              aria-pressed={program === p}
              onClick={() => setPeriod({ program: p === "perm" ? null : p })}
              className={choiceVariants({ on: program === p })}
            >
              {PROGRAM_NAMES[p].name}
            </button>{" "}
          </Fragment>
        ))}
      </div>{" "}
      <div role="group" aria-label="Period" className="mt-3 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Fragment key={p.key}>
            <button
              type="button"
              aria-pressed={!custom && (preset?.key ?? "30") === p.key}
              onClick={() => setPeriod({ period: p.key === "30" ? null : p.key, from: null, to: null })}
              className={choiceVariants({ on: !custom && (preset?.key ?? "30") === p.key })}
            >
              {p.label}
            </button>{" "}
          </Fragment>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setPeriod({ period: "custom", from, to })}
          className={choiceVariants({ on: custom })}
        >
          Pick the days
        </button>
      </div>{" "}
      {custom ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-[0_1_12rem] flex-col gap-1 text-sm font-semibold">
            From
            <input
              type="date"
              name="from"
              min={FILINGS_FROM}
              max={asOf}
              value={from}
              onChange={(e) => e.target.value && setPeriod({ from: e.target.value })}
              className="min-h-11 w-full min-w-0 border-2 border-input bg-background px-2 text-base font-normal"
            />
          </label>{" "}
          <label className="flex min-w-0 flex-[0_1_12rem] flex-col gap-1 text-sm font-semibold">
            To
            <input
              type="date"
              name="to"
              min={FILINGS_FROM}
              max={asOf}
              value={to}
              onChange={(e) => e.target.value && setPeriod({ to: e.target.value })}
              className="min-h-11 w-full min-w-0 border-2 border-input bg-background px-2 text-base font-normal"
            />
          </label>
        </div>
      ) : null}{" "}
      {older && remote.failed ? (
        <RequestFailed className="mt-6 bg-tint p-4 border-2 border-border" what="That period's counts" failure={remote.failure} onRetry={remote.retry} />
      ) : older && !remote.data ? (
        <p className="mt-6 text-base text-soft" role="status">
          Loading {longDate(from)} to {longDate(to)}.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 [&>*]:min-w-0">
            {[
              { label: `${names.name} filed`, value: total.filed },
              { label: "Still waiting at DOL", value: total.waiting },
              { label: "Only in DOL's published files", value: total.fileOnly },
              { label: "Files give another day", value: total.mismatch },
            ].map((f) => (
              <div key={f.label} className="bg-tint p-3 sm:p-4">
                <dt className="text-sm text-soft">{f.label}</dt>{" "}
                <dd className="m-0 mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl">{formatInt(f.value)}</dd>
              </div>
            ))}
          </dl>{" "}
          <p className="mt-3 text-sm text-soft">
            {longDate(from)} to {longDate(to)}
            {to >= asOf ? ", today so far" : ""}.
          </p>{" "}
          <div className="mt-6">
            <ColumnChart
              columns={columns}
              label={`${names.plural} filed each ${chart.unit}`}
              first={chart.unit === "month" ? shortMonth(from) : shortDay(from)}
              last={chart.unit === "month" ? shortMonth(to) : shortDay(to)}
              unit={names.plural}
              partialKey="Still filling"
            />
          </div>{" "}
          <form
            className="mt-8 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("day") ?? jump);
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) window.location.assign(dayHref(v, program));
            }}
          >
            <label className="flex min-w-0 flex-[0_1_12rem] flex-col gap-1 text-sm font-semibold">
              Open one day
              <input
                type="date"
                name="day"
                min={FILINGS_FROM}
                max={asOf}
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                className="min-h-11 w-full min-w-0 border-2 border-input bg-background px-2 text-base font-normal"
              />
            </label>{" "}
            <button type="submit" className={choiceVariants({ on: false })}>
              See its {names.plural}
            </button>
          </form>{" "}
          <div className="mt-8 overflow-x-auto" role="region" aria-label={`${names.plural} by day`} tabIndex={0}>
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <caption className="sr-only">{`${names.plural} filed each day, ${longDate(from)} to ${longDate(to)}`}</caption>
              <thead>
                <tr className="border-b-2 border-foreground">
                  {SORT_COLS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={c.numeric ? "py-2 text-right" : "py-2"}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold ${c.numeric ? "flex-row-reverse" : ""}`}
                      >
                        {c.label} <SortMark dir={sort.key === c.key ? sort.dir : null} />
                      </button>{" "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.day} className="border-b border-border">
                    <td className="py-2">
                      <Link href={dayHref(r.day, program)} className="link inline-flex min-h-11 items-center whitespace-nowrap">
                        {(weekdayName(r.day) ?? "").slice(0, 3)} {shortDate(r.day)}
                      </Link>{" "}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(r.filed)}{" "}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(r.waiting)}{" "}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(r.fileOnly)}{" "}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(r.mismatch)}{" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{" "}
          {pageCount > 1 ? (
            <Pagination className="mt-6" page={Math.min(page, pageCount)} pageCount={pageCount} onPage={setPage} total={rows.length} perPage={PER_PAGE} noun="days" scrollTo={top} />
          ) : null}
        </>
      )}
    </div>
  );
}
