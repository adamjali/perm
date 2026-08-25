"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// NOT convex/react: this is a PUBLIC page and there is no ConvexProvider
// above it by design. See src/lib/useConvexHttpQuery.ts.
import { useConvexHttpQuery } from "@/lib/useConvexHttpQuery";

import { api } from "../../../convex/_generated/api";

/**
 * The case-level browser.
 *
 * ## Two rules this component exists to keep
 *
 * **A count never comes from counting rows.** Every total on screen comes from
 * the coverage document the ingest wrote, over exactly the rows it emitted.
 * Counting a filtered set would mean reading it, and reading 50,000 rows to
 * print a number is the failure `convex/permCases.ts` is arranged to avoid.
 * Where no exact total exists for the current combination, the page shows the
 * row range and says nothing else, rather than inventing one.
 *
 * **Sorting is offered exactly when it would be true.** The server pages by
 * decision date over an index. Re-sorting one page by wage and labelling the
 * header "Wage" would claim an ordering over the whole slice while delivering
 * an ordering over fifty rows of it. So the column headers become sortable
 * only when the page in hand IS the whole result (`isDone` on page one), and
 * say why when it is not.
 *
 * ## One slice at a time
 *
 * State, occupation, employer and law firm are alternatives, not a stack. Two
 * at once needs its own index and so does every other pair; the API cannot
 * express it and neither can this UI. Picking one clears the others rather
 * than silently ignoring them.
 */

type Status = "certified" | "denied" | "withdrawn";

export interface CaseRow {
  caseNumber: string;
  status: Status;
  receivedDate: string;
  decisionDate: string;
  days: number;
  employerName: string;
  employerSlug: string;
  state: string;
  jobTitle: string;
  socCode: string;
  socTitle: string;
  attorneyName: string;
  attorneySlug: string;
  wage: number | null;
}

export interface CaseMeta {
  sourceFiles: string[];
  totalCases: number;
  firstDecisionDate: string;
  lastDecisionDate: string;
  firstReceivedDate: string;
  lastReceivedDate: string;
  byStatus: { status: Status; count: number }[];
  byFiscalYear: {
    fiscalYear: string;
    total: number;
    certified: number;
    denied: number;
    withdrawn: number;
  }[];
  byState: {
    state: string;
    total: number;
    certified: number;
    denied: number;
    withdrawn: number;
  }[];
  computedAt: number;
}

export interface OccupationOption {
  code: string;
  name: string;
  total: number;
}

type Dimension = "all" | "state" | "occupation" | "employer" | "attorney";
type SortKey = "decisionDate" | "receivedDate" | "days" | "wage" | "employerName" | "caseNumber";

