"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { nextSort, sortRows, type SortState } from "@/lib/tableSort";
import { CHANGE_PROGRAMS, PROGRAM_LABEL, type ChangeProgram } from "@/lib/changeProgram";
import { CHANGE_COLUMNS, ChangeTable } from "./ChangeTable";
import { DECIDED_COLUMNS, DecidedTable } from "./DecidedTable";
import { coverageFor, daysInRange, type CoverageWindows } from "@/lib/dateCoverage";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { ChangeCalendar, ChangeDayFeed } from "@/lib/turso/changes";
import type { DecidedFeed } from "@/lib/turso/decidedDays";

/**
 * Everything DOL moved on a day, searchable, filterable and sortable.
 *
 * WHY A CLIENT BROWSER AND NOT A ROUTE PARAM. Reading `searchParams` in the
 * page would make `/perm-decision-activity` dynamic, and a dynamic page is a
 * server render on every visit. That is precisely the cost that took Turso to
 * 11.6 billion rows read in two days in August. The page stays static, ships
 * the newest day's first rows in its HTML, and everything else is one JSON
 * request per day, cached at the edge for a settled day.
 *
 * SO THE FIRST ROWS ARE ALWAYS IN THE PRERENDERED HTML. `initialDay` is the
 * server-rendered feed and it renders before any effect runs, which means the
 * content is readable with JavaScript broken and is visible to an extractor.
 *
 * AND THE WHOLE DAY IS FETCHED ONCE, NOT PER KEYSTROKE. Search, filtering,
 * sorting and paging all run over an array already in memory, so no control on
 * this page costs a database read. The busiest day on record is 1,090 rows,
 * 24 KB gzipped. Filtering on the server instead would mint a fresh, uncached
 * query for every keystroke, which is the shape of the August incident.
 *
 * A TRUNCATED LIST MUST NOT BE SORTABLE. The prerendered slice is the first
 * rows of the day by employer, so ordering it by wage or by status would put a
 * confident-looking answer over a sample. The controls stay disabled, and say
 * why, until the whole day has landed.
 *
 * THE DAY LIST COMES FROM THE CALENDAR, NOT FROM A DATE INPUT. Only days
 * carrying at least one adjudication event exist, and the record began
 * 2026-08-27 and cannot be extended backwards. A free date input would let
 * someone pick a day that can never have data and read the empty answer as
 * "DOL did nothing", which is false.
 */

/** Rows per page. 50 matches the case browsers. */
const PAGE_SIZES = [25, 50, 100, 250] as const;

const CONTROL =
  "w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";
const NAV =
  "min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";
const LABEL =
  "block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground";

/**
 * What DOL does not return on a live case, and therefore what this feed cannot
 * be filtered by.
 *
 * RENDERED, NOT OMITTED. A control that silently returns nothing teaches the
 * reader to distrust the site; a disabled one with its reason teaches them the
 * data model. Every field here exists on the DECIDED record and is filterable
 * on /perm-cases, which is where the link goes.
 */
