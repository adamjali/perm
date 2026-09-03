"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { formatWage } from "@/lib/wageFormat";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { SortableHeader } from "@/components/tools/SortableHeader";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { Program, UnifiedCase } from "@/lib/turso/unifiedSearch";

/**
 * Every DOL filing this site holds, in one search, sortable.
 *
 * WHY IT EXISTS. The corpus is three programs in six tables, and until now the
 * only way in was to already know which one you wanted. Somebody whose lawyer
 * said "the wage request is in" does not know that a wage request is a
 * different program from the PERM, and should not have to. Type the employer
 * once and see everything they have filed, labelled.
 *
 * THE EMPLOYER IS THE REQUIRED FIELD, AND THE REASON IS THE BILL. Every read
 * underneath rides an indexed range over the employer slug. A title-only or
 * wage-only search has no index to sit on and would scan the corpus on every
 * request, which is what took Turso to 11.6 billion rows read in two days in
 * August. So the other controls narrow an employer's results rather than
 * standing on their own, and the page says that rather than offering a control
 * that silently costs a fortune.
 *
 * SORTING IS CLIENT-SIDE AND HONEST ABOUT IT. The server returns the newest
 * 300 matches; sorting reorders that set, it does not re-query. Sorting by
 * wage therefore shows the highest wage AMONG THE MATCHES SHOWN, not across
 * the whole corpus, and the footnote says so. Silently re-sorting a truncated
 * set and calling it "highest paid" would be a fabrication.
 */

const PROGRAM_LABEL: Record<Program, string> = {
  perm: "PERM",
  pwd: "Wage request",
  lca: "H-1B LCA",
};