const PAGE_SIZES = [50, 100, 250, 500];
const STATUS_LABEL: Record<Status, string> = {
  certified: "Certified",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

// `min-w-0` belongs here even though every one of these sits in a block-layout
// label inside a grid whose children are already floored: a control that moves
// into a flex row later would otherwise be sized by its content on WebKit and
// only on WebKit. It also puts the class where the repo's own gate can see it -
// that gate reads the attributes on the tag, so a class list hidden in a
// constant is invisible to it and passes for the wrong reason.
const CONTROL =
  "min-h-[44px] w-full min-w-0 border-2 border-border bg-card px-3 py-2 text-base outline-none shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-colors hover:bg-tint-primary disabled:opacity-40 disabled:hover:bg-card focus-visible:ring-2 focus-visible:ring-primary";
const LABEL = "font-mono text-xs font-bold uppercase tracking-wider text-foreground/60";

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtWage(n: number | null): string {
  return n === null ? "—" : `$${n.toLocaleString("en-US")}`;
}

/**
 * A fiscal year as a decision-date range.
 *
 * The federal year starts October 1, so FY2026 runs 2025-10-01 to 2026-09-30.
 * Expressed as a range rather than an equality on a stored `fiscalYear` field
 * because a range composes with every browse index for free, and an equality
 * would have needed an index of its own.
 */
function fiscalYearRange(fy: string): { from: string; to: string } {
  const year = Number(fy);
  return { from: `${year - 1}-10-01`, to: `${year}-09-30` };
}

/** Nulls last in both directions: a missing wage is not a cheap one. */
function compareRows(a: CaseRow, b: CaseRow, key: SortKey, asc: boolean): number {
  const av = a[key];
  const bv = b[key];
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
  return asc ? cmp : -cmp;
}

export function CaseBrowser({
  meta,
  occupations,
}: {
  meta: CaseMeta | null;
  occupations: OccupationOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // --- filter state, seeded from the URL so a filtered view is linkable ----
  const [dimension, setDimension] = useState<Dimension>(() => {
    if (params.get("employer")) return "employer";
    if (params.get("firm")) return "attorney";
    if (params.get("soc")) return "occupation";
    if (params.get("state")) return "state";
    return "all";
  });
  const [stateValue, setStateValue] = useState(() => params.get("state") ?? "");
  const [socValue, setSocValue] = useState(() => params.get("soc") ?? "");
  const [employerSlug, setEmployerSlug] = useState(() => params.get("employer") ?? "");
  const [attorneySlug, setAttorneySlug] = useState(() => params.get("firm") ?? "");
  const [status, setStatus] = useState<Status | "">(() => {
    const raw = params.get("status");
    return raw === "certified" || raw === "denied" || raw === "withdrawn" ? raw : "";
  });
  const [fiscalYear, setFiscalYear] = useState(() => params.get("fy") ?? "");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [pageSize, setPageSize] = useState(50);

  // --- paging: an explicit cursor stack, because Convex cursors are opaque
  // and a "page 3" button needs the cursor page 3 started at.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const pageIndex = cursors.length - 1;

  // --- client-side sort, live only when the page in hand is the whole result
  const [sortKey, setSortKey] = useState<SortKey>("decisionDate");
  const [sortAsc, setSortAsc] = useState(false);

  // --- the two lookups that are not the browse table ----------------------
  const [caseInput, setCaseInput] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [nameField, setNameField] = useState<"employer" | "attorney">("employer");
  const [nameQuery, setNameQuery] = useState("");

  const slice = useMemo(() => {
    switch (dimension) {
      case "state":
        return { kind: "state" as const, state: stateValue };
      case "occupation":
        return { kind: "occupation" as const, socCode: socValue };
      case "employer":
        return { kind: "employer" as const, employerSlug };
      case "attorney":
        return { kind: "attorney" as const, attorneySlug };
      default:
        return { kind: "all" as const };
    }
  }, [dimension, stateValue, socValue, employerSlug, attorneySlug]);

  const range = fiscalYear ? fiscalYearRange(fiscalYear) : null;
  const filter = useMemo(
    () => ({
      slice,
      ...(status ? { status } : {}),
      ...(range ? { from: range.from, to: range.to } : {}),
    }),
    [slice, status, range?.from, range?.to],
  );

  // Any change to what is being asked invalidates every cursor: a cursor is a
  // position in one specific ordered stream, and handing it to a different
  // one is not an error, it is a wrong answer.
  const filterKey = JSON.stringify({ filter, order, pageSize });
  useEffect(() => {
    setCursors([null]);
  }, [filterKey]);

  // Keep the URL in step so the view can be shared and linked into.
  useEffect(() => {
    const next = new URLSearchParams();
    if (dimension === "state" && stateValue) next.set("state", stateValue);
    if (dimension === "occupation" && socValue) next.set("soc", socValue);
    if (dimension === "employer" && employerSlug) next.set("employer", employerSlug);
    if (dimension === "attorney" && attorneySlug) next.set("firm", attorneySlug);
    if (status) next.set("status", status);
    if (fiscalYear) next.set("fy", fiscalYear);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [dimension, stateValue, socValue, employerSlug, attorneySlug, status, fiscalYear, pathname, router]);

  const page = useConvexHttpQuery(api.permCases.listCases, {
    paginationOpts: { numItems: pageSize, cursor: cursors[pageIndex] ?? null },
    filter,
    order,
  });

  const caseHit = useConvexHttpQuery(
    api.permCases.lookupByCaseNumber,
    caseQuery ? { caseNumber: caseQuery } : "skip",
  );

  const nameHits = useConvexHttpQuery(
    api.permCases.searchCases,
    nameQuery.length >= 2 ? { field: nameField, text: nameQuery, limit: 50 } : "skip",
  );

  const rows = page?.page ?? [];
  const isFirstPage = pageIndex === 0;
  // The whole result is in hand exactly when the first page is also the last.
  // That is the only condition under which sorting a column is a statement
  // about the slice rather than about fifty rows of it.
  const sortable = Boolean(page?.isDone) && isFirstPage;
  const sorted = useMemo(
    () => (sortable ? [...rows].sort((a, b) => compareRows(a, b, sortKey, sortAsc)) : rows),
    [rows, sortable, sortKey, sortAsc],
  );

  /**
   * The exact size of this slice, when one is known.
   *
   * Known for the whole corpus, for a status, for a state, for a fiscal year,
   * and for a state or fiscal year narrowed by status, because the ingest
   * counted all of those in the pass that wrote the rows. Not known for an
   * occupation, employer or law firm combined with anything, and in that case
   * this returns null and the UI shows a row range instead of a total. A
   * guessed total is worse than no total.
   */
  const exactTotal = useMemo((): number | null => {
    if (!meta) return null;
    const pick = (row: { total: number; certified: number; denied: number; withdrawn: number } | undefined) =>
      row ? (status ? row[status] : row.total) : null;
    if (dimension === "state" && stateValue !== "") {
      return pick(meta.byState.find((r) => r.state === stateValue));
    }
    if (dimension !== "all") return null;
    if (fiscalYear) return pick(meta.byFiscalYear.find((r) => r.fiscalYear === fiscalYear));
    if (status) return meta.byStatus.find((r) => r.status === status)?.count ?? null;
    return meta.totalCases;
  }, [meta, dimension, stateValue, fiscalYear, status]);

  const firstRow = pageIndex * pageSize + (rows.length > 0 ? 1 : 0);
  const lastRow = pageIndex * pageSize + rows.length;

  const clearAll = useCallback(() => {
    setDimension("all");
    setStateValue("");
    setSocValue("");
    setEmployerSlug("");
    setAttorneySlug("");
    setStatus("");
    setFiscalYear("");
    setNameInput("");
    setNameQuery("");
  }, []);

  const pickDimension = useCallback((next: Dimension) => {
    // One slice at a time. Clearing the others is what makes that true rather
    // than merely documented.
    setDimension(next);
    if (next !== "state") setStateValue("");
    if (next !== "occupation") setSocValue("");
    if (next !== "employer") setEmployerSlug("");
    if (next !== "attorney") setAttorneySlug("");
  }, []);

  const sortBy = useCallback(
    (key: SortKey) => {
      if (!sortable) return;
      if (key === sortKey) {
        setSortAsc((prev) => !prev);
        return;
      }
      setSortKey(key);
      setSortAsc(key === "employerName" || key === "caseNumber");
    },
    [sortable, sortKey],
  );

  const columns: { key: SortKey | null; label: string; numeric?: boolean; hideOnPhone?: boolean }[] = [
    { key: "caseNumber", label: "Case" },
    { key: null, label: "Status" },
    { key: "employerName", label: "Employer" },
    { key: null, label: "Job title", hideOnPhone: true },
    { key: null, label: "State" },
    { key: null, label: "Occupation", hideOnPhone: true },
    { key: "wage", label: "Wage", numeric: true },
    { key: "receivedDate", label: "Filed", numeric: true, hideOnPhone: true },
    { key: "decisionDate", label: "Decided", numeric: true },
    { key: "days", label: "Days", numeric: true },
  ];

  const searching = nameQuery.length >= 2;
  const shown: CaseRow[] = searching ? (nameHits ?? []) : sorted;

  return (
    <div className="flex flex-col gap-8">
      {/* ---------------------------------------------------------------- */}
      {/* Look up one case                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Look up a case number</h2>{" "}
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] [&>*]:min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            setCaseQuery(caseInput.trim());
          }}
        >
          <label className="block">
            <span className="sr-only">Case number</span>{" "}
            <input
              type="text"
              value={caseInput}
              onChange={(e) => setCaseInput(e.target.value)}
              placeholder="A-24123-45678"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              className={CONTROL}
            />
          </label>{" "}
          <button type="submit" className={`${BUTTON} bg-primary text-primary-foreground`}>
            Look it up
          </button>
        </form>
        {caseQuery !== "" && caseHit === undefined ? (
          <p className="mt-4 text-base text-foreground/60">Checking…</p>
        ) : null}
        {caseQuery !== "" && caseHit === null ? (
          <div className="mt-4 border-2 border-border bg-tint-primary p-4">
            <p className="text-base font-bold">
              No case with that number in this window.
            </p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/70">
              That isn’t the same as no such case. DOL&apos;s disclosure files carry
              decided cases only, so a case still waiting on a determination
              appears in none of them. If yours is pending, the{" "}
              <Link
                href="/perm-processing-times"
                className="font-bold underline decoration-primary decoration-2 underline-offset-2"
              >
                queue page
              </Link>{" "}
              is where to look instead.
            </p>
          </div>
        ) : null}
        {caseHit ? (
          <div className="mt-4 overflow-x-auto border-2 border-border">
            <CaseTable
              rows={[caseHit]}
              columns={columns}
              sortable={false}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={sortBy}
              caption={`Case ${caseHit.caseNumber}`}
            />
          </div>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Filters                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <h2 className="font-heading text-xl font-black">Browse the cases</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          Slice by one of state, occupation, employer or law firm, then narrow
          by outcome and year. One slice at a time: picking a new one clears the
          last.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <label className="block">
            <span className={LABEL}>Slice by</span>{" "}
            <select
              value={dimension}
              onChange={(e) => pickDimension(e.target.value as Dimension)}
              className={CONTROL}
            >
              <option value="all">Everything</option>
              <option value="state">State</option>
              <option value="occupation">Occupation</option>
              {employerSlug ? <option value="employer">Employer</option> : null}
              {attorneySlug ? <option value="attorney">Law firm</option> : null}
            </select>
          </label>

          {dimension === "state" ? (
            <label className="block">
              <span className={LABEL}>State</span>{" "}
              <select
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                className={CONTROL}
              >
                <option value="">Pick a state</option>
                {(meta?.byState ?? []).map((s) => (
                  <option key={s.state || "none"} value={s.state}>
                    {s.state === "" ? "Not published" : s.state} ({fmtInt(s.total)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {dimension === "occupation" ? (
            <label className="block">
              <span className={LABEL}>Occupation</span>{" "}
              <select
                value={socValue}
                onChange={(e) => setSocValue(e.target.value)}
                className={CONTROL}
              >
                <option value="">Pick an occupation</option>
                {occupations.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name} ({fmtInt(o.total)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {dimension === "employer" && employerSlug ? (
            <div className="flex min-h-[44px] items-center justify-between gap-2 border-2 border-border bg-tint-primary px-3 shadow-hard-sm">
              <span className="truncate text-base font-bold">{employerSlug}</span>{" "}
              <button type="button" onClick={clearAll} className="shrink-0 text-sm underline">
                Clear
              </button>
            </div>
          ) : null}

          {dimension === "attorney" && attorneySlug ? (
            <div className="flex min-h-[44px] items-center justify-between gap-2 border-2 border-border bg-tint-primary px-3 shadow-hard-sm">
              <span className="truncate text-base font-bold">{attorneySlug}</span>{" "}
              <button type="button" onClick={clearAll} className="shrink-0 text-sm underline">
                Clear
              </button>
            </div>
          ) : null}

          <label className="block">
            <span className={LABEL}>Outcome</span>{" "}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status | "")}
              className={CONTROL}
            >
              <option value="">Any outcome</option>
              {(meta?.byStatus ?? []).map((s) => (
                <option key={s.status} value={s.status}>
                  {STATUS_LABEL[s.status]} ({fmtInt(s.count)})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={LABEL}>Fiscal year of decision</span>{" "}
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className={CONTROL}
            >
              <option value="">Every year in the window</option>
              {(meta?.byFiscalYear ?? []).map((y) => (
                <option key={y.fiscalYear} value={y.fiscalYear}>
                  FY{y.fiscalYear} ({fmtInt(y.total)})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <label className="block">
            <span className={LABEL}>Order</span>{" "}
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "newest" | "oldest")}
              className={CONTROL}
            >
              <option value="newest">Newest decision first</option>
              <option value="oldest">Oldest decision first</option>
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Rows per page</span>{" "}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={CONTROL}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={clearAll} className={BUTTON}>
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Search by name                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
        <h2 className="font-heading text-lg font-black">Search by employer or law firm</h2>{" "}
        <form
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto] [&>*]:min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            setNameQuery(nameInput.trim());
          }}
        >
          <label className="block">
            <span className="sr-only">Search in</span>{" "}
            <select
              value={nameField}
              onChange={(e) => setNameField(e.target.value as "employer" | "attorney")}
              className={CONTROL}
            >
              <option value="employer">Employer</option>
              <option value="attorney">Law firm</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Name</span>{" "}
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Part of a name"
              maxLength={120}
              autoComplete="off"
              className={CONTROL}
            />
          </label>{" "}
          <button type="submit" className={BUTTON}>
            Search
          </button>
        </form>
        {searching ? (
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            Showing the best {nameHits ? fmtInt(nameHits.length) : "…"} name
            matches, ordered by how well they match rather than by date, and
            capped. The filters above don’t apply to a name search.{" "}
            <button
              type="button"
              onClick={() => {
                setNameInput("");
                setNameQuery("");
              }}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2"
            >
              Back to browsing
            </button>
          </p>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The table                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p aria-live="polite" className="text-base text-foreground/70">
            {searching ? (
              <span>Name matches</span>
            ) : exactTotal !== null ? (
              <span>
                <strong className="font-bold">{fmtInt(exactTotal)}</strong>{" "}
                {exactTotal === 1 ? "case" : "cases"} match. Showing{" "}
                {fmtInt(firstRow)} to {fmtInt(lastRow)}.
              </span>
            ) : (
              <span>
                Showing {fmtInt(firstRow)} to {fmtInt(lastRow)}
                {page?.isDone && isFirstPage ? ` of ${fmtInt(rows.length)}` : ""}.
              </span>
            )}
          </p>
          {!searching && !sortable && rows.length > 0 ? (
            <p className="text-sm text-foreground/60">
              More than one page matches, so the table stays in decision-date
              order. Narrow the filter, or raise the rows per page, to sort by
              any column.
            </p>
          ) : null}
        </div>

        {page === undefined && !searching ? (
          <p className="mt-6 text-base text-foreground/60">Reading the case table…</p>
        ) : null}

        {shown.length === 0 && (searching ? nameHits !== undefined : page !== undefined) ? (
          <div className="mt-6 border-2 border-border bg-card p-6 shadow-hard-sm">
            <p className="text-base text-foreground/70">
              Nothing matches that combination in this disclosure window.
            </p>
          </div>
        ) : null}

        {shown.length > 0 ? (
          <div className="mt-4 overflow-x-auto border-2 border-border shadow-hard-sm">
            <CaseTable
              rows={shown}
              columns={columns}
              sortable={!searching && sortable}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={sortBy}
              caption="PERM cases with outcome, employer, job, wage and decision dates"
            />
          </div>
        ) : null}

        {!searching && rows.length > 0 ? (
          <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={LABEL}>Page {fmtInt(pageIndex + 1)}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={BUTTON}
                disabled={isFirstPage}
                onClick={() => setCursors((c) => (c.length > 1 ? c.slice(0, -1) : c))}
              >
                Previous
              </button>{" "}
              <button
                type="button"
                className={BUTTON}
                disabled={page?.isDone !== false}
                onClick={() =>
                  setCursors((c) =>
                    page && !page.isDone ? [...c, page.continueCursor] : c,
                  )
                }
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function CaseTable({
  rows,
  columns,
  sortable,
  sortKey,
  sortAsc,
  onSort,
  caption,
}: {
  rows: CaseRow[];
  columns: { key: SortKey | null; label: string; numeric?: boolean; hideOnPhone?: boolean }[];
  sortable: boolean;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  caption: string;
}) {
  return (
    <table className="w-full min-w-[880px] border-collapse text-left text-base">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-foreground text-background">
        <tr>
          {columns.map((c) => {
            const active = sortable && c.key === sortKey;
            const canSort = sortable && c.key !== null;
            return (
              <th
                key={c.label}
                scope="col"
                aria-sort={active ? (sortAsc ? "ascending" : "descending") : undefined}
                className={
                  "whitespace-nowrap px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider " +
                  (c.numeric ? "text-right " : "") +
                  (c.hideOnPhone ? "hidden sm:table-cell " : "")
                }
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => (c.key ? onSort(c.key) : undefined)}
                    className="min-h-[44px] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {c.label}
                    {active ? (sortAsc ? " ↑" : " ↓") : ""}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="bg-card">
        {rows.map((r) => (
          <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
            <td className="whitespace-nowrap px-3 py-3 font-mono text-base">{r.caseNumber}</td>
            <td className="whitespace-nowrap px-3 py-3">
              <span
                className={
                  "border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " +
                  (r.status === "certified"
                    ? "bg-primary text-primary-foreground"
                    : r.status === "denied"
                      ? "bg-foreground text-background"
                      : "bg-card")
                }
              >
                {STATUS_LABEL[r.status]}
              </span>
            </td>
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
              {r.attorneyName ? (
                <>
                  {" "}
                  <span className="block text-sm text-foreground/70">
                    {r.attorneySlug ? (
                      <Link
                        href={`/perm-attorneys/${r.attorneySlug}`}
                        className="underline decoration-border decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.attorneyName}
                      </Link>
                    ) : (
                      r.attorneyName
                    )}
                  </span>
                </>
              ) : null}
            </td>
            <td className="hidden px-3 py-3 sm:table-cell">{r.jobTitle || "—"}</td>
            <td className="whitespace-nowrap px-3 py-3">{r.state || "—"}</td>
            <td className="hidden px-3 py-3 sm:table-cell">
              {r.socTitle || r.socCode || "—"}
              {r.socCode ? (
                <>
                  {" "}
                  <span className="block font-mono text-sm text-foreground/60">{r.socCode}</span>
                </>
              ) : null}
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
              {fmtWage(r.wage)}
            </td>
            <td className="hidden whitespace-nowrap px-3 py-3 text-right font-mono text-base tabular-nums sm:table-cell">
              {r.receivedDate}
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-base tabular-nums">
              {r.decisionDate}
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
              {fmtInt(r.days)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
