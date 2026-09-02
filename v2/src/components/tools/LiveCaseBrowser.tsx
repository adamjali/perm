"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { formatMonth } from "@/lib/dolFormat";
// Type-only: `@/lib/turso/liveCases` imports `server-only`, and a value import
// here would be a build error. A type import compiles to nothing.
import type {
  LiveKind,
  LiveListPage,
  LiveRemainderSummary,
} from "@/lib/turso/liveCases";

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

const SMALL_COHORT = 20;
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
}: {
  summary: LiveRemainderSummary | null;
  /** The published table's last decision date, for the headline. */
  publishedThrough: string | null;
}) {
  const params = useSearchParams();
  // `?filed=YYYY-MM` is how the month pages hand a cohort to this list.
  const filedParam = params.get("filed");
  const initialMonth = filedParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(filedParam) ? filedParam : "";

  const [kind, setKind] = useState<LiveKind>("all");
  const [month, setMonth] = useState<string>(initialMonth);
  const [cursors, setCursors] = useState<string[]>([]);

  const months = useMemo(
    () => (summary ? [...summary.byMonth].sort((a, b) => (a.month < b.month ? 1 : -1)) : []),
    [summary],
  );
  const cohort = month ? months.find((m) => m.month === month) ?? null : null;
  const withheld = cohort !== null && cohort.total < SMALL_COHORT;

  const url = useMemo(() => {
    if (withheld) return "skip" as const;
    const p = new URLSearchParams();
    p.set("action", "live");
    p.set("kind", kind);
    if (month) p.set("month", month);
    p.set("numItems", String(PAGE_SIZE));
    const cursor = cursors[cursors.length - 1];
    if (cursor) p.set("cursor", cursor);
    return `/api/perm-cases?${p.toString()}`;
  }, [kind, month, cursors, withheld]);

  const { data: page, failed } = usePublicQuery<LiveListPage>(url);

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
          {summary ? (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough ?? summary.publishedThrough)}.
              Everything below comes from checking DOL&apos;s own case system every
              day: {fmtInt(summary.total)} cases the files don&apos;t hold yet,{" "}
              {fmtInt(summary.decided)} of them decided ({fmtInt(summary.certified)}{" "}
              certified, {fmtInt(summary.denied)} denied, {fmtInt(summary.withdrawn)}{" "}
              withdrawn) and {fmtInt(summary.pending)} still waiting.
            </>
          ) : (
            <>
              DOL&apos;s published files end on {longDate(publishedThrough)}. Everything
              below comes from checking DOL&apos;s own case system every day: the
              cases the files don&apos;t hold yet.
            </>
          )}{" "}
          These rows carry only what that check returns. The wage, law firm and
          state appear when DOL publishes the case.
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
                {summary && k !== "all" ? ` · ${fmtInt(summary[k])}` : ""}
              </button>
              </Fragment>
            ))}
          </div>{" "}
          <label className="ml-auto flex min-h-[44px] items-center gap-2 text-sm font-bold">
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

        {withheld && cohort ? (
          <p className="mt-5 text-base leading-relaxed text-foreground/80">
            {fmtInt(cohort.total)} live {cohort.total === 1 ? "case was" : "cases were"} filed in{" "}
            {formatMonth(cohort.month) ?? cohort.month}: {fmtInt(cohort.pending)} waiting,{" "}
            {fmtInt(cohort.decided)} decided. Rows aren&apos;t listed for a month this
            small, because a case number beside an employer and a job title is
            close to naming a person.
          </p>
        ) : null}

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
                    <Fragment key={h}>{" "}
                    <th
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider"
                    >
                      {h}
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
                    </td>
                  </tr>
                ) : null}
                {page && page.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-foreground/70">
                      Nothing live matches that filter.
                    </td>
                  </tr>
                ) : null}
                {page?.rows.map((r) => (
                  <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                      <Link
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.caseNumber}
                      </Link>
                    </td>{" "}
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={
                          "border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " +
                          statusClass(r.status, r.isFinal)
                        }
                      >
                        {r.status ?? "unknown"}
                      </span>
                    </td>{" "}
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
                    </td>{" "}
                    <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}</td>{" "}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                      {r.filingDate ?? ""}
                    </td>{" "}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">
                      {r.decidedSeen ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!withheld && !failed ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground/70">
              Newest filing first. &ldquo;Seen&rdquo; is the day this site first saw the
              decision, not DOL&apos;s decision date; it&apos;s blank for cases decided
              before the daily check began.
            </p>{" "}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setCursors((c) => c.slice(0, -1))}
                className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
              >
                Newer
              </button>{" "}
              <button
                type="button"
                disabled={!page || page.isDone}
                onClick={() => page && setCursors((c) => [...c, page.continueCursor])}
                className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
              >
                Older
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