const PROGRAM_BLURB: Record<Program, string> = {
  perm: "The labor certification itself (ETA-9089).",
  pwd: "The wage DOL sets before the PERM (ETA-9141).",
  lca: "The H-1B labor condition application (ETA-9035).",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ALL_PROGRAMS: Program[] = ["perm", "pwd", "lca"];

const CONTROL =
  "w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";
const CHIP =
  "min-h-[44px] border-2 border-border px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary ";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The sortable columns. `descFirst` on the date and money columns: those are
 * read newest-first and highest-first, and defaulting them to ascending makes
 * the first click on each feel like a bug.
 */
const COLUMNS: SortColumn<UnifiedCase>[] = [
  { key: "program", label: "Program", get: (r) => PROGRAM_LABEL[r.program] },
  { key: "status", label: "Status", get: (r) => r.status },
  { key: "employer", label: "Employer", get: (r) => r.employerName },
  { key: "title", label: "Job title", get: (r) => r.jobTitle },
  { key: "wage", label: "Wage", descFirst: true, get: (r) => r.wage },
  { key: "filed", label: "Filed", descFirst: true, get: (r) => r.filedOn },
  { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decidedOn },
];

function statusTone(status: string, isFinal: boolean): string {
  const u = status.toUpperCase();
  if (u.startsWith("CERTIFIED") || u === "DETERMINATION ISSUED" || u.startsWith("REDETERMINATION")) {
    return "bg-primary text-primary-foreground";
  }
  if (u === "DENIED" || u.startsWith("WITHDRAWN")) return "bg-foreground text-background";
  return isFinal ? "bg-card" : "bg-tint-primary";
}

export function UnifiedCaseSearch() {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [textInput, setTextInput] = useState(initial);
  // A CASE NUMBER TYPED HERE MUST NOT BE RUN AS AN EMPLOYER NAME. The employer
  // search reads our own tables and can only ever miss on a number; the lookup
  // asks DOL live and answers even for a case filed yesterday that nothing here
  // has seen. Shape only: a wrong digit still makes a well-formed number, so
  // this offers the live route rather than asserting the case exists.
  const typedCaseNumber = normaliseCaseNumber(textInput);
  const [titleInput, setTitleInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [programs, setPrograms] = useState<Program[]>(ALL_PROGRAMS);
  const [query, setQuery] = useState({
    text: initial.trim(),
    title: "",
    from: "",
    to: "",
    programs: ALL_PROGRAMS,
    n: 0,
  });

  // Narrowing applied AFTER the answer arrives: neither is a new request, so
  // flipping between them costs nothing and cannot re-bill a Turso read.
  const [stage, setStage] = useState<"all" | "pending" | "decided">("all");
  const [sort, setSort] = useState<SortState>({ key: "filed", dir: -1 });

  const url = useMemo(() => {
    if (query.text.length < 2 || query.programs.length === 0) return "skip" as const;
    const p = new URLSearchParams({ text: query.text, programs: query.programs.join(",") });
    if (query.title) p.set("title", query.title);
    if (query.from) p.set("from", query.from);
    if (query.to) p.set("to", query.to);
    p.set("s", String(query.n));
    return `/api/case-search?${p.toString()}`;
  }, [query]);

  const { data, failed } = usePublicQuery<{
    rows: UnifiedCase[];
    counts: Record<Program, number>;
    truncated: boolean;
    capped: boolean;
  }>(url);

  const searching = query.text.length >= 2 && query.programs.length > 0;
  const pending = searching && data === undefined && !failed;

  const shown = useMemo(() => {
    if (!data) return [];
    const staged =
      stage === "all" ? data.rows : data.rows.filter((r) => (stage === "decided" ? r.isFinal : !r.isFinal));
    return sortRows(staged, COLUMNS, sort);
  }, [data, stage, sort]);

  const toggleProgram = (p: Program) => {
    setPrograms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({
      text: textInput.trim(),
      title: titleInput.trim(),
      from: MONTH_RE.test(fromInput) ? fromInput : "",
      to: MONTH_RE.test(toInput) ? toInput : "",
      programs,
      n: q.n + 1,
    }));
  };

  return (
    <div className="space-y-8">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] [&>*]:min-w-0">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Employer</span>{" "}
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Start of the employer's name"
                maxLength={120}
                autoComplete="off"
                className={CONTROL}
              />
            </label>{" "}
            <div className="flex items-end">
              <button type="submit" className={BUTTON} disabled={pending} aria-busy={pending}>
                {pending ? "Searching…" : "Search"}
              </button>
            </div>
          </div>{" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Job title contains</span>{" "}
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. engineer"
                maxLength={80}
                autoComplete="off"
                className={CONTROL}
              />
            </label>{" "}
            {/* `min-w-0` written out even though CONTROL already carries it:
                `form-controls-min-width.test.ts` reads the attribute text and
                cannot see through a constant, and a static gate that a real
                fix does not satisfy is a gate people learn to ignore. The
                ancestor grid is what actually stops the iOS overflow, and it
                has `grid-cols-1` and `[&>*]:min-w-0` above. */}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed from</span>{" "}
              <input
                type="month"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className={CONTROL + " min-w-0"}
              />
            </label>{" "}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed to</span>{" "}
              <input
                type="month"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className={CONTROL + " min-w-0"}
              />
            </label>
          </div>{" "}
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Programs</legend>
            <div className="flex flex-wrap gap-2">
              {ALL_PROGRAMS.map((p) => (
                <Fragment key={p}>
                  <button
                    type="button"
                    aria-pressed={programs.includes(p)}
                    title={PROGRAM_BLURB[p]}
                    onClick={() => toggleProgram(p)}
                    className={
                      CHIP + (programs.includes(p) ? "bg-foreground text-background hover:bg-foreground" : "bg-card")
                    }
                  >
                    {PROGRAM_LABEL[p]}
                  </button>{" "}
                </Fragment>
              ))}
            </div>
            {programs.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/70">Pick at least one program to search.</p>
            ) : null}
          </fieldset>
        </form>
      </section>

      {typedCaseNumber ? (
        <div className="border-2 border-primary bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            <b className="font-bold">That is a case number, not an employer.</b>{" "}
            Look it up directly and DOL is asked live, so it answers even for a
            filing nothing here has seen yet.
          </p>{" "}
          <p className="mt-3">
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(typedCaseNumber)}`}
              className="inline-flex min-h-[44px] items-center border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground"
            >
              Check {typedCaseNumber} with DOL
            </Link>
          </p>
        </div>
      ) : null}

      {searching && failed ? (
        <p className="border-2 border-border bg-tint-primary p-4 text-base">
          The search didn&apos;t load. Reloading usually clears it.
        </p>
      ) : null}

      {searching && data && data.rows.length === 0 ? (
        <div className="border-2 border-border bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            Nothing filed under that employer in the programs selected. Try a
            shorter form of the name: DOL spells one company several ways, and
            the search matches the start of the name it was filed under.
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed">
            Have a case number instead?{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              The status lookup
            </Link>{" "}
            takes all three prefixes and asks DOL directly.
          </p>
        </div>
      ) : null}

      {searching && data && data.rows.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Which stage" className="flex flex-wrap gap-2">
              {(["all", "pending", "decided"] as const).map((k) => (
                <Fragment key={k}>
                  <button
                    type="button"
                    aria-pressed={stage === k}
                    onClick={() => setStage(k)}
                    className={CHIP + (stage === k ? "bg-foreground text-background hover:bg-foreground" : "bg-card")}
                  >
                    {k === "all" ? "All" : k === "pending" ? "Still open" : "Decided"}
                  </button>{" "}
                </Fragment>
              ))}
            </div>{" "}
            <p className="ml-auto text-sm text-foreground/70">
              {/* "shown", not a total: the reads underneath are capped, so a
                  bare number here would read as this employer's whole record
                  when it is the newest slice of it. */}
              Shown:{" "}
              {ALL_PROGRAMS.filter((p) => data.counts[p] > 0)
                .map((p) => `${fmt(data.counts[p])} ${PROGRAM_LABEL[p]}`)
                .join(" · ")}
            </p>
          </div>{" "}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-base">
              <caption className="sr-only">
                Every filing found for this employer across PERM, wage requests and LCAs
              </caption>
              <SortableHeader
                columns={COLUMNS}
                sort={sort}
                onSort={(k) => setSort((cur) => nextSort(cur, k, COLUMNS))}
                leading={["Case"]}
              />
              <tbody className="bg-card">
                {shown.map((r) => (
                  <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                      <Link
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.caseNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">{PROGRAM_LABEL[r.program]}</td>
                    <td className="px-3 py-3">
                      <span className={"inline-block border-2 border-border px-2 py-1 text-sm font-bold " + statusTone(r.status, r.isFinal)}>
                        {r.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {r.employerSlug && r.program === "perm" ? (
                        <Link
                          href={`/perm-employers/${r.employerSlug}`}
                          className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                        >
                          {r.employerName ?? "—"}
                        </Link>
                      ) : (
                        (r.employerName ?? "—")
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">{r.jobTitle ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">
                      {r.wage === null ? "—" : formatWage(r.wage, r.wageUnit)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.filedOn ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.decidedOn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{" "}

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/70">
            Showing {fmt(shown.length)} of {fmt(data.rows.length)} filings.
            {data.truncated || data.capped
              ? " This employer has filed more than fits one answer: these are the newest, and a job title or a filing month brings the rest into reach."
              : ""}
            Sorting reorders what is on this page rather than re-running the
            search, so &ldquo;highest wage&rdquo; means highest among these rows,
            not across the whole corpus. A wage appears once DOL has published
            the case in a quarterly file; open filings have none yet, and DOL
            does not name the law firm on anything until publication.
          </p>
        </section>
      ) : null}

      {!searching ? (
        <div className="border-2 border-border bg-tint-primary p-5">
          <h2 className="font-heading text-lg font-black">What one search covers</h2>{" "}
          <dl className="mt-3 space-y-2 text-base leading-relaxed">
            {ALL_PROGRAMS.map((p) => (
              <Fragment key={p}>
                {/* The `{" "}` is load-bearing, not cosmetic: JSX drops the
                    newline between two tags, so `</dt><dd>` reaches every
                    extractor as "PERM:The labor certification". Google has
                    reproduced that shape verbatim in a search listing. */}
                <div>
                  <dt className="inline font-bold">{PROGRAM_LABEL[p]}:</dt>{" "}
                  <dd className="inline text-foreground/80">{PROGRAM_BLURB[p]}</dd>
                </div>{" "}
              </Fragment>
            ))}
          </dl>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Each one is shown twice over: what DOL&apos;s daily check confirms
            while it is open, and what DOL publishes with the wage once it is
            decided. One row per case, whichever half it came from.
          </p>
        </div>
      ) : null}
    </div>
  );
}
