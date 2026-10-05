"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";

import { usePublicQuery } from "@/hooks/usePublicQuery";
import { Pager } from "@/components/ui/pager";
import { PendingLink } from "@/components/ui/pending-link";
import { formatMonth } from "@/lib/dolFormat";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module. Keep the path on the `import type`.
import type { FlagCaseRow, FlagDisclosedRow, FlagDisclosureSummary, FlagKind, FlagListPage, FlagSummary } from "@/lib/turso/flagCases";
import { formatWage } from "@/lib/wageFormat";
import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { mergeHalves } from "@/lib/flagMerge";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { SortableHeader } from "@/components/tools/SortableHeader";
import {
  FLAG_FILTER_FIELDS,
  anyFlagFilter,
  flagFacetOptions,
  passesFlagFilters,
  type FlagFilterItem,
  type FlagFilters,
} from "@/lib/flagFilter";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";
import { RequestFailed } from "@/components/tools/RequestFailed";
import { seasonalForm } from "@/lib/seasonalForms";
import { formatInt } from "@/lib/format";
import { formText } from "@/lib/forms/formText";

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
  /**
   * The label for widening the search past the program's default visa class,
   * or absent when there is no default. Wage requests default to PERM ones;
   * DOL's file also holds H-2B, H-1B and other requests, and the API answers
   * them on `visa=all`.
   */
  allVisasLabel?: string;
  /** "a" or "an" before the singular noun; "a" when absent. */
  article?: "a" | "an";
  /**
   * Add a Form column read off the case number's prefix. The H-2A and H-2B
   * program holds three forms under one table, and a row that doesn't say
   * which leaves the reader to decode H-300 from H-400 themselves.
   */
  showForm?: boolean;
}

export const PWD_PROGRAM: FlagBrowserProgram = {
  api: "/api/pwd-cases",
  noun: "wage request",
  nouns: "wage requests",
  pendingLabel: "In process",
  decidedLabel: "Issued",
  wageLabel: "Wage set",
  allVisasLabel: "Include wage requests for other visas (H-2B, H-1B and the rest)",
};

export const LCA_PROGRAM: FlagBrowserProgram = {
  api: "/api/lca-cases",
  noun: "LCA",
  nouns: "LCAs",
  pendingLabel: "In process",
  decidedLabel: "Decided",
  wageLabel: "Wage offered",
  article: "an",
};

export const SEASONAL_PROGRAM: FlagBrowserProgram = {
  api: "/api/seasonal-cases",
  noun: "H-2A, H-2B or CW-1 filing",
  nouns: "H-2A, H-2B and CW-1 filings",
  pendingLabel: "In process",
  decidedLabel: "Decided",
  // DOL's quarterly H-2A, H-2B and CW-1 files (`seasonal_cases`): the wage the
  // employer offered, in the unit the file quotes (an hour, mostly).
  wageLabel: "Wage offered",
  article: "an",
  showForm: true,
};


const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAGE_SIZE = 50;

const CONTROL =
  "w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-foreground px-5 font-mono text-sm font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";
