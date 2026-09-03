"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { formatMonth } from "@/lib/dolFormat";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module. Keep the path on the `import type`.
import type { FlagCaseRow, FlagDisclosedRow, FlagDisclosureSummary, FlagKind, FlagListPage, FlagSummary } from "@/lib/turso/flagCases";
import { formatWage } from "@/lib/wageFormat";
import { mergeHalves } from "@/lib/flagMerge";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { SortableHeader } from "@/components/tools/SortableHeader";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";

/**
 * Find a FLAG case (prevailing wage request, or LCA) by employer, and browse
 * the rest. One component, two programs: the API path and the nouns differ,
 * the mechanics do not.
 *
 * The question this answers is the one people bring to Reddit: "my lawyer
 * filed it in May, I don't know the number, how do I find it and see where
 * it is." Employer, a word from the title, a month or two, and the number is
 * on the screen with its status. Every row links to the status page, which
 * asks DOL directly.
 */

export interface FlagBrowserProgram {
  /** `/api/pwd-cases` or `/api/lca-cases`. */
  api: string;
  /** Singular and plural nouns for the rows: "wage request", "wage requests". */
  noun: string;
  nouns: string;
  /** Chip labels for pending and decided. */
  pendingLabel: string;
  decidedLabel: string;
  /** What the wage column holds: the wage DOL SET (PWD) or the wage OFFERED (LCA). */
  wageLabel: string;
}

export const PWD_PROGRAM: FlagBrowserProgram = {
  api: "/api/pwd-cases",
  noun: "wage request",
  nouns: "wage requests",
  pendingLabel: "In process",
  decidedLabel: "Issued",
  wageLabel: "Wage set",
};

export const LCA_PROGRAM: FlagBrowserProgram = {
  api: "/api/lca-cases",
  noun: "LCA",
  nouns: "LCAs",
  pendingLabel: "In process",
  decidedLabel: "Decided",
  wageLabel: "Wage offered",
};


const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAGE_SIZE = 50;
const SMALL_COHORT = 20;

const CONTROL =
  "w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";
const CHIP =
  "min-h-[44px] border-2 border-border px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary ";


const fmt = (n: number) => n.toLocaleString("en-US");

function chip(status: string, isFinal: boolean): string {
  const u = status.toUpperCase();
  if (u === "DETERMINATION ISSUED" || u.startsWith("REDETERMINATION")) return "bg-primary text-primary-foreground";
  if (u === "DENIED") return "bg-foreground text-background";
  return isFinal ? "bg-card" : "bg-tint-primary";
}

