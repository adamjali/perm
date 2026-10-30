"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";

import { usePublicQuery } from "@/hooks/usePublicQuery";
import { Pager } from "@/components/ui/pager";
import { PendingLink } from "@/components/ui/pending-link";
import { formatMonth } from "@/lib/dolFormat";
// Type-only: `@/lib/db/liveCases` imports `server-only`, and a value import
// here would be a build error. A type import compiles to nothing.
import type { LiveKind, LiveListPage, LiveRemainderSummary, LiveSort } from "@/lib/db/liveCases";
import { RequestFailed } from "@/components/tools/RequestFailed";
import { INITIAL_RE, OTHER_INITIAL } from "@/lib/employerInitial";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { CaseStatusChip } from "@/components/ui/badge";
import { choiceVariants } from "@/components/ui/choice";
import { ISO_MONTH_RE } from "@convex/lib/months";
import { entityHref } from "@/lib/entityPayload";

/**
 * The live half of the case corpus, browsable.
 *
 * WHY. The published table above this ends on the last day of DOL's last
 * quarterly file, so a visitor who only scrolls concludes the site is two
 * months stale, while the corpus holds tens of thousands of newer decisions
 * and every pending case. The site's rule is that every page listing cases
 * answers from BOTH halves, labelled; search and the employer pages did, the
 * browse table did not. This is the missing half, kept as its own section
 * rather than poured into the published table, because the two halves do
 * not have the same columns and a "Decided" cell that is blank for 40,000
 * rows is not honesty, it is noise.
 *
 * WHAT A ROW CAN SAY. DOL's daily per-case check returns status, employer,
 * job title and filing date. No wage, firm, state or decision date; those
 * arrive when DOL publishes the case. "Seen" is the day THIS SITE first saw
 * the decision, printed as such, and blank for cases already decided when
 * the corpus was seeded.
 *
 * SMALL COHORTS. A month filter that leaves fewer than SMALL_COHORT rows
 * prints the count and withholds the rows, the same floor the review-stage
 * pages use: a case number beside an employer and a job title, in a cohort
 * of three, is a person.
 */

const PAGE_SIZE = 50;

const KIND_LABEL: Record<LiveKind, string> = {
  all: "All",
  pending: "Still waiting",
  decided: "Decided",
};

/** `2026-06-30` to `June 30, 2026`. */
function longDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}