const CHIP =
  "min-h-[44px] border-2 border-border px-4 font-mono text-sm font-bold uppercase tracking-wider transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary ";


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
  showForm,
}: {
  rows: FlagCaseRow[];
  caption: string;
  /** The file's record for rows it also holds; adds a wage column when non-empty. */
  wages?: Map<string, FlagDisclosedRow>;
  wageLabel?: string;
  showForm?: boolean;
}) {
  const withWage = !!wages && wages.size > 0;
  const [sort, setSort] = useState<SortState>({ key: "filed", dir: -1 });
  const columns: SortColumn<FlagCaseRow>[] = useMemo(() => {
    const cols: SortColumn<FlagCaseRow>[] = [
      ...(showForm ? [{ key: "form", label: "Form", get: (r: FlagCaseRow) => seasonalForm(r.caseNumber)?.label ?? null }] : []),
      { key: "status", label: "Status", get: (r) => r.status },
      { key: "employer", label: "Employer", get: (r) => r.employerName },
      { key: "title", label: "Job title", get: (r) => r.jobTitle },
    ];
    if (withWage) {
      cols.push(
        {
          key: "wage",
          label: wageLabel ?? "Wage",
          descFirst: true,
          get: (r) => wages?.get(r.caseNumber)?.wage ?? null,
        },
        { key: "state", label: "State", get: (r) => wages?.get(r.caseNumber)?.worksiteState ?? null },
        { key: "firm", label: "Law firm", get: (r) => wages?.get(r.caseNumber)?.attorneyName ?? null },
      );
    }
    cols.push(
      { key: "filed", label: "Filed", descFirst: true, get: (r) => r.filingDate },
      { key: "checked", label: "Checked", descFirst: true, get: (r) => r.lastCheckedAt ?? null },
    );
    return cols;
  }, [withWage, wageLabel, wages, showForm]);
  const ordered = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className={"w-full border-collapse text-left text-base " + (withWage ? "min-w-[1100px]" : "min-w-[820px]")}>
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={columns}
          sort={sort}
          onSort={(k) => setSort((cur) => nextSort(cur, k, columns))}
          leading={["Case"]}
        />
        <tbody translate="no" className="bg-card">
          {ordered.map((r) => (
            <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                {/* PendingLink, not Link: /perm-case-status is dynamic, and a
                    number this site does not hold is asked of DOL live at
                    around 3.5 seconds. A bare link there is three seconds of
                    a page that looks like it ignored the click. */}
                <PendingLink
                  href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {r.caseNumber}
                </PendingLink>
              {" "}</td>
              {showForm ? (
                <td className="whitespace-nowrap px-3 py-3 text-sm font-bold">
                  {seasonalForm(r.caseNumber)?.label ?? ""}
                {" "}</td>
              ) : null}
              <td className="whitespace-nowrap px-3 py-3">
                <span className={"border-2 border-border px-2 py-0.5 font-mono text-sm font-bold uppercase " + chip(r.status, r.isFinal)}>
                  {r.status}
                </span>
              {" "}</td>
              <td className="px-3 py-3 font-bold">{r.employerName ?? ""}{" "}</td>
              <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
              {withWage ? (
                <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                  {formatWage(wages?.get(r.caseNumber)?.wage ?? null, wages?.get(r.caseNumber)?.wageUnit ?? null) ?? ""}{" "}
                  <YearlyPayNote wage={wages?.get(r.caseNumber)?.wage} unit={wages?.get(r.caseNumber)?.wageUnit} short />
                {" "}</td>
              ) : null}
              {withWage ? (
                <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                  {wages?.get(r.caseNumber)?.worksiteState ?? ""}
                {" "}</td>
              ) : null}
              {withWage ? (
                <td className="px-3 py-3 text-sm text-foreground/80">
                  {wages?.get(r.caseNumber)?.attorneyName ?? ""}
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
      { key: "state", label: "State", get: (r) => r.worksiteState },
      { key: "soc", label: "Occupation", get: (r) => r.socTitle ?? r.socCode },
      { key: "firm", label: "Law firm", get: (r) => r.attorneyName },
      { key: "visa", label: "Visa", get: (r) => r.visaClass },
      { key: "received", label: "Received", descFirst: true, get: (r) => r.receivedDate },
      { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decisionDate },
    ],
    [wageLabel],
  );
  const ordered = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={columns}
          sort={sort}
          onSort={(k) => setSort((cur) => nextSort(cur, k, columns))}
          leading={["Case"]}
        />
        <tbody translate="no" className="bg-card">
          {ordered.map((r) => (
            <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                {/* PendingLink, not Link: /perm-case-status is dynamic, and a
                    number this site does not hold is asked of DOL live at
                    around 3.5 seconds. A bare link there is three seconds of
                    a page that looks like it ignored the click. */}
                <PendingLink
                  href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {r.caseNumber}
                </PendingLink>
              {" "}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <span className={"border-2 border-border px-2 py-0.5 font-mono text-sm font-bold uppercase " + chip(r.status, true)}>
                  {r.status}
                </span>
              {" "}</td>
              <td className="px-3 py-3 font-bold">{r.employerName ?? ""}{" "}</td>
              <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                {formatWage(r.wage, r.wageUnit) ?? ""}{" "}
                <YearlyPayNote wage={r.wage} unit={r.wageUnit} short />
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{r.worksiteState ?? ""}{" "}</td>
              <td className="px-3 py-3 text-sm text-foreground/80">{r.socTitle ?? r.socCode ?? ""}{" "}</td>
              <td className="px-3 py-3 text-sm text-foreground/80">{r.attorneyName ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{r.visaClass ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{r.receivedDate ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">{r.decisionDate ?? ""}{" "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function money(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** More values than this and a select stops being a way to choose. */
const MAX_OPTIONS = 250;
const FILTER_LABEL = "mb-1 block text-sm font-bold";

/**
 * Narrow one search's loaded rows. Every field past the status comes from
 * DOL's quarterly file, so a row the file doesn't hold yet (anything pending)
 * drops under those filters; the note says so. A field no loaded row carries
 * isn't offered.
 */
function FlagSearchFilters({
  items,
  value,
  onChange,
}: {
  items: readonly FlagFilterItem[];
  value: FlagFilters;
  onChange: (next: FlagFilters) => void;
}) {
  const id = useId();
  const fields = FLAG_FILTER_FIELDS.map((f) => ({ f, opts: flagFacetOptions(items, f) })).filter(
    (x) => x.opts.length > 1 || (x.opts.length === 1 && value[x.f.key] !== undefined),
  );
  const hasWage = items.some((i) => i.file?.wage != null);
  if (fields.length === 0 && !hasWage) return null;
  return (
    <div className="mt-4 border-2 border-border bg-background p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        {fields.map(({ f, opts }) => (
          <Fragment key={f.key}>
            {" "}
            <label className="block" htmlFor={`${id}-${f.key}`}>
              <span className={FILTER_LABEL}>{f.label}</span>{" "}
              <select
                id={`${id}-${f.key}`}
                value={value[f.key] ?? ""}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value || undefined })}
                className={CONTROL}
              >
                <option value="">Any ({formatInt(opts.length)})</option>
                {opts.slice(0, MAX_OPTIONS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {`${o.value} (${formatInt(o.n)})`}
                  </option>
                ))}
              </select>
            </label>
          </Fragment>
        ))}{" "}
        {hasWage ? (
          <>
            <label className="block" htmlFor={`${id}-wmin`}>
              <span className={FILTER_LABEL}>Wage at least</span>{" "}
              <input
                id={`${id}-wmin`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={value.wageMin ?? ""}
                onChange={(e) => onChange({ ...value, wageMin: money(e.target.value) })}
                className={CONTROL}
              />
            </label>{" "}
            <label className="block" htmlFor={`${id}-wmax`}>
              <span className={FILTER_LABEL}>Wage at most</span>{" "}
              <input
                id={`${id}-wmax`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={value.wageMax ?? ""}
                onChange={(e) => onChange({ ...value, wageMax: money(e.target.value) })}
                className={CONTROL}
              />
            </label>
          </>
        ) : null}
      </div>{" "}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">
          These narrow the rows already loaded. State, occupation, firm, visa class and wage come from
          DOL&apos;s quarterly file, so a case still in process drops out under them. Wages are as filed:
          hourly and yearly figures compare as plain numbers.
        </p>{" "}
        {anyFlagFilter(value) ? (
          <button type="button" onClick={() => onChange({})} className={CHIP + "bg-card"}>
            Clear these filters
          </button>
        ) : null}
      </div>
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
  const params = useUrlSearchParams();
  const initial = params.get("q") ?? "";
  const uid = useId();

  // --- search -----------------------------------------------------------
  const [employerInput, setEmployerInput] = useState(initial);
  // Same reason as on the cross-program search: an employer search reads our
  // tables and can only miss on a number, while the lookup asks DOL live.
  const typedCaseNumber = normaliseCaseNumber(employerInput);
  const [titleInput, setTitleInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [allVisasInput, setAllVisasInput] = useState(false);
  // Said when a Search press can't run as typed, so a tap is never answered by nothing.
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [query, setQuery] = useState<{ employer: string; title: string; from: string; to: string; allVisas: boolean; n: number }>({
    employer: initial.trim(),
    title: "",
    from: "",
    to: "",
    allVisas: false,
    n: 0,
  });
  const [filters, setFilters] = useState<FlagFilters>({});

  const searchUrl = useMemo(() => {
    if (query.employer.length < 2) return "skip" as const;
    const p = new URLSearchParams({ action: "search", text: query.employer });
    if (query.title) p.set("title", query.title);
    if (query.from) p.set("from", query.from);
    if (query.to) p.set("to", query.to);
    if (query.allVisas) p.set("visa", "all");
    p.set("s", String(query.n));
    return `${program.api}?${p.toString()}`;
  }, [query, program.api]);
  const { data: search, failed: searchFailed, failure: searchFailure, retry: retrySearch } = usePublicQuery<{ cases: FlagCaseRow[]; disclosed?: FlagDisclosedRow[] }>(searchUrl);
  const searching = query.employer.length >= 2;
  const halves = useMemo(
    () => (search ? mergeHalves(search.cases, search.disclosed ?? []) : null),
    [search],
  );
  const found = search ? search.cases.length + (halves?.fileOnly.length ?? 0) : 0;
  const filterItems = useMemo<FlagFilterItem[]>(() => {
    if (!search || !halves) return [];
    return [
      ...search.cases.map((c) => ({ status: c.status, file: halves.wages.get(c.caseNumber) ?? null })),
      ...halves.fileOnly.map((d) => ({ status: d.status, file: d })),
    ];
  }, [search, halves]);
  const shownLive = useMemo(
    () =>
      search && halves
        ? search.cases.filter((c) =>
            passesFlagFilters({ status: c.status, file: halves.wages.get(c.caseNumber) ?? null }, filters),
          )
        : [],
    [search, halves, filters],
  );
  const shownFile = useMemo(
    () => (halves ? halves.fileOnly.filter((d) => passesFlagFilters({ status: d.status, file: d }, filters)) : []),
    [halves, filters],
  );
  const filtering = anyFlagFilter(filters);
  const searchPending = searching && search === undefined && !searchFailed;

  // --- browse -----------------------------------------------------------
  const [kind, setKind] = useState<FlagKind>("all");
  const [month, setMonth] = useState("");
  // The API reads `order=oldest` from the same index; the oldest filings
  // still in process are the ones people are most likely to be asking about.
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [cursors, setCursors] = useState<string[]>([]);
  const months = useMemo(
    () => (summary ? [...summary.byMonth].sort((a, b) => (a.month < b.month ? 1 : -1)) : []),
    [summary],
  );
  // Every month lists its cases, however few. `withheld`
  // survives as a constant so the render branches below need no rewrite.
  const withheld = false as boolean;
  const listUrl = useMemo(() => {
    if (withheld) return "skip" as const;
    const p = new URLSearchParams({ action: "list", kind, numItems: String(PAGE_SIZE) });
    if (month) p.set("month", month);
    if (order === "oldest") p.set("order", "oldest");
    const cursor = cursors[cursors.length - 1];
    if (cursor) p.set("cursor", cursor);
    return `${program.api}?${p.toString()}`;
  }, [kind, month, order, cursors, withheld, program.api]);
  const { data: page, previous: previousPage, failed: listFailed, failure: listFailure, retry: retryList } = usePublicQuery<FlagListPage>(listUrl);
  // The rows on screen: this page, or the last one while the next loads, so a
  // filter or page change dims the table instead of collapsing it to a line.
  const shownPage = page ?? previousPage;
  const listBusy = page === undefined && !listFailed && shownPage !== undefined;

  return (
    <div className="space-y-10">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Find {program.article ?? "a"} {program.noun} by employer</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
          The start of the employer&apos;s name is enough. Add a word from the job
          title or a filing month if the employer files a lot.
        </p>{" "}
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] [&>*]:min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            // Read the boxes, not only React's copy: see formText.
            const form = e.currentTarget;
            const employer = formText(form, "q", employerInput).trim();
            const title = formText(form, "title", titleInput).trim();
            const from = formText(form, "from", fromInput).trim();
            const to = formText(form, "to", toInput).trim();
            setEmployerInput(employer);
            setTitleInput(title);
            setFromInput(from);
            setToInput(to);
            if (employer.length < 2 && !normaliseCaseNumber(employer)) {
              setSearchNote("Type at least two letters of the employer's name.");
              return;
            }
            const unread = [
              ...(from && !MONTH_RE.test(from) ? ["Filed from"] : []),
              ...(to && !MONTH_RE.test(to) ? ["Filed to"] : []),
            ];
            setSearchNote(
              unread.length > 0
                ? `${unread.join(" and ")} needs a month written like 2026-03, so the search ran without it.`
                : null,
            );
            setQuery((q) => ({
              employer,
              title,
              from: MONTH_RE.test(from) ? from : "",
              to: MONTH_RE.test(to) ? to : "",
              allVisas: allVisasInput,
              n: q.n + 1,
            }));
            setFilters({});
          }}
        >
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold">Employer</span>{" "}
            <input
              type="text"
              name="q"
              value={employerInput}
              onChange={(e) => setEmployerInput(e.target.value)}
              /* 221.7px in a 220px box on a 320px phone: it clipped, and
                 the sentence above the form already says the start of the name
                 is enough. An example is shorter and more use than a rule. */
              placeholder="e.g. Microsoft"
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
              name="title"
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
              <input type="month" name="from" value={fromInput} onChange={(e) => setFromInput(e.target.value)} placeholder="YYYY-MM" className={CONTROL + " min-w-0"} />
            </label>{" "}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed to</span>{" "}
              <input type="month" name="to" value={toInput} onChange={(e) => setToInput(e.target.value)} placeholder="YYYY-MM" className={CONTROL + " min-w-0"} />
            </label>
          </div>{" "}
          {program.allVisasLabel ? (
            <label className="flex min-h-[44px] items-center gap-3 text-base sm:col-span-3">
              <input
                type="checkbox"
                checked={allVisasInput}
                onChange={(e) => setAllVisasInput(e.target.checked)}
                className="size-5 shrink-0 accent-foreground"
              />{" "}
              <span>{program.allVisasLabel}</span>
            </label>
          ) : null}
        </form>{" "}
        {searchNote ? (
          <p role="status" className="mt-3 text-base font-semibold">
            {searchNote}
          </p>
        ) : null}
        {typedCaseNumber ? (
          <p className="mt-4 border-2 border-primary bg-tint-primary p-4 text-base leading-relaxed">
            That is a case number.{" "}
            <PendingLink
              href={`/perm-case-status?case=${encodeURIComponent(typedCaseNumber)}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              Look up {typedCaseNumber} directly
            </PendingLink>{" "}
            and DOL is asked live, which answers even for a filing nothing here
            has recorded yet.
          </p>
        ) : null}
        {searching && searchFailed ? (
          <RequestFailed what="The search" failure={searchFailure} onRetry={retrySearch} className="mt-4 border-2 border-border bg-tint-primary p-4" />
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
        {searching && search && found > 1 ? (
          <FlagSearchFilters items={filterItems} value={filters} onChange={setFilters} />
        ) : null}
        {searching && search && filtering && shownLive.length + shownFile.length === 0 && found > 0 ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
            None of the {formatInt(found)} loaded {found === 1 ? program.noun : program.nouns} match those filters.
            A filing still in process has no state, occupation, firm, visa class or wage until DOL&apos;s
            quarterly file publishes it.
          </p>
        ) : null}
        {searching && search && shownLive.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-foreground/70">
              {filtering ? `${formatInt(shownLive.length)} of ` : ""}
              {formatInt(search.cases.length)} {search.cases.length === 1 ? program.noun : program.nouns} from DOL&apos;s
              daily check, newest filing first
              {search.cases.length >= 200 ? " (the first 200; narrow by title or month for the rest)" : ""}.
              {halves && halves.wages.size > 0
                ? ` ${formatInt(halves.wages.size)} of them ${halves.wages.size === 1 ? "has" : "have"} the wage from DOL's quarterly file.`
                : ""}
            </p>{" "}
            <Rows
              rows={shownLive}
              caption={`${program.nouns} matching the search`}
              wages={halves?.wages}
              wageLabel={program.wageLabel}
              showForm={program.showForm}
            />
          </>
        ) : null}
        {searching && halves && shownFile.length > 0 ? (
          <>
            <h3 className="mt-8 font-heading text-lg font-black">
              {shownLive.length > 0 ? "Earlier, from DOL\u2019s quarterly file" : "From DOL\u2019s quarterly file"}
            </h3>{" "}
            <p className="mt-1 text-sm text-foreground/70">
              {filtering ? `${formatInt(shownFile.length)} of ` : ""}
              {formatInt(halves.fileOnly.length)} decided {halves.fileOnly.length === 1 ? program.noun : program.nouns} with the{" "}
              {program.wageLabel.toLowerCase()}
              {disclosure?.latestDecision ? `, decisions through ${disclosure.latestDecision}` : ""}
              {halves.fileOnly.length >= 200 ? " (the first 200; narrow by title or month for the rest)" : ""}.
            </p>{" "}
            <DisclosedRows
              rows={shownFile}
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
          Search every DOL program at once
        </Link>{" "}
        for the PERM, the wage request, the LCA and any H-2A, H-2B or CW-1 filing side by side.
      </p>

      <section id="browse" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Browse every {program.noun} DOL has confirmed</h2>{" "}
        {summary ? (
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
            {formatInt(summary.total)} {program.nouns} so far: {formatInt(summary.pending)} still in process,{" "}
            {formatInt(summary.decided)} {program.decidedLabel.toLowerCase()}.
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
                {summary && k !== "all" ? ` · ${formatInt(summary[k])}` : ""}
              </button>
              </Fragment>
            ))}
          </div>{" "}
          <label className="ml-auto flex min-h-[44px] items-center gap-2 text-sm font-bold">
            <span>Order</span>{" "}
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value === "oldest" ? "oldest" : "newest");
                setCursors([]);
              }}
              className="min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="newest">{"Newest filing first "}</option>
              <option value="oldest">{"Oldest filing first "}</option>
            </select>
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
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
                  {formatMonth(m.month) ?? m.month} ({formatInt(m.total)})
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        {listFailed ? (
          <RequestFailed what="The list" failure={listFailure} onRetry={retryList} className="mt-4 border-2 border-border bg-tint-primary p-4" />
        ) : null}
        {!withheld && !listFailed && shownPage === undefined ? (
          <p className="mt-4 text-base text-foreground/70">Loading…</p>
        ) : null}
        {!withheld && page && page.rows.length === 0 ? (
          <p className="mt-4 text-base text-foreground/70">Nothing matches that filter.</p>
        ) : null}
        {!withheld && !listFailed && shownPage && shownPage.rows.length > 0 && (page === undefined || page.rows.length > 0) ? (
          <div className={listBusy ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={listBusy}>
            <Rows rows={shownPage.rows} caption={`${program.nouns} from DOL's daily check`} showForm={program.showForm} />
          </div>
        ) : null}
        {!withheld && !listFailed ? (
          <Pager
            id={`${uid}-list-pager`}
            page={cursors.length + 1}
            hasPrevious={cursors.length > 0}
            hasNext={Boolean(page && !page.isDone)}
            loading={page === undefined}
            noun={program.noun.toLowerCase()}
            previousLabel={order === "oldest" ? "Older" : "Newer"}
            nextLabel={order === "oldest" ? "Newer" : "Older"}
            labelClassName="text-sm font-bold"
            buttonClassName={CHIP + "bg-card disabled:opacity-40 disabled:hover:bg-card"}
            onPrevious={() => setCursors((c) => c.slice(0, -1))}
            onNext={() => page && setCursors((c) => [...c, page.continueCursor])}
          >
            <p className="text-sm text-foreground/70">
              &ldquo;Checked&rdquo; is the last day this site asked DOL about it.
            </p>
          </Pager>
        ) : null}
      </section>
    </div>
  );
}