function Rows({
  rows,
  caption,
  wages,
  wageLabel,
}: {
  rows: FlagCaseRow[];
  caption: string;
  /** The file's record for rows it also holds; adds a wage column when non-empty. */
  wages?: Map<string, FlagDisclosedRow>;
  wageLabel?: string;
}) {
  const withWage = !!wages && wages.size > 0;
  const [sort, setSort] = useState<SortState>({ key: "filed", dir: -1 });
  const columns: SortColumn<FlagCaseRow>[] = useMemo(() => {
    const cols: SortColumn<FlagCaseRow>[] = [
      { key: "status", label: "Status", get: (r) => r.status },
      { key: "employer", label: "Employer", get: (r) => r.employerName },
      { key: "title", label: "Job title", get: (r) => r.jobTitle },
    ];
    if (withWage) {
      cols.push({
        key: "wage",
        label: wageLabel ?? "Wage",
        descFirst: true,
        get: (r) => wages?.get(r.caseNumber)?.wage ?? null,
      });
    }
    cols.push(
      { key: "filed", label: "Filed", descFirst: true, get: (r) => r.filingDate },
      { key: "checked", label: "Checked", descFirst: true, get: (r) => r.lastCheckedAt ?? null },
    );
    return cols;
  }, [withWage, wageLabel, wages]);
  const ordered = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={columns}
          sort={sort}
          onSort={(k) => setSort((cur) => nextSort(cur, k, columns))}
          leading={["Case"]}
        />
        <tbody className="bg-card">
          {ordered.map((r) => (
            <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {r.caseNumber}
                </Link>
              {" "}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <span className={"border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chip(r.status, r.isFinal)}>
                  {r.status}
                </span>
              {" "}</td>
              <td className="px-3 py-3 font-bold">{r.employerName ?? ""}{" "}</td>
              <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
              {withWage ? (
                <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                  {formatWage(wages?.get(r.caseNumber)?.wage ?? null, wages?.get(r.caseNumber)?.wageUnit ?? null) ?? ""}
                {" "}</td>
              ) : null}
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{r.filingDate ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">
                {r.lastCheckedAt?.slice(0, 10) ?? ""}
              {" "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisclosedRows({
  rows,
  caption,
  wageLabel,
}: {
  rows: FlagDisclosedRow[];
  caption: string;
  wageLabel: string;
}) {
  const [sort, setSort] = useState<SortState>({ key: "decided", dir: -1 });
  const columns: SortColumn<FlagDisclosedRow>[] = useMemo(
    () => [
      { key: "status", label: "Status", get: (r) => r.status },
      { key: "employer", label: "Employer", get: (r) => r.employerName },
      { key: "title", label: "Job title", get: (r) => r.jobTitle },
      { key: "wage", label: wageLabel, descFirst: true, get: (r) => r.wage },
      { key: "received", label: "Received", descFirst: true, get: (r) => r.receivedDate },
      { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decisionDate },
    ],
    [wageLabel],
  );
  const ordered = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={columns}
          sort={sort}
          onSort={(k) => setSort((cur) => nextSort(cur, k, columns))}
          leading={["Case"]}
        />
        <tbody className="bg-card">
          {ordered.map((r) => (
            <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {r.caseNumber}
                </Link>
              {" "}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <span className={"border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chip(r.status, true)}>
                  {r.status}
                </span>
              {" "}</td>
              <td className="px-3 py-3 font-bold">{r.employerName ?? ""}{" "}</td>
              <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{formatWage(r.wage, r.wageUnit) ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{r.receivedDate ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">{r.decisionDate ?? ""}{" "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlagCaseBrowser({
  summary,
  disclosure,
  program,
}: {
  summary: FlagSummary | null;
  /** The quarterly file's summary, for the "through <date>" line. */
  disclosure?: FlagDisclosureSummary | null;
  program: FlagBrowserProgram;
}) {
  const KIND_LABEL: Record<FlagKind, string> = {
    all: "All",
    pending: program.pendingLabel,
    decided: program.decidedLabel,
  };
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  // --- search -----------------------------------------------------------
  const [employerInput, setEmployerInput] = useState(initial);
  // Same reason as on the cross-program search: an employer search reads our
  // tables and can only miss on a number, while the lookup asks DOL live.
  const typedCaseNumber = normaliseCaseNumber(employerInput);
  const [titleInput, setTitleInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [query, setQuery] = useState<{ employer: string; title: string; from: string; to: string; n: number }>({
    employer: initial.trim(),
    title: "",
    from: "",
    to: "",
    n: 0,
  });

  const searchUrl = useMemo(() => {
    if (query.employer.length < 2) return "skip" as const;
    const p = new URLSearchParams({ action: "search", text: query.employer });
    if (query.title) p.set("title", query.title);
    if (query.from) p.set("from", query.from);
    if (query.to) p.set("to", query.to);
    p.set("s", String(query.n));
    return `${program.api}?${p.toString()}`;
  }, [query, program.api]);
  const { data: search, failed: searchFailed } = usePublicQuery<{ cases: FlagCaseRow[]; disclosed?: FlagDisclosedRow[] }>(searchUrl);
  const searching = query.employer.length >= 2;
  const halves = useMemo(
    () => (search ? mergeHalves(search.cases, search.disclosed ?? []) : null),
    [search],
  );
  const found = search ? search.cases.length + (halves?.fileOnly.length ?? 0) : 0;
  const searchPending = searching && search === undefined && !searchFailed;

  // --- browse -----------------------------------------------------------
  const [kind, setKind] = useState<FlagKind>("all");
  const [month, setMonth] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const months = useMemo(
    () => (summary ? [...summary.byMonth].sort((a, b) => (a.month < b.month ? 1 : -1)) : []),
    [summary],
  );
  const cohort = month ? months.find((m) => m.month === month) ?? null : null;
  const withheld = cohort !== null && cohort.total < SMALL_COHORT;
  const listUrl = useMemo(() => {
    if (withheld) return "skip" as const;
    const p = new URLSearchParams({ action: "list", kind, numItems: String(PAGE_SIZE) });
    if (month) p.set("month", month);
    const cursor = cursors[cursors.length - 1];
    if (cursor) p.set("cursor", cursor);
    return `${program.api}?${p.toString()}`;
  }, [kind, month, cursors, withheld, program.api]);
  const { data: page, failed: listFailed } = usePublicQuery<FlagListPage>(listUrl);

  return (
    <div className="space-y-10">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Find {program.noun === "LCA" ? "an" : "a"} {program.noun} by employer</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
          The start of the employer&apos;s name is enough. Add a word from the job
          title or a filing month if the employer files a lot.
        </p>{" "}
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] [&>*]:min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery((q) => ({
              employer: employerInput.trim(),
              title: titleInput.trim(),
              from: MONTH_RE.test(fromInput) ? fromInput : "",
              to: MONTH_RE.test(toInput) ? toInput : "",
              n: q.n + 1,
            }));
          }}
        >
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold">Employer</span>{" "}
            <input
              type="text"
              value={employerInput}
              onChange={(e) => setEmployerInput(e.target.value)}
              placeholder="Start of the employer's name"
              maxLength={120}
              autoComplete="off"
              className={CONTROL}
            />
          </label>{" "}
          <div className="flex items-end">
            <button type="submit" className={BUTTON} disabled={searchPending} aria-busy={searchPending}>
              {searchPending ? "Searching…" : "Search"}
            </button>
          </div>{" "}
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
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed from</span>{" "}
              <input type="month" value={fromInput} onChange={(e) => setFromInput(e.target.value)} placeholder="YYYY-MM" className={CONTROL + " min-w-0"} />
            </label>{" "}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed to</span>{" "}
              <input type="month" value={toInput} onChange={(e) => setToInput(e.target.value)} placeholder="YYYY-MM" className={CONTROL + " min-w-0"} />
            </label>
          </div>
        </form>{" "}
        {typedCaseNumber ? (
          <p className="mt-4 border-2 border-primary bg-tint-primary p-4 text-base leading-relaxed">
            That is a case number.{" "}
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(typedCaseNumber)}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              Look up {typedCaseNumber} directly
            </Link>{" "}
            and DOL is asked live, which answers even for a filing nothing here
            has recorded yet.
          </p>
        ) : null}
        {searching && searchFailed ? (
          <p className="mt-4 text-base text-foreground/80">The search didn&apos;t load. Try again in a moment.</p>
        ) : null}
        {searching && search && found === 0 ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
            Nothing under that employer yet. Pending filings arrive from DOL&apos;s
            nightly check and reach back only as far as the backfill has walked;
            decided ones come from DOL&apos;s quarterly files
            {disclosure?.latestDecision ? ` (through ${disclosure.latestDecision})` : ""}.
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
              status lookup
            </Link>{" "}
            asks DOL directly.
          </p>
        ) : null}
        {searching && search && search.cases.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-foreground/70">
              {fmt(search.cases.length)} {search.cases.length === 1 ? program.noun : program.nouns} from DOL&apos;s
              daily check, newest filing first
              {search.cases.length >= 200 ? " (the first 200; narrow by title or month for the rest)" : ""}.
              {halves && halves.wages.size > 0
                ? ` ${fmt(halves.wages.size)} of them ${halves.wages.size === 1 ? "has" : "have"} the wage from DOL's quarterly file.`
                : ""}
            </p>{" "}
            <Rows
              rows={search.cases}
              caption={`${program.nouns} matching the search`}
              wages={halves?.wages}
              wageLabel={program.wageLabel}
            />
          </>
        ) : null}
        {searching && halves && halves.fileOnly.length > 0 ? (
          <>
            <h3 className="mt-8 font-heading text-lg font-black">
              {search && search.cases.length > 0 ? "Earlier, from DOL\u2019s quarterly file" : "From DOL\u2019s quarterly file"}
            </h3>{" "}
            <p className="mt-1 text-sm text-foreground/70">
              {fmt(halves.fileOnly.length)} decided {halves.fileOnly.length === 1 ? program.noun : program.nouns} with the{" "}
              {program.wageLabel.toLowerCase()}
              {disclosure?.latestDecision ? `, decisions through ${disclosure.latestDecision}` : ""}
              {halves.fileOnly.length >= 200 ? " (the first 200; narrow by title or month for the rest)" : ""}.
            </p>{" "}
            <DisclosedRows
              rows={halves.fileOnly}
              caption={`decided ${program.nouns} from DOL's quarterly file`}
              wageLabel={program.wageLabel}
            />
          </>
        ) : null}
      </section>

      <p className="text-base leading-relaxed text-foreground/80">
        Looking for everything one employer has filed?{" "}
        <Link
          href={`/case-search${query.employer ? `?q=${encodeURIComponent(query.employer)}` : ""}`}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          Search all three DOL programs at once
        </Link>{" "}
        for the PERM, the wage request and the LCA side by side.
      </p>

      <section id="browse" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Browse every {program.noun} DOL has confirmed</h2>{" "}
        {summary ? (
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
            {fmt(summary.total)} {program.nouns} so far: {fmt(summary.pending)} still in process,{" "}
            {fmt(summary.decided)} {program.decidedLabel.toLowerCase()}. Newest filing first.
          </p>
        ) : null}{" "}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Which requests" className="flex flex-wrap gap-2">
            {(["all", "pending", "decided"] as const).map((k) => (
              <Fragment key={k}>{" "}
              <button
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setCursors([]);
                }}
                className={CHIP + (kind === k ? "bg-foreground text-background hover:bg-foreground" : "bg-card")}
              >
                {KIND_LABEL[k]}
                {summary && k !== "all" ? ` · ${fmt(summary[k])}` : ""}
              </button>
              </Fragment>
            ))}
          </div>{" "}
          <label className="ml-auto flex min-h-[44px] items-center gap-2 text-sm font-bold">
            <span>Filed in</span>{" "}
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setCursors([]);
              }}
              className="min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Any month</option>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonth(m.month) ?? m.month} ({fmt(m.total)})
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        {withheld && cohort ? (
          <p className="mt-4 text-base leading-relaxed text-foreground/80">
            {fmt(cohort.total)} {program.nouns} were filed in {formatMonth(cohort.month) ?? cohort.month}. Rows aren&apos;t
            listed for a month this small. A case number beside an employer and job title is close to naming a person.
          </p>
        ) : null}
        {listFailed ? <p className="mt-4 text-base text-foreground/80">The list didn&apos;t load.</p> : null}
        {!withheld && !listFailed && page === undefined ? (
          <p className="mt-4 text-base text-foreground/70">Loading…</p>
        ) : null}
        {!withheld && page && page.rows.length === 0 ? (
          <p className="mt-4 text-base text-foreground/70">Nothing matches that filter.</p>
        ) : null}
        {!withheld && page && page.rows.length > 0 ? (
          <Rows rows={page.rows} caption={`${program.nouns} from DOL's daily check`} />
        ) : null}
        {!withheld && !listFailed ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground/70">
              &ldquo;Checked&rdquo; is the last day this site asked DOL about it.
            </p>{" "}
            <div className="flex gap-2">
              <button type="button" disabled={cursors.length === 0} onClick={() => setCursors((c) => c.slice(0, -1))} className={CHIP + "bg-card"}>
                Newer
              </button>{" "}
              <button type="button" disabled={!page || page.isDone} onClick={() => page && setCursors((c) => [...c, page.continueCursor])} className={CHIP + "bg-card"}>
                Older
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
