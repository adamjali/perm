"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import { DAY_PAGE_SIZE, dayView, type DayCase } from "@/lib/filingDay";
import { formatInt } from "@/lib/format";
import { CASE_STATUS_FILL, caseStatusTint, prettyStatus } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

/**
 * One filing day's cases, PERM and wage requests (owner, Oct 27 2026: a month opened down
 * to the cases). Every status leads as a bar in the site's status colours and as chips that
 * filter the list; the employer's first letter narrows it too. Picks and the page are the
 * reader's own; the day's rows come from the server.
 */

const KINDS = [
  { key: "perm", label: "PERM cases" },
  { key: "pwd", label: "Wage requests" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

const CHIP = "inline-flex min-h-11 items-center gap-2 border-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const fill = (status: string) => CASE_STATUS_FILL[caseStatusTint(status)];

export function FiledOnDay({ perm, pwd, dayLabel }: { perm: DayCase[]; pwd: DayCase[]; dayLabel: string }) {
  const [kind, setKind] = useState<Kind>(perm.length > 0 || pwd.length === 0 ? "perm" : "pwd");
  const [status, setStatus] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  const cases = kind === "perm" ? perm : pwd;
  const view = dayView(cases, { status, letter, page });
  const reset = (k: Kind) => {
    setKind(k);
    setStatus(null);
    setLetter(null);
    setPage(1);
  };

  return (
    <div ref={top} className="scroll-mt-24">
      <div role="group" aria-label="Which filings" className="inline-flex border-2 border-foreground">
        {KINDS.map((k) => (
          <Fragment key={k.key}>
            <button
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => reset(k.key)}
              className={cn("min-h-11 px-4 text-sm font-semibold", kind === k.key ? "bg-foreground text-background" : "bg-background")}
            >
              {k.label} <span className="font-mono tabular-nums">{formatInt(k.key === "perm" ? perm.length : pwd.length)}</span>
            </button>{" "}
          </Fragment>
        ))}
      </div>{" "}
      {cases.length === 0 ? (
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
                  onClick={() => {
                    setStatus(status === s.status ? null : s.status);
                    setPage(1);
                  }}
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
                  onClick={() => {
                    setLetter(letter === l.letter ? null : l.letter);
                    setPage(1);
                  }}
                  className={cn(
                    "min-h-11 min-w-11 border-2 px-2 font-mono text-sm font-semibold",
                    letter === l.letter ? "border-foreground bg-foreground text-background" : "border-input bg-background",
                  )}
                >
                  {l.letter}
                </button>{" "}
              </Fragment>
            ))}
          </div>{" "}
          <p className="mt-5 text-sm text-soft" aria-live="polite">
            {formatInt(view.total)} of {formatInt(cases.length)} {kind === "perm" ? "PERM cases" : "wage requests"}
            {status ? `, ${prettyStatus(status)}` : ""}
            {letter ? `, employers under ${letter}` : ""}
          </p>{" "}
          <ul className="mt-2 divide-y-2 divide-border border-y-2 border-border">
            {view.rows.map((r) => (
              <li key={r.caseNumber} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-center [&>*]:min-w-0">
                <Link href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} className="link inline-flex min-h-11 items-center font-mono text-sm">
                  {r.caseNumber}
                </Link>{" "}
                <span className="leading-snug">
                  <span className="block font-semibold">{r.employer || "Employer not named"}</span>{" "}
                  <span className="block text-sm text-soft">{r.jobTitle}</span>
                </span>{" "}
                <span className={cn("justify-self-start px-2 py-1 text-sm font-semibold", fill(r.status))}>{prettyStatus(r.status)}</span>{" "}
              </li>
            ))}
          </ul>{" "}
          {view.pageCount > 1 ? (
            <Pagination
              className="mt-6"
              page={view.page}
              pageCount={view.pageCount}
              onPage={setPage}
              total={view.total}
              perPage={DAY_PAGE_SIZE}
              noun={kind === "perm" ? "cases" : "requests"}
              scrollTo={top}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