const UNAVAILABLE: { slug: string; label: string; why: string }[] = [
  {
    slug: "wage",
    label: "Wage",
    why: "DOL returns no wage from the live case lookup. It arrives with the quarterly disclosure file, once the case is decided.",
  },
  {
    slug: "firm",
    label: "Law firm",
    why: "DOL names the attorney or agent only at publication, so a case still moving through the queue carries no firm.",
  },
  {
    slug: "state",
    label: "Worksite state",
    why: "The worksite is on the published record. The live lookup returns the employer, not where the job is.",
  },
  {
    slug: "soc",
    label: "Occupation (SOC)",
    why: "The SOC code is on the published record. The live lookup returns the job title as filed, which is free text.",
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Distinct values of one end of a transition, busiest first. */
function ends(
  feed: ChangeDayFeed | null,
  side: "fromStatus" | "toStatus",
): { status: string; n: number }[] {
  const totals = new Map<string, number>();
  for (const t of feed?.transitions ?? []) {
    totals.set(t[side], (totals.get(t[side]) ?? 0) + t.n);
  }
  return [...totals]
    .map(([status, n]) => ({ status, n }))
    .sort((a, b) => b.n - a.n || a.status.localeCompare(b.status));
}

export function ChangeFeedBrowser({
  calendar,
  initialDay,
  windows,
}: {
  calendar: ChangeCalendar;
  initialDay: ChangeDayFeed;
  /**
   * What each record can answer, measured on the server.
   *
   * PASSED IN RATHER THAN FETCHED. The page is static and already reads it
   * once per regeneration; asking again from the browser would add a request
   * per visitor for two dates that change when a quarterly file lands.
   */
  windows: CoverageWindows;
}) {
  const id = useId();
  const days = calendar.days;
  // The most recent handful, newest first. Capped because this is a shortcut,
  // not a second navigation: the date input is the way to reach any day.
  const recentDays = days.slice(0, 6);

  // `date` is the FROM end and `rangeTo` the TO end; equal means a single day,
  // which is the common case and the one the URL and the caption assume.
  const [date, setDate] = useState(initialDay.date);
  const [rangeTo, setRangeTo] = useState(initialDay.date);
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState<ChangeProgram | "">("");
  const [fromStatus, setFromStatus] = useState("");
  const [toStatus, setToStatus] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "employer", dir: 1 });
  // Its own sort: the two tables have different columns, and sharing one key
  // would silently fall back to unsorted whenever the reader switched dates
  // across the boundary.
  const [decidedSort, setDecidedSort] = useState<SortState>({
    key: "decided",
    dir: -1,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);

  // ALWAYS THE WHOLE DAY. One URL shape means one cache entry per day rather
  // than one per row cap, and it is the request that makes every control below
  // free. `limit` is clamped again on the server.
  // A backwards range is clamped rather than rejected: dragging the first date
  // past the second is an ordinary slip, and refusing it mid-edit is hostile.
  const range = useMemo(
    () => ({ from: date, to: rangeTo < date ? date : rangeTo }),
    [date, rangeTo],
  );
  const cov = useMemo(() => coverageFor(range, windows), [range, windows]);
  const span = daysInRange(range);

  // The outer bounds of everything we hold, so the native picker cannot offer
  // a date that can only ever be empty. `ceiling` is today rather than the
  // last observation: today is a legitimate question whose answer may be
  // "nothing yet".
  const starts = [windows.decided?.from, windows.observed?.from].filter(
    (v): v is string => typeof v === "string",
  );
  const floor = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : undefined;
  const ceiling = new Date().toISOString().slice(0, 10);

  // WHICH RECORD CAN ANSWER DECIDES WHICH CONTROLS ARE LIVE, per selection.
  // Not a blanket rule: the four fields below exist on every published case,
  // so on a date inside the quarterly files they work in full. They are dead
  // only on a date we merely observed, which is what `hasDecided` says.
  // Bound to a local so the narrowing survives into the template strings.
  const decidedWindow = cov.decided;
  const hasDecided = decidedWindow !== null;
  const hasObserved = cov.observed !== null;

  const decidedQuery = decidedWindow
    ? `/api/decided-cases?from=${decidedWindow.from}&to=${decidedWindow.to}&limit=1000`
    : "skip";
  const { data: decidedData, failed: decidedFailed } = usePublicQuery<{
    feed: DecidedFeed | null;
  }>(decidedQuery);
  // Only paint a response that answers the range currently on screen: a slow
  // reply for a range the reader has already moved off must not land.
  const decided =
    decidedData?.feed &&
    decidedWindow &&
    decidedData.feed.range.from === decidedWindow.from &&
    decidedData.feed.range.to === decidedWindow.to
      ? decidedData.feed
      : null;

  const { data, failed } = usePublicQuery<{ day: ChangeDayFeed | null }>(
    hasObserved && span === 1
      ? `/api/case-changes?date=${date}&limit=5000`
      : "skip",
  );

  // The full day, only when it is the day being shown: a slow response for the
  // day the reader has just navigated away from must not paint.
  const full = data?.day && data.day.date === date ? data.day : null;
  const preview = date === initialDay.date ? initialDay : null;
  const feed = full ?? preview;
  const ready = full !== null;

  const reset = () => setPage(0);


  const fromEnds = useMemo(() => ends(feed, "fromStatus"), [feed]);
  const toEnds = useMemo(() => ends(feed, "toStatus"), [feed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (feed?.changes ?? []).filter((c) => {
      if (program !== "" && c.program !== program) return false;
      if (fromStatus !== "" && c.fromStatus !== fromStatus) return false;
      if (toStatus !== "" && c.toStatus !== toStatus) return false;
      if (q === "") return true;
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        (c.employerName ?? "").toLowerCase().includes(q) ||
        (c.jobTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [feed, search, program, fromStatus, toStatus]);

  const ordered = useMemo(
    () => sortRows(filtered, CHANGE_COLUMNS, sort),
    [filtered, sort],
  );

  // The same free-text needle over the decided half. Program and status filter
  // too; the from/to status pair does not, because a decided row has one
  // status rather than a transition.
  const decidedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const kept = (decided?.cases ?? []).filter((c) => {
      if (program !== "" && c.program !== program) return false;
      if (toStatus !== "" && c.status !== toStatus) return false;
      if (q === "") return true;
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        (c.employerName ?? "").toLowerCase().includes(q) ||
        (c.jobTitle ?? "").toLowerCase().includes(q) ||
        (c.socTitle ?? "").toLowerCase().includes(q) ||
        (c.state ?? "").toLowerCase().includes(q)
      );
    });
    return sortRows(kept, DECIDED_COLUMNS, decidedSort);
  }, [decided, search, program, toStatus, decidedSort]);

  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  // Clamped rather than reset by an effect: a filter that shrinks the result
  // below the current page would otherwise render an empty table with a pager
  // insisting there are rows.
  const current = Math.min(page, pages - 1);
  const start = current * pageSize;
  const rows = ordered.slice(start, start + pageSize);

  /**
   * Move the selection one calendar day.
   *
   * BY A DAY, NOT TO THE NEXT DAY WE HOLD SOMETHING FOR. Skipping empty days
   * hides them, and "DOL decided nothing on this Sunday" is a true and useful
   * answer. The buttons keep a single-day selection single.
   */
  const shiftDay = (delta: number) => {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + delta);
    const iso = next.toISOString().slice(0, 10);
    if (floor !== undefined && iso < floor) return;
    if (iso > ceiling) return;
    setDate(iso);
    if (rangeTo === date || rangeTo < iso) setRangeTo(iso);
    reset();
  };

  const filtering =
    search.trim() !== "" || program !== "" || fromStatus !== "" || toStatus !== "";
  const capped = feed !== null && ready && feed.changes.length < feed.total;

  return (
    <div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <div>
          <label htmlFor={`${id}-day`} className={LABEL}>
            From date
          </label>{" "}
          {/* A FREE DATE INPUT, NOT A LIST OF DAYS WE HAPPEN TO HOLD.
              The old picker offered only days carrying an observed event, so
              it started 2026-08-26 and looked capped at a week. The published
              files answer any day back to 2023-10-01, which is the larger half
              of the record by three orders of magnitude. A date we hold
              nothing for is answered in words below rather than refused: an
              empty table reads as "DOL did nothing", which is a different and
              false claim. */}
          <input
            id={`${id}-day`}
            type="date"
            value={date}
            min={floor}
            max={ceiling}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setDate(v);
              // A single day is the common case, so the far end follows the
              // near one unless the reader has deliberately widened it.
              if (rangeTo === date) setRangeTo(v);
              reset();
            }}
            className={`${CONTROL} mt-1`}
          />
        </div>{" "}
        <div>
          <label htmlFor={`${id}-day-to`} className={LABEL}>
            To date
          </label>{" "}
          <input
            id={`${id}-day-to`}
            type="date"
            value={rangeTo}
            min={date}
            max={ceiling}
            aria-describedby={`${id}-span`}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setRangeTo(v);
              reset();
            }}
            className={`${CONTROL} mt-1`}
          />{" "}
          <p id={`${id}-span`} className="mt-1 text-sm text-foreground/70">
            {span === 1 ? "One day. Widen to see a range." : `${fmt(span)} days.`}
          </p>
        </div>{" "}
        {/* WHAT THE OLD PICKER WAS GOOD AT, KEPT.
            Replacing the day list with a free date input gained three years of
            reach and lost the one thing the list did well: showing at a glance
            which recent days our sweep actually recorded something on. A date
            input cannot say that, so the busiest few are one tap away. */}
        {recentDays.length > 0 ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <span className={LABEL}>Days our daily check recorded a change</span>{" "}
            <div className="mt-1 flex flex-wrap gap-2">
              {recentDays.map((d) => (
                <Fragment key={d.date}>
                  <button
                    type="button"
                    aria-pressed={date === d.date && rangeTo === d.date}
                    className={`${NAV} ${
                      date === d.date && rangeTo === d.date
                        ? "bg-foreground text-background"
                        : ""
                    }`}
                    onClick={() => {
                      setDate(d.date);
                      setRangeTo(d.date);
                      reset();
                    }}
                  >
                    {d.date} ({fmt(d.total)})
                  </button>{" "}
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <label htmlFor={`${id}-q`} className={LABEL}>
            Search these dates
          </label>{" "}
          <input
            id={`${id}-q`}
            type="search"
            value={search}
            disabled={!ready}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            placeholder="Search"
            maxLength={120}
            autoComplete="off"
            aria-describedby={`${id}-q-hint`}
            className={`${CONTROL} mt-1`}
          />{" "}
          <p id={`${id}-q-hint`} className="mt-1 text-sm text-foreground/70">
            Case number, employer, job title. Occupation and state too on
            published dates.
          </p>
        </div>{" "}
        <div>
          <label htmlFor={`${id}-from`} className={LABEL}>
            Changed from
          </label>{" "}
          <select
            id={`${id}-from`}
            value={fromStatus}
            disabled={!ready}
            onChange={(e) => {
              setFromStatus(e.target.value);
              reset();
            }}
            className={`${CONTROL} mt-1`}
          >
            <option value="">Any status</option>
            {fromEnds.map((o) => (
              <Fragment key={o.status}>
                <option value={o.status}>
                  {o.status} ({fmt(o.n)})
                </option>
              {" "}
              </Fragment>
            ))}
          </select>
        </div>{" "}
        <div>
          <label htmlFor={`${id}-to`} className={LABEL}>
            Changed to
          </label>{" "}
          <select
            id={`${id}-to`}
            value={toStatus}
            disabled={!ready}
            onChange={(e) => {
              setToStatus(e.target.value);
              reset();
            }}
            className={`${CONTROL} mt-1`}
          >
            <option value="">Any status</option>
            {toEnds.map((o) => (
              <Fragment key={o.status}>
                <option value={o.status}>
                  {o.status} ({fmt(o.n)})
                </option>
              {" "}
              </Fragment>
            ))}
          </select>
        </div>
      </div>{" "}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <div>
          <label htmlFor={`${id}-program`} className={LABEL}>
            Program
          </label>{" "}
          <select
            id={`${id}-program`}
            value={program}
            disabled={!ready}
            onChange={(e) => {
              setProgram(e.target.value as ChangeProgram | "");
              reset();
            }}
            className={`${CONTROL} mt-1`}
          >
            <option value="">All programs ({fmt(feed?.total ?? 0)})</option>
            {CHANGE_PROGRAMS.map((p) => {
              const n = feed?.byProgram[p] ?? 0;
              return (
                <Fragment key={p}>
                  {/* Disabled rather than hidden: a program with nothing on this
                      day is a fact about the day, and hiding it would read as
                      the program not existing. */}
                  <option value={p} disabled={n === 0}>
                    {PROGRAM_LABEL[p]} ({fmt(n)})
                  </option>
                {" "}
                </Fragment>
              );
            })}
          </select>
        </div>{" "}
        <div>
          <label htmlFor={`${id}-size`} className={LABEL}>
            Rows per page
          </label>{" "}
          <select
            id={`${id}-size`}
            value={pageSize}
            disabled={!ready}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              reset();
            }}
            className={`${CONTROL} mt-1`}
          >
            {PAGE_SIZES.map((n) => (
              <Fragment key={n}>
                <option value={n}>{n}</option>
              {" "}
              </Fragment>
            ))}
          </select>
        </div>{" "}
        <div className="flex items-end gap-3 sm:col-span-2">
          <button
            type="button"
            className={NAV}
            disabled={floor !== undefined && date <= floor}
            onClick={() => shiftDay(-1)}
          >
            Earlier day
          </button>{" "}
          <button
            type="button"
            className={NAV}
            disabled={date >= ceiling}
            onClick={() => shiftDay(1)}
          >
            Later day
          </button>{" "}
          <button
            type="button"
            className={NAV}
            disabled={!filtering}
            onClick={() => {
              setSearch("");
              setProgram("");
              setFromStatus("");
              setToStatus("");
              reset();
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* WHAT THE CHOSEN DATES CAN ACTUALLY ANSWER.
          Stated before any table, because an empty table and a date we hold
          nothing for look identical and mean opposite things. */}
      <div className="mt-6 border-2 border-border bg-tint-primary p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          What these dates can answer
        </p>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          {hasDecided && hasObserved ? (
            <>
              This range crosses both records. DOL&apos;s published files cover{" "}
              <strong>{decidedWindow?.from}</strong> to{" "}
              <strong>{decidedWindow?.to}</strong>, with the wage, worksite and
              occupation on every case. Our own daily check covers{" "}
              <strong>{cov.observed?.from}</strong> to{" "}
              <strong>{cov.observed?.to}</strong>, which is the only record of
              anything still moving. Both are below, kept apart.
            </>
          ) : hasDecided ? (
            <>
              DOL published these decisions, so every filter and column works,
              including the wage, the worksite state and the occupation.
            </>
          ) : hasObserved ? (
            <>
              These dates are newer than DOL&apos;s last published file, so what
              follows is what our daily check saw change. DOL returns five
              fields on a case that is still moving, so the wage, law firm,
              worksite and occupation are not available for these dates.
            </>
          ) : (
            <>We hold nothing for these dates.</>
          )}
          {cov.uncoveredDays > 0 && (hasDecided || hasObserved) ? (
            <>
              {" "}
              <strong>{fmt(cov.uncoveredDays)}</strong> of the{" "}
              {fmt(cov.totalDays)} days selected fall between the two records
              and are not covered by either.
            </>
          ) : null}
        </p>
        {!hasDecided && !hasObserved ? (
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            DOL&apos;s published files run to{" "}
            <strong>{windows.decided?.to ?? "no loaded file"}</strong> and our
            own record starts{" "}
            <strong>{windows.observed?.from ?? "not yet"}</strong>. Dates
            between the two are a genuine gap, and it closes from the left when
            DOL publishes its next quarterly file. This is not a claim that DOL
            did nothing.
          </p>
        ) : null}
      </div>

      {/* THE DISABLED-FILTER EXPLANATION, AND ONLY WHEN IT APPLIES.
          It used to be a permanent panel of four dead controls, which said
          these fields can never be filtered. They can: they exist on every
          published case. They are dead only on dates we merely observed.

          `key` forces a remount when that flips, so the panel re-opens itself
          on a date that needs the explanation and closes on one that does not
          - while still letting the reader toggle it within a selection. An
          `open` prop alone would stick at its first value. */}
      <details
        key={hasDecided ? "filters-live" : "filters-off"}
        open={!hasDecided}
        className="mt-4 border-2 border-border bg-card"
      >
        <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary">
          {hasDecided
            ? "Wage, law firm, worksite and occupation: available for these dates"
            : "Why wage, law firm, worksite and occupation are off for these dates"}
        </summary>{" "}
        <div className="border-t-2 border-border px-4 py-3">
          <p className="text-base leading-relaxed text-foreground/80">
            {hasDecided ? (
              <>
                These four arrive with the quarterly disclosure file, and the
                dates you picked are inside it, so they are filterable and
                sortable here and on the{" "}
                <Link
                  href="/perm-cases"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  decided case browser
                </Link>
                .
              </>
            ) : (
              <>
                DOL returns five fields on a case that is still moving: the
                number, the employer, the job title, the filing date and the
                status. The four below arrive only when the case is published in
                a quarterly file. Pick a date inside the published range and
                they switch on, or use the{" "}
                <Link
                  href="/perm-cases"
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  decided case browser
                </Link>
                .
              </>
            )}
          </p>
          {!hasDecided ? (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {UNAVAILABLE.map((u) => (
                <Fragment key={u.slug}>
                  <li className="border-2 border-border/40 p-3">
                    <span className={LABEL}>{u.label}</span>{" "}
                    <span className="mt-1 block text-sm leading-relaxed text-foreground/80">
                      {u.why}
                    </span>
                  </li>{" "}
                </Fragment>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      {hasDecided ? (
        <section className="mt-8">
          <h3 className="font-heading text-xl font-bold">
            {span === 1
              ? `Decided on ${longDate(range.from)}`
              : `Decided between ${longDate(decidedWindow?.from ?? range.from)} and ${longDate(decidedWindow?.to ?? range.to)}`}
          </h3>{" "}
          {decided ? (
            <>
              <p className="mt-2 text-base leading-relaxed text-foreground/80">
                {decided.totals ? (
                  <>
                    DOL decided {fmt(
                      decided.totals.perm + decided.totals.pwd + decided.totals.lca,
                    )}{" "}
                    cases: {fmt(decided.totals.perm)} PERM,{" "}
                    {fmt(decided.totals.pwd)} wage requests and{" "}
                    {fmt(decided.totals.lca)} LCAs. From DOL&apos;s published
                    quarterly file, so each carries its wage, worksite and
                    occupation.
                  </>
                ) : (
                  <>
                    Showing {fmt(decidedRows.length)} of the decisions in this
                    range. An exact total is not counted across a range, because
                    counting one walks every row in it.
                  </>
                )}
                {decided.capped ? (
                  <>
                    {" "}
                    The list is cut at {fmt(1000)} rows per program; narrow the
                    dates to see the rest.
                  </>
                ) : null}
              </p>
              {decidedRows.length === 0 ? (
                <p className="mt-4 border-2 border-border bg-card p-4 text-base">
                  DOL published no decisions for these dates. That is a real
                  answer, not a missing one.
                </p>
              ) : (
                <DecidedTable
                  rows={decidedRows}
                  sort={decidedSort}
                  onSort={(k) =>
                    setDecidedSort((cur) => nextSort(cur, k, DECIDED_COLUMNS))
                  }
                  caption={`Cases DOL decided, with the outcome, wage, worksite and occupation on each`}
                />
              )}
            </>
          ) : decidedFailed ? (
            <p className="mt-4 border-2 border-border bg-tint-primary p-4 text-base">
              Those decisions could not be loaded just now. Reloading usually
              clears it.
            </p>
          ) : (
            <p className="mt-4 text-base text-foreground/80" role="status">
              Loading decisions for these dates…
            </p>
          )}
        </section>
      ) : null}

      {!hasObserved || span !== 1 ? null : feed ? (
        <div className="mt-6">
          <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
            {feed.transitions.map((t) => {
              const on = fromStatus === t.fromStatus && toStatus === t.toStatus;
              return (
                <Fragment key={`${t.fromStatus}>${t.toStatus}`}>
                  <li>
                    <button
                      type="button"
                      disabled={!ready}
                      aria-pressed={on}
                      onClick={() => {
                        setFromStatus(on ? "" : t.fromStatus);
                        setToStatus(on ? "" : t.toStatus);
                        reset();
                      }}
                      className={
                        "min-h-[44px] border-2 border-border px-3 py-2 text-sm hover:bg-tint-primary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary " +
                        (on ? "bg-foreground text-background" : "bg-card")
                      }
                    >
                      <span className={on ? "text-background/70" : "text-foreground/70"}>
                        {t.fromStatus}
                      </span>{" "}
                      <span aria-hidden="true">&rarr;</span>{" "}
                      <span className="font-bold">{t.toStatus}</span>{" "}
                      <b className="ml-1 font-black tabular-nums">{fmt(t.n)}</b>
                    </button>
                  </li>{" "}
                </Fragment>
              );
            })}
          </ul>{" "}
          <p className="text-base text-foreground/80" aria-live="polite">
            {/* TRUE WITH THE SCRIPT BROKEN, TOO. This branch is what the
                prerendered HTML carries, and it is also what a reader with no
                JavaScript keeps: the sentence therefore says what is on screen
                and what the controls need, rather than promising a load that
                may never happen. */}
            {!ready ? (
              <>
                Showing the first {fmt(feed.changes.length)} of{" "}
                {fmt(feed.total)} changes observed on {longDate(feed.date)}.
                Search, filters and sorting read the whole day, so they switch on
                once the rest of it has loaded
                {failed ? ", and that request did not arrive. Reloading usually clears it" : ""}
                .
              </>
            ) : (
              <>
                {fmt(ordered.length)}{" "}
                {ordered.length === 1 ? "change" : "changes"}
                {filtering ? ` of ${fmt(feed.total)}` : ""} on{" "}
                {longDate(feed.date)}
                {ordered.length > pageSize
                  ? `. Rows ${fmt(start + 1)} to ${fmt(start + rows.length)}.`
                  : "."}
              </>
            )}
          </p>
          {capped ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              This day holds {fmt(feed.total)} changes and the feed carries the
              first {fmt(feed.changes.length)} of them, ordered by employer.
              Search and sorting cover the loaded rows.
            </p>
          ) : null}
          {/* THE EXCLUSIONS ARE PER DAY, SO THEY LIVE HERE AND NOT ON THE PAGE.
              Rendered once on the server they would keep describing the day the
              page was built for while the reader looked at a different one, and
              a disclosure that names the wrong day is worse than none. */}
          {feed.expiriesExcluded > 0 || feed.bulkExcluded > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Left out of that count:{" "}
              {feed.expiriesExcluded > 0 ? (
                <>
                  {fmt(feed.expiriesExcluded)} certifications whose 180-day
                  I-140 window lapsed, because a clock running out is not DOL
                  acting on a case
                </>
              ) : null}
              {feed.expiriesExcluded > 0 && feed.bulkExcluded > 0 ? "; " : ""}
              {feed.bulkExcluded > 0 ? (
                <>
                  {fmt(feed.bulkExcluded)} rows written under a single timestamp
                  carrying more than 5,000 changes, which is a scan catching up
                  on months of history rather than a day of adjudication
                </>
              ) : null}
              .
            </p>
          ) : null}
          {ordered.length === 0 && ready ? (
            <p className="mt-4 border-2 border-border bg-card p-4 text-base">
              Nothing on {longDate(feed.date)} matches that. The day itself
              holds {fmt(feed.total)} changes, so clearing the filters will
              bring them back.
            </p>
          ) : (
            <ChangeTable
              rows={rows}
              sortable={ready}
              sort={sort}
              onSort={(k) => {
                setSort((cur) => nextSort(cur, k, CHANGE_COLUMNS));
                reset();
              }}
              caption={`Cases DOL moved on ${longDate(feed.date)}, with the status each moved from and to`}
            />
          )}
          {pages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={NAV}
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </button>{" "}
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Page {fmt(current + 1)} of {fmt(pages)}
              </span>{" "}
              <button
                type="button"
                className={NAV}
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : failed ? (
        <p className="mt-6 border-2 border-border bg-tint-primary p-4 text-base">
          That day could not be loaded just now. The other days still work, and
          reloading usually clears it.
        </p>
      ) : (
        <p className="mt-6 text-base text-foreground/80" role="status">
          Loading that day&apos;s changes…
        </p>
      )}
    </div>
  );
}
