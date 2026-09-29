"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { Pager } from "@/components/ui/pager";
import { PendingLink } from "@/components/ui/pending-link";
import { formatMonth } from "@/lib/dolFormat";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module. Keep the path on the `import type`.
import type { FlagCaseRow, FlagDisclosedRow, FlagDisclosureSummary, FlagKind, FlagListPage, FlagSummary } from "@/lib/turso/flagCases";
import { formatWage } from "@/lib/wageFormat";
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
};


const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAGE_SIZE = 50;

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
  }, [withWage, wageLabel, wages]);
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
                <span className={"border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chip(r.status, true)}>
                  {r.status}
                </span>
              {" "}</td>
              <td className="px-3 py-3 font-bold">{r.employerName ?? ""}{" "}</td>
              <td className="px-3 py-3 text-foreground/80">{r.jobTitle ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">{formatWage(r.wage, r.wageUnit) ?? ""}{" "}</td>
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
                <option value="">Any ({fmt(opts.length)})</option>
                {opts.slice(0, MAX_OPTIONS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {`${o.value} (${fmt(o.n)})`}
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
          These narrow the rows already loaded. The state, occupation, law firm,
          visa class and wage come from DOL&apos;s quarterly file, so a filing
          still in process drops under them until DOL publishes it. Wages are as
          filed, so an hourly and a yearly figure compare as numbers.
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
  const params = useSearchParams();
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
  const cohort = month ? months.find((m) => m.month === month) ?? null : null;
  // Every month lists, however small (owner's call, Sep 8 2026). `withheld`
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
  const { data: page, failed: listFailed, failure: listFailure, retry: retryList } = usePublicQuery<FlagListPage>(listUrl);

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
            None of the {fmt(found)} loaded {found === 1 ? program.noun : program.nouns} match those filters.
            A filing still in process has no state, occupation, firm, visa class or wage until DOL&apos;s
            quarterly file publishes it.
          </p>
        ) : null}
        {searching && search && shownLive.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-foreground/70">
              {filtering ? `${fmt(shownLive.length)} of ` : ""}
              {fmt(search.cases.length)} {search.cases.length === 1 ? program.noun : program.nouns} from DOL&apos;s
              daily check, newest filing first
              {search.cases.length >= 200 ? " (the first 200; narrow by title or month for the rest)" : ""}.
              {halves && halves.wages.size > 0
                ? ` ${fmt(halves.wages.size)} of them ${halves.wages.size === 1 ? "has" : "have"} the wage from DOL's quarterly file.`
                : ""}
            </p>{" "}
            <Rows
              rows={shownLive}
              caption={`${program.nouns} matching the search`}
              wages={halves?.wages}
              wageLabel={program.wageLabel}
            />
          </>
        ) : null}
        {searching && halves && shownFile.length > 0 ? (
          <>
            <h3 className="mt-8 font-heading text-lg font-black">
              {shownLive.length > 0 ? "Earlier, from DOL\u2019s quarterly file" : "From DOL\u2019s quarterly file"}
            </h3>{" "}
            <p className="mt-1 text-sm text-foreground/70">
              {filtering ? `${fmt(shownFile.length)} of ` : ""}
              {fmt(halves.fileOnly.length)} decided {halves.fileOnly.length === 1 ? program.noun : program.nouns} with the{" "}
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
          Search all three DOL programs at once
        </Link>{" "}
        for the PERM, the wage request and the LCA side by side.
      </p>

      <section id="browse" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Browse every {program.noun} DOL has confirmed</h2>{" "}
        {summary ? (
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
            {fmt(summary.total)} {program.nouns} so far: {fmt(summary.pending)} still in process,{" "}
            {fmt(summary.decided)} {program.decidedLabel.toLowerCase()}.
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
                  {formatMonth(m.month) ?? m.month} ({fmt(m.total)})
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        {listFailed ? (
          <RequestFailed what="The list" failure={listFailure} onRetry={retryList} className="mt-4 border-2 border-border bg-tint-primary p-4" />
        ) : null}
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