export function LiveCaseBrowser({
  summary,
  publishedThrough,
  fixedMonth,
  seed,
}: {
  summary: LiveRemainderSummary | null;
  /** The published table's last decision date, for the headline. */
  publishedThrough: string | null;
  /** Pin the month (the queue-month pages): the month control is hidden and the filter cannot change. */
  fixedMonth?: string;
  /** The first page, server-rendered, so the rows read before hydration and the first fetch is skipped. */
  seed?: LiveListPage | null;
}) {
  const params = useUrlSearchParams();
  // `?filed=YYYY-MM` is how the month pages hand a cohort to this list.
  const filedParam = params.get("filed");
  const initialMonth =
    fixedMonth ?? (filedParam && ISO_MONTH_RE.test(filedParam) ? filedParam : "");
  // `?letter=B` is how a month page's first-letter grid opens its employers from one letter.
  const letterParam = params.get("letter");
  const [letter, setLetter] = useState<string>(letterParam && INITIAL_RE.test(letterParam) ? letterParam : "");

  const [kind, setKind] = useState<LiveKind>("all");
  const [month, setMonth] = useState<string>(initialMonth);
  const [cursors, setCursors] = useState<string[]>([]);
  const liveTop = useRef<HTMLElement>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<LiveSort>("filed");
  // Search settles 300ms after the last keystroke, and only at 2+ characters
  // (the route refuses shorter), so a person typing does not fire a request
  // per letter.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim().length >= 2 ? qInput.trim() : ""), 300);
    return () => clearTimeout(t);
  }, [qInput]);
  useEffect(() => {
    setCursors([]);
  }, [q, sort, letter]);

  const months = useMemo(
    () => (summary ? [...summary.byMonth].sort((a, b) => (a.month < b.month ? 1 : -1)) : []),
    [summary],
  );
  // On a pinned month the figures in the intro and on the chips are that
  // month's, not the whole remainder's: a page about November 2025 must not
  // open with 140,000 cases.
  const cohort = fixedMonth ? months.find((m) => m.month === fixedMonth) ?? null : null;
  const counts = cohort ?? summary;
  // Every month lists its cases, however few.
  const withheld = false as boolean;
  const pristine =
    Boolean(seed) && kind === "all" && month === initialMonth && cursors.length === 0 && q === "" && sort === "filed" && letter === "";

  const url = useMemo(() => {
    if (withheld || pristine) return "skip" as const;
    const p = new URLSearchParams();
    p.set("action", "live");
    p.set("kind", kind);
    if (month) p.set("month", month);
    if (q) p.set("q", q);
    if (letter) p.set("letter", letter);
    if (sort !== "filed") p.set("sort", sort);
    p.set("numItems", String(PAGE_SIZE));
    const cursor = cursors[cursors.length - 1];
    if (cursor) p.set("cursor", cursor);
    return `/api/perm-cases?${p.toString()}`;
  }, [kind, month, q, letter, sort, cursors, withheld, pristine]);

  const fetched = usePublicQuery<LiveListPage>(url);
  const page = pristine ? seed ?? undefined : fetched.data;
  // What the table draws: the current page, or while the next one is on its
  // way, the last one that arrived (or the server's first page). Dropping to a
  // one-line "Loading" row on every filter or page change collapsed the table
  // and grew it back a moment later.
  const shownPage = page ?? fetched.previous ?? seed ?? undefined;
  const failed = pristine ? false : fetched.failed;

  const reset = useCallback(() => setCursors([]), []);
  const pickKind = (k: LiveKind) => {
    setKind(k);
    reset();
  };
  const pickMonth = (m: string) => {
    setMonth(m);
    reset();
  };

  const pageIndex = cursors.length;
  const loading = url !== "skip" && page === undefined && !failed;
  const busy = loading && shownPage !== undefined;

  return (
    <section id="live" ref={liveTop} >
      <div className="object p-5 sm:p-6">
        <p className="text-sm font-bold text-muted-foreground">
          Newer than DOL&apos;s published files
        </p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">
          Live from DOL&apos;s case-status service
        </h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-soft">
          {cohort ? (
            <>
              {formatInt(cohort.total)} live {cohort.total === 1 ? "case was" : "cases were"} filed in{" "}
              {formatMonth(cohort.month) ?? cohort.month}: {formatInt(cohort.pending)} still waiting,{" "}
              {formatInt(cohort.decided)} decided since DOL&apos;s last published file.
            </>
          ) : summary ? (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough ?? summary.publishedThrough)}.
              A daily check of DOL&apos;s case system adds {formatInt(summary.total)} cases
              they don&apos;t hold yet: {formatInt(summary.decided)} decided ({formatInt(summary.certified)}{" "}
              certified, {formatInt(summary.denied)} denied, {formatInt(summary.withdrawn)}{" "}
              withdrawn), {formatInt(summary.pending)} still waiting.
            </>
          ) : (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough)}. Everything
              below is newer, from a daily check of DOL&apos;s case system.
            </>
          )}{" "}
          Wage, law firm, state and decision date arrive when DOL publishes the case.
        </p>

        {/* Two rows, so nothing's width depends on the data: the which-cases
            buttons (their counts arrive with the data) and the letter chip on
            one, then a fixed grid for search, sort and month. In one wrapping
            row the counts and the month list arriving reflowed everything, and
            on a phone the search box rendered 7px wide (Oct 30 2026). */}
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Which live cases" className="flex flex-wrap gap-2">
              {(["all", "pending", "decided"] as const).map((k) => (
                <Fragment key={k}>{" "}
                <button
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => pickKind(k)}
                  className={choiceVariants({ on: kind === k })}
                >
                  {KIND_LABEL[k]}
                  {counts && k !== "all" ? ` · ${formatInt(counts[k])}` : ""}
                </button>
                </Fragment>
              ))}
            </div>{" "}
            {letter ? (
              <button
                type="button"
                onClick={() => setLetter("")}
                className={choiceVariants({ on: true })}
                aria-label={`Showing employers from ${letter === OTHER_INITIAL ? "a number or symbol" : letter}; show every employer`}
              >
                {`Employers from ${letter === OTHER_INITIAL ? "0-9 and symbols" : letter}`} <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>{" "}
          <div
            className={cn(
              "grid grid-cols-1 items-center gap-2 [&>*]:min-w-0",
              fixedMonth ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]",
            )}
          >
            <label className="flex min-h-[44px] w-full items-center gap-2 border-2 border-input bg-card px-3 text-sm font-bold">
              <span className="text-sm text-muted-foreground">Search</span>{" "}
              <input
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Case number or employer"
                aria-label="Search the live cases"
                className="w-full min-w-0 bg-transparent py-2 text-base font-medium outline-none placeholder:text-muted-foreground"
              />
            </label>{" "}
            <label className="flex min-h-[44px] w-full min-w-0 items-center gap-2 text-sm font-bold">
              <span className="shrink-0">Sort by</span>{" "}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as LiveSort)}
                className="min-h-[44px] w-full min-w-0 flex-1 border-2 border-input bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="filed">Filing date</option>
                <option value="employer">Employer</option>
                <option value="status">Status</option>
              </select>
            </label>{" "}
            <label className={cn("flex min-h-[44px] w-full min-w-0 items-center gap-2 text-sm font-bold", fixedMonth && "hidden")}>
              <span className="shrink-0">Filed in</span>{" "}
              <select
                value={month}
                onChange={(e) => pickMonth(e.target.value)}
                className="min-h-[44px] w-full min-w-0 flex-1 truncate border-2 border-input bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Any month</option>
                {months.map((m) => (
                  <option key={m.month} value={m.month}>
                    {formatMonth(m.month) ?? m.month} ({formatInt(m.total)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>


        {failed ? (
          <RequestFailed
            what="The live list"
            failure={fetched.failure}
            onRetry={fetched.retry}
            after="The case search above still answers by number or employer."
            className="mt-5 bg-tint p-4 border-2 border-border"
          />
        ) : null}

        {!withheld && !failed ? (
          <div
            className={cn("mt-5 transition-opacity sm:overflow-x-auto", busy && "opacity-60")}
            aria-busy={loading}
          >
            {/* On a phone each row is a card, as in the other case browsers. */}
            <table className="w-full border-collapse text-left text-base max-sm:block max-sm:[&_thead]:hidden sm:min-w-[820px]">
              <caption className="sr-only">
                Live cases from DOL&apos;s case-status service, newest filing first
              </caption>
              <thead className="dark border-b border-black bg-[#141414] text-foreground">
                <tr>
                  {["Case", "Status", "Employer", "Job title", "Filed", "Seen"].map((h) => (
                    <Fragment key={h}>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 text-sm font-bold"
                    >
                      {h}{" "}
                    </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody translate="no" className="bg-card max-sm:block">
                {loading && !shownPage ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                      Loading the live list…
                    {" "}</td>
                  </tr>
                ) : null}
                {page && page.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                      Nothing live matches that filter.
                    {" "}</td>
                  </tr>
                ) : null}
                {shownPage?.rows.map((r) => (
                  <tr
                    key={r.caseNumber}
                    className="border-t border-border/30 align-top max-sm:grid max-sm:grid-cols-1 max-sm:gap-y-1 max-sm:px-3 max-sm:py-3 max-sm:[&>td]:p-0 max-sm:[&>td]:whitespace-normal"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base max-sm:whitespace-nowrap!">
                      {/* PendingLink: /perm-case-status is dynamic and can
                          ask DOL live, so a bare link is seconds of silence. */}
                      <PendingLink
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="link"
                      >
                        {r.caseNumber}
                      </PendingLink>
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.status ? <CaseStatusChip status={r.status} /> : <span className="text-muted-foreground">Unknown</span>}
                    {" "}</td>
                    <td className="px-3 py-3">
                      {r.employerSlug ? (
                        <Link
                          href={entityHref("employer", r.employerSlug)}
                          className="link"
                        >
                          {r.employerName}
                        </Link>
                      ) : (
                        <span className="font-bold">{r.employerName}</span>
                      )}
                    {" "}</td>
                    <td className="px-3 py-3 text-soft max-sm:text-sm">{r.jobTitle ?? ""}{" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm max-sm:font-sans max-sm:text-muted-foreground">
                      {r.filingDate ? <span className="sm:hidden">Filed </span> : null}
                      {r.filingDate ?? ""}
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-soft max-sm:font-sans max-sm:text-muted-foreground">
                      {r.decidedSeen ? <span className="sm:hidden">Seen decided </span> : null}
                      {r.decidedSeen ?? ""}
                    {" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!withheld && !failed ? (
          <Pager
            id="live-case-pager"
            page={pageIndex + 1}
            hasPrevious={pageIndex > 0}
            hasNext={Boolean(page && !page.isDone)}
            loading={loading}
            noun="case"
            previousLabel="Newer"
            nextLabel="Older"
            labelClassName="text-sm font-bold"
            buttonClassName="min-h-[44px] border-2 border-input bg-card px-4 text-sm font-bold hover:bg-tint disabled:text-muted-foreground disabled:hover:bg-card focus-visible:ring-2 focus-visible:ring-primary"
            scrollTo={liveTop}
            onPrevious={() => setCursors((c) => c.slice(0, -1))}
            onNext={() => page && setCursors((c) => [...c, page.continueCursor])}
          >
            <p className="text-sm text-muted-foreground">
              Newest filing first. &ldquo;Seen&rdquo; is the day this site first saw the
              decision. It&apos;s blank for cases decided before the daily check began.
            </p>
          </Pager>
        ) : null}
      </div>
    </section>
  );
}
