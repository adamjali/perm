"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { RequestFailed } from "@/components/tools/RequestFailed";
import { Pagination } from "@/components/ui/pagination";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { useUrlPatch, useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { INITIAL_RE } from "@/lib/employerInitial";
import { entityHref } from "@/lib/entityPayload";
import { DAY_PAGE_SIZE, DAY_SORTS, dayView, type DayCase, type DaySort } from "@/lib/filingDay";
import { PROGRAM_NAMES, type FilingProgram } from "@/lib/filingsByDay";
import { formatInt } from "@/lib/format";
import { CASE_STATUS_FILL, caseStatusTint, prettyStatus } from "@/lib/statusTone";
import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

/**
 * One filing day's cases, every program (owner, Oct 27 2026: a month opened down to the
 * cases; Nov 5 2026: every program, DOL's live record and its files together, searched and
 * sorted). Every status leads as a bar in the site's status colours and as chips that filter
 * the list; the employer's first letter narrows it, words search the case number, employer and
 * job, and the order can change. Picks and the page live in the address
 * (`?kind=lca&status=...&letter=B&q=amazon&sort=decided&page=2`), so a link can open any view.
 * PERM cases and wage requests come from the server; LCAs and the seasonal programs, a few
 * thousand a day, load when a reader opens them.
 */

const KINDS: readonly FilingProgram[] = ["perm", "pwd", "lca", "seasonal"];
const LABEL: Record<FilingProgram, string> = {
  perm: "PERM cases",
  pwd: "Wage requests",
  lca: "H-1B LCAs",
  seasonal: "H-2A, H-2B and CW-1",
};

const CHIP = "inline-flex min-h-11 items-center gap-2 border-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const fill = (status: string) => CASE_STATUS_FILL[caseStatusTint(status)];

type Remote = { cases: DayCase[]; capped: boolean };

export function FiledOnDay({
  perm,
  pwd,
  dayLabel,
  day,
  counts,
}: {
  perm: DayCase[];
  pwd: DayCase[];
  dayLabel: string;
  /** The day, `YYYY-MM-DD`: with it the LCA and seasonal tabs load from /api/filed-on. */
  day?: string;
  /** The day's counts from the filings document, for the tabs that load on demand. */
  counts?: Partial<Record<FilingProgram, number>>;
}) {
  const params = useUrlSearchParams();
  const patch = useUrlPatch();
  const kinds = day ? KINDS : KINDS.filter((k) => k === "perm" || k === "pwd");
  const fallback: FilingProgram = perm.length > 0 || pwd.length === 0 ? "perm" : "pwd";
  const asked = params.get("kind");
  const kind: FilingProgram = kinds.includes(asked as FilingProgram) ? (asked as FilingProgram) : fallback;
  const status = params.get("status") || null;
  const letterRaw = params.get("letter");
  const letter = letterRaw && INITIAL_RE.test(letterRaw) ? letterRaw : null;
  const sortRaw = params.get("sort");
  const sort: DaySort = DAY_SORTS.some((s) => s.key === sortRaw) ? (sortRaw as DaySort) : "employer";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const top = useRef<HTMLDivElement>(null);

  // The search box writes the address as the reader types, and follows it back (a link, Back).
  const q = params.get("q") ?? "";
  const [typed, setTyped] = useState(q);
  const [seen, setSeen] = useState(q);
  if (q !== seen) {
    setSeen(q);
    setTyped(q);
  }

  const lazy = kind === "lca" || kind === "seasonal";
  const remote = usePublicQuery<Remote>(day && lazy ? `/api/filed-on?day=${day}&program=${kind}` : "skip");
  const loaded = lazy ? remote.data : undefined;
  const cases = kind === "perm" ? perm : kind === "pwd" ? pwd : (loaded?.cases ?? []);
  const view = dayView(cases, { status, letter, page, q, sort });
  const countOf = (k: FilingProgram) =>
    k === "perm" ? perm.length : k === "pwd" ? pwd.length : k === kind && loaded ? loaded.cases.length : counts?.[k];

  // A pick starts the list from its first page; the default kind leaves the address clean.
  const reset = (k: FilingProgram) =>
    patch({ kind: k === fallback ? null : k, status: null, letter: null, q: null, page: null });
  const pick = (p: Record<string, string | null>) => patch({ ...p, page: null });

  // Typing waits a moment before it moves the address, so each key isn't a history entry.
  useEffect(() => {
    if (typed === q) return;
    const t = setTimeout(() => patch({ q: typed.trim() ? typed : null, page: null }), 250);
    return () => clearTimeout(t);
  }, [typed, q, patch]);

  const noun = PROGRAM_NAMES[kind].plural;

  return (
    <div ref={top} className="scroll-mt-24">
      <div role="group" aria-label="Which filings" className="flex flex-wrap gap-2">
        {kinds.map((k) => {
          const n = countOf(k);
          return (
            <Fragment key={k}>
              <button type="button" aria-pressed={kind === k} onClick={() => reset(k)} className={choiceVariants({ on: kind === k })}>
                {LABEL[k]} {n === undefined ? null : <span className="font-mono tabular-nums">{formatInt(n)}</span>}
              </button>{" "}
            </Fragment>
          );
        })}
      </div>{" "}
      {lazy && remote.failed ? (
        <RequestFailed className="mt-6 bg-tint p-4 border-2 border-border" what={`The ${LABEL[kind]} for ${dayLabel}`} failure={remote.failure} onRetry={remote.retry} />
      ) : lazy && !loaded ? (
        <p className="mt-6 text-base text-soft" role="status">
          Loading the {noun} filed on {dayLabel}.
        </p>
      ) : cases.length === 0 ? (
        <p className="mt-6 text-base text-soft">DOL&apos;s record holds none filed on {dayLabel}.</p>
      ) : (
        <>
          {/* The day by status, every case one sliver of the bar. */}
          <div aria-hidden="true" className="mt-6 flex h-6 w-full overflow-hidden border-2 border-foreground">
            {view.statuses.map((s) => (
              <span key={s.status} className={cn("h-full border-r-2 border-foreground last:border-r-0", fill(s.status))} style={{ width: `${(s.n / cases.length) * 100}%` }} />
            ))}
          </div>{" "}
          <div role="group" aria-label="Status" className="mt-4 flex flex-wrap gap-2">
            {view.statuses.map((s) => (
              <Fragment key={s.status}>
                <button
                  type="button"
                  aria-pressed={status === s.status}
                  onClick={() => pick({ status: status === s.status ? null : s.status })}
                  className={cn(CHIP, status === s.status ? "border-foreground" : "border-transparent", fill(s.status))}
                >
                  {prettyStatus(s.status)} <span className="font-mono tabular-nums">{formatInt(s.n)}</span>
                </button>{" "}
              </Fragment>
            ))}
          </div>{" "}
          <div role="group" aria-label="Employer's first letter" className="mt-3 flex flex-wrap gap-1">
            {view.letters.map((l) => (
              <Fragment key={l.letter}>
                <button
                  type="button"
                  aria-pressed={letter === l.letter}
                  aria-label={`${l.letter === "#" ? "A digit or symbol" : l.letter}, ${l.n} ${l.n === 1 ? "case" : "cases"}`}
                  onClick={() => pick({ letter: letter === l.letter ? null : l.letter })}
                  className={cn(choiceVariants({ on: letter === l.letter }), "min-w-11 px-2 font-mono")}
                >
                  {l.letter}
                </button>{" "}
              </Fragment>
            ))}
          </div>{" "}
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1 text-sm font-semibold">
              Search the day
              <input
                type="search"
                name="q"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Case number, employer or job"
                className="min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base font-normal"
              />
            </label>{" "}
            <label className="flex min-w-0 flex-[0_1_14rem] flex-col gap-1 text-sm font-semibold">
              Order
              <select
                name="sort"
                value={sort}
                onChange={(e) => pick({ sort: e.target.value === "employer" ? null : e.target.value })}
                className="min-h-11 w-full min-w-0 border-2 border-input bg-background px-2 text-base font-normal"
              >
                {DAY_SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>{" "}
          <p className="mt-5 text-sm text-soft" aria-live="polite">
            {formatInt(view.total)} of {formatInt(cases.length)} {noun}
            {status ? `, ${prettyStatus(status)}` : ""}
            {letter ? `, employers under ${letter}` : ""}
            {q.trim() ? `, matching “${q.trim()}”` : ""}
          </p>{" "}
          <ul className="mt-2 divide-y-2 divide-border border-y-2 border-border">
            {view.rows.map((r) => (
              <li key={r.caseNumber} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-center [&>*]:min-w-0">
                <Link href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} className="link inline-flex min-h-11 items-center font-mono text-sm">
                  {r.caseNumber}
                </Link>{" "}
                <span className="leading-snug">
                  {r.employer && r.employerSlug ? (
                    <Link href={entityHref("employer", r.employerSlug)} className="link block font-semibold">
                      {r.employer}
                    </Link>
                  ) : (
                    <span className="block font-semibold">{r.employer || "Employer not named"}</span>
                  )}{" "}
                  <span className="block text-sm text-soft">{r.jobTitle}</span>{" "}
                  <CaseFacts c={r} />
                </span>{" "}
                <span className={cn("justify-self-start px-2 py-1 text-sm font-semibold", fill(r.status))}>{prettyStatus(r.status)}</span>{" "}
              </li>
            ))}
          </ul>{" "}
          {lazy && loaded?.capped ? (
            <p className="mt-4 text-sm text-soft">This day holds more than the list shows; it lists the first of them by employer.</p>
          ) : null}
          {view.pageCount > 1 ? (
            <Pagination
              className="mt-6"
              page={view.page}
              pageCount={view.pageCount}
              onPage={(n) => patch({ page: n > 1 ? String(n) : null })}
              total={view.total}
              perPage={DAY_PAGE_SIZE}
              noun={kind === "perm" ? "cases" : "filings"}
              scrollTo={top}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/** What DOL's file adds to a case: its decision day, the worksite, the wage, and where the case is held. */
function CaseFacts({ c }: { c: DayCase }) {
  const facts = [
    c.decided ? `Decided ${longDate(c.decided) ?? c.decided}` : null,
    c.state,
    c.wage,
    c.source === "file" ? "Only in DOL's published files" : null,
    c.fileDate ? `DOL's file dates it ${longDate(c.fileDate) ?? c.fileDate}` : null,
  ].filter(Boolean);
  if (facts.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-4 text-sm text-soft">
      {facts.map((f) => (
        <Fragment key={f}>
          <span>{f}</span>{" "}
        </Fragment>
      ))}
    </span>
  );
}
