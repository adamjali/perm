"use client";

import { Fragment, useId, useMemo, useState } from "react";

// One line, deliberately: no-server-only-in-client.test.ts checks each import line on its own.
import type { Debarment, DebarmentPhase, DebarmentProgram } from "@/lib/turso/debarments";

export type DebarmentView = Debarment & { phase: DebarmentPhase };

export interface ProgramSection {
  program: DebarmentProgram;
  label: string;
  /** DOL's own list for the program. */
  sourceUrl: string;
  /** The sentence for a program with nothing listed. */
  emptyNote: string;
}

export type DebarmentStatus = "" | DebarmentPhase;
export type DebarmentSort = "start" | "end" | "name";

export interface DebarmentQuery {
  text: string;
  status: DebarmentStatus;
  type: string;
  sort: DebarmentSort;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const day = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const int = (n: number) => n.toLocaleString("en-US");
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const CONTROL =
  "mt-1 block w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const LABEL = "block text-sm font-bold";

/**
 * The rows a query keeps, in the order it asks for. Searched across the name,
 * the place, the violation and the citation, because "is my sponsor on here"
 * is asked by name and "who was barred for failing an audit" by violation.
 */
export function filterDebarments(rows: readonly DebarmentView[], q: DebarmentQuery): DebarmentView[] {
  const needle = q.text.trim().toLowerCase();
  const kept = rows.filter(
    (d) =>
      (!q.status || d.phase === q.status) &&
      (!q.type || d.entityType === q.type) &&
      (!needle ||
        [d.entity, d.location, d.violation, d.citation].some((f) => f?.toLowerCase().includes(needle))),
  );
  const by: Record<DebarmentSort, (a: DebarmentView, b: DebarmentView) => number> = {
    start: (a, b) => b.startDate.localeCompare(a.startDate) || a.entity.localeCompare(b.entity),
    end: (a, b) => a.endDate.localeCompare(b.endDate) || a.entity.localeCompare(b.entity),
    name: (a, b) => a.entity.localeCompare(b.entity) || b.startDate.localeCompare(a.startDate),
  };
  return [...kept].sort(by[q.sort]);
}

function Row({ d }: { d: DebarmentView }) {
  // An ENDED debarment is history and is dimmed. An UPCOMING one is not: it is
  // a live warning about a sponsor who is about to be barred, so it keeps full
  // contrast and says so.
  return (
    <li className={`grid grid-cols-1 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_minmax(0,14rem)] sm:gap-x-4 ${d.phase === "ended" ? "text-foreground/60" : ""}`}>
      <div>
        <span className="font-bold">{d.entity}</span>{" "}
        {d.entityType ? <span className="text-sm text-foreground/70">{d.entityType}</span> : null}{" "}
        {d.location ? <span className="text-sm text-foreground/70">· {d.location}</span> : null}
      </div>{" "}
      <div className="font-mono text-xs tabular-nums">
        {day(d.startDate)} to {day(d.endDate)}
        {d.phase === "ended" ? " (ended)" : null}
        {/* The start date is already the first half of this cell, so the
            label says the STATE rather than repeating it. */}
        {d.phase === "upcoming" ? <span className="font-bold text-foreground"> (not started)</span> : null}
      </div>{" "}
      <div className="text-sm">
        {d.violation ?? ""}
        {d.citation ? <span className="text-foreground/60"> · {d.citation}</span> : null}
      </div>
    </li>
  );
}

/**
 * Every list, searchable and filterable, still grouped by program as DOL
 * publishes them. With JavaScript off the server-rendered lists are the whole
 * record, so nothing is hidden behind a control.
 */
export function DebarmentBrowser({ rows, sections }: { rows: DebarmentView[]; sections: ProgramSection[] }) {
  const id = useId();
  const [q, setQ] = useState<DebarmentQuery>({ text: "", status: "", type: "", sort: "start" });
  const types = useMemo(
    () => [...new Set(rows.map((d) => d.entityType).filter((t): t is string => !!t))].sort(),
    [rows],
  );
  const shown = useMemo(() => filterDebarments(rows, q), [rows, q]);
  const narrowed = q.text.trim() !== "" || q.status !== "" || q.type !== "";

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 border-2 border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <label className="block lg:col-span-2" htmlFor={`${id}-q`}>
          <span className={LABEL}>Search the lists</span>{" "}
          <input
            id={`${id}-q`}
            type="search"
            value={q.text}
            maxLength={120}
            autoComplete="off"
            placeholder="Name, place or violation"
            onChange={(e) => setQ({ ...q, text: e.target.value })}
            className={CONTROL}
          />
        </label>{" "}
        <label className="block" htmlFor={`${id}-status`}>
          <span className={LABEL}>Status today</span>{" "}
          <select
            id={`${id}-status`}
            value={q.status}
            onChange={(e) => setQ({ ...q, status: e.target.value as DebarmentStatus })}
            className={CONTROL}
          >
            <option value="">{"Any "}</option>
            <option value="in-force">{"In force "}</option>
            <option value="upcoming">{"Ordered, not started "}</option>
            <option value="ended">{"Ended "}</option>
          </select>
        </label>{" "}
        <label className="block" htmlFor={`${id}-sort`}>
          <span className={LABEL}>Order</span>{" "}
          <select
            id={`${id}-sort`}
            value={q.sort}
            onChange={(e) => setQ({ ...q, sort: e.target.value as DebarmentSort })}
            className={CONTROL}
          >
            <option value="start">{"Newest bar first "}</option>
            <option value="end">{"Ending soonest first "}</option>
            <option value="name">{"Name, A to Z "}</option>
          </select>
        </label>{" "}
        {types.length > 1 ? (
          <label className="block" htmlFor={`${id}-type`}>
            <span className={LABEL}>Who was barred</span>{" "}
            <select
              id={`${id}-type`}
              value={q.type}
              onChange={(e) => setQ({ ...q, type: e.target.value })}
              className={CONTROL}
            >
              <option value="">{"Anyone "}</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {`${t} `}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>{" "}
      {narrowed ? (
        <p className="mt-3 text-base text-foreground/80" role="status">
          {shown.length === 0
            ? "Nothing on DOL's lists matches that. Try part of the name: DOL prints each entity its own way."
            : `${int(shown.length)} of ${int(rows.length)} entries match.`}
        </p>
      ) : null}
      {sections.map((s) => {
        const all = rows.filter((d) => d.program === s.program);
        const list = shown.filter((d) => d.program === s.program);
        if (narrowed && list.length === 0) return null;
        return (
          <Fragment key={s.program}>
            {" "}
            <section className="mt-10">
              <h2 className="font-heading text-xl font-black sm:text-2xl">{s.label}</h2>{" "}
              <p className="mt-1 text-sm text-foreground/70">
                {all.length === 0
                  ? `${s.emptyNote} `
                  : `${int(all.filter((d) => d.phase === "in-force").length)} in force, ${int(all.length)} listed${narrowed ? `, ${int(list.length)} shown` : ""}. `}
                <a href={s.sourceUrl} className={LINK} rel="noopener" target="_blank">
                  DOL&apos;s list
                </a>
              </p>{" "}
              {list.length > 0 ? (
                <ul className="mt-3 divide-y-2 divide-border border-y-2 border-border">
                  {list.map((d) => (
                    <Fragment key={`${d.program}-${d.entity}-${d.startDate}`}>
                      {" "}
                      <Row d={d} />
                    </Fragment>
                  ))}
                </ul>
              ) : null}
            </section>
          </Fragment>
        );
      })}
    </>
  );
}
