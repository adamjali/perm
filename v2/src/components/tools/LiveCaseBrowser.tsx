"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { Pager } from "@/components/ui/pager";
import { PendingLink } from "@/components/ui/pending-link";
import { formatMonth } from "@/lib/dolFormat";
// Type-only: `@/lib/turso/liveCases` imports `server-only`, and a value import
// here would be a build error. A type import compiles to nothing.
import type { LiveKind, LiveListPage, LiveRemainderSummary, LiveSort } from "@/lib/turso/liveCases";

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

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** `2026-06-30` to `June 30, 2026`. */
function longDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusClass(status: string | null, isFinal: boolean): string {
  const s = (status ?? "").toUpperCase();
  if (s === "CERTIFIED") return "bg-primary text-primary-foreground";
  if (s === "DENIED") return "bg-foreground text-background";
  if (isFinal) return "bg-card";
  return "bg-tint-primary";
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
  const params = useSearchParams();
  // `?filed=YYYY-MM` is how the month pages hand a cohort to this list.
  const filedParam = params.get("filed");
  const initialMonth =
    fixedMonth ?? (filedParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(filedParam) ? filedParam : "");

  const [kind, setKind] = useState<LiveKind>("all");
  const [month, setMonth] = useState<string>(initialMonth);
  const [cursors, setCursors] = useState<string[]>([]);
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
  }, [q, sort]);

  const months = useMemo(
    () => (summary ? [...summary.byMonth].sort((a, b) => (a.month < b.month ? 1 : -1)) : []),
    [summary],
  );
  // On a pinned month the figures in the intro and on the chips are that
  // month's, not the whole remainder's: a page about November 2025 must not
  // open with 140,000 cases.
  const cohort = fixedMonth ? months.find((m) => m.month === fixedMonth) ?? null : null;
  const counts = cohort ?? summary;
  // Every month lists, however small (owner's call, Sep 8 2026).
  const withheld = false as boolean;
  const pristine =
    Boolean(seed) && kind === "all" && month === initialMonth && cursors.length === 0 && q === "" && sort === "filed";

  const url = useMemo(() => {
    if (withheld || pristine) return "skip" as const;
    const p = new URLSearchParams();
    p.set("action", "live");
    p.set("kind", kind);
    if (month) p.set("month", month);
    if (q) p.set("q", q);
    if (sort !== "filed") p.set("sort", sort);
    p.set("numItems", String(PAGE_SIZE));
    const cursor = cursors[cursors.length - 1];
    if (cursor) p.set("cursor", cursor);
    return `/api/perm-cases?${p.toString()}`;
  }, [kind, month, q, sort, cursors, withheld, pristine]);

  const fetched = usePublicQuery<LiveListPage>(url);
  const page = pristine ? seed ?? undefined : fetched.data;
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

  return (
    <section id="live" className="scroll-mt-24">
      <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Newer than DOL&apos;s published files
        </p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-black sm:text-3xl">
          Live from DOL&apos;s daily check
        </h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
          {cohort ? (
            <>
              {fmtInt(cohort.total)} live {cohort.total === 1 ? "case was" : "cases were"} filed in{" "}
              {formatMonth(cohort.month) ?? cohort.month}: {fmtInt(cohort.pending)} still waiting,{" "}
              {fmtInt(cohort.decided)} decided since DOL&apos;s last published file.
            </>
          ) : summary ? (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough ?? summary.publishedThrough)}.
              A daily check of DOL&apos;s case system adds {fmtInt(summary.total)} cases
              they don&apos;t hold yet: {fmtInt(summary.decided)} decided ({fmtInt(summary.certified)}{" "}
              certified, {fmtInt(summary.denied)} denied, {fmtInt(summary.withdrawn)}{" "}
              withdrawn), {fmtInt(summary.pending)} still waiting.
            </>
          ) : (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough)}. Everything
              below is newer, from a daily check of DOL&apos;s case system.
            </>
          )}{" "}
          Wage, law firm, state and decision date arrive when DOL publishes the case.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Which live cases" className="flex flex-wrap gap-2">
            {(["all", "pending", "decided"] as const).map((k) => (
              <Fragment key={k}>{" "}
              <button
                type="button"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
                className={
                  "min-h-[44px] border-2 border-border px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary " +
                  (kind === k ? "bg-foreground text-background hover:bg-foreground" : "bg-card")
                }
              >
                {KIND_LABEL[k]}
                {counts && k !== "all" ? ` · ${fmtInt(counts[k])}` : ""}
              </button>
              </Fragment>
            ))}
          </div>{" "}
          <label className="flex min-h-[44px] flex-1 items-center gap-2 border-2 border-border bg-card px-3 text-sm font-bold sm:max-w-md">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Search</span>{" "}
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Case number, employer or job title"
              aria-label="Search the live cases"
              className="w-full min-w-0 bg-transparent py-2 text-base font-medium outline-none placeholder:text-muted-foreground"
            />
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
            <span>Sort by</span>{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as LiveSort)}
              className="min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="filed">Filing date</option>
              <option value="employer">Employer</option>
              <option value="status">Status</option>
            </select>
          </label>{" "}
          <label className={`ml-auto flex min-h-[44px] items-center gap-2 text-sm font-bold${fixedMonth ? " hidden" : ""}`}>
            <span>Filed in</span>{" "}
            <select
              value={month}
              onChange={(e) => pickMonth(e.target.value)}
              className="min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Any month</option>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonth(m.month) ?? m.month} ({fmtInt(m.total)})
                </option>
              ))}
            </select>
          </label>
        </div>


        {failed ? (
          <p className="mt-5 text-base text-foreground/80">
            The live list didn&apos;t load. The case search above still answers by
            number or employer.
          </p>
        ) : null}

        {!withheld && !failed ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-base">
              <caption className="sr-only">
                Live cases from DOL&apos;s daily check, newest filing first
              </caption>
              <thead className="bg-foreground text-background">
                <tr>
                  {["Case", "Status", "Employer", "Job title", "Filed", "Seen"].map((h) => (
                    <Fragment key={h}>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider"
                    >
                      {h}{" "}
                    </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-card">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-foreground/70">
                      Loading the live list…
                    {" "}</td>
                  </tr>
                ) : null}
                {page && page.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-foreground/70">
                      Nothing live matches that filter.
                    {" "}</td>
                  </tr>
                ) : null}
                {page?.rows.map((r) => (
                  <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                      {/* PendingLink: /perm-case-status is dynamic and can
                          ask DOL live, so a bare link is seconds of silence. */}
                      <PendingLink
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.caseNumber}
                      </PendingLink>
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={
                          "border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " +
                          statusClass(r.status, r.isFinal)
                        }
                      >
                        {r.status ?? "unknown"}
                      </span>
                    {" "}</td>
                    <td className="px-3 py-3">
                      {r.employerSlug ? (
                        <Link
                          href={`/perm-employers/${r.employerSlug}`}
                          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                        >
                          {r.employerName}
                        </Link>
                      ) : (
                        <span className="font-bold">{r.employerName}</span>
                      )}
                    {" "}</td>
                    <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                      {r.filingDate ?? ""}
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">
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
            buttonClassName="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary disabled:opacity-40 disabled:hover:bg-card focus-visible:ring-2 focus-visible:ring-primary"
            onPrevious={() => setCursors((c) => c.slice(0, -1))}
            onNext={() => page && setCursors((c) => [...c, page.continueCursor])}
          >
            <p className="text-sm text-foreground/70">
              Newest filing first. &ldquo;Seen&rdquo; is the day this site first saw the
              decision. It&apos;s blank for cases decided before the daily check began.
            </p>
          </Pager>
        ) : null}
      </div>
    </section>
  );
}
