"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// A public page has no ConvexProvider above it by design, and the Turso
// client is server-only, so the reads go through /api/perm-cases. See
// src/lib/usePublicQuery.ts.
import { usePublicQuery } from "@/lib/usePublicQuery";
import { Pager } from "@/components/ui/pager";
import { LinkPending, PendingLink } from "@/components/ui/pending-link";
// TYPE ONLY, and that is what makes it legal here. `@/lib/turso/cases` imports
// `server-only`, so a value import would be a build error in a client
// component - correctly, because the token behind it grants access to the
// whole database. A type import compiles to nothing, and it is worth having:
// the response shape is a JSON boundary, so a field renamed on the server
// would otherwise fail at runtime instead of at compile time.
import type { CasePage } from "@/lib/turso/cases";

/**
 * The case-level browser.
 *
 * ## Two rules this component exists to keep
 *
 * **A count never comes from counting rows.** Every total on screen comes from
 * the coverage document the ingest wrote, over exactly the rows it emitted.
 * Counting a filtered set would mean reading it, and reading 50,000 rows to
 * print a number is the failure `src/lib/turso/cases.ts` is arranged to avoid.
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

/** A live-feed case: fresher than the published files, thinner on fields. */
interface LiveHit {
  caseNumber: string;
  filingDate: string | null;
  status: string | null;
  isFinal: boolean;
  employerName: string | null;
  jobTitle: string | null;
}

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
/** What the month inputs must hold before a filter is sent. */
const MONTH_INPUT_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

  // --- paging: an explicit cursor stack, because a cursor is opaque to this
  // component and a "page 3" button needs the cursor page 3 started at.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const pageIndex = cursors.length - 1;

  // --- client-side sort, live only when the page in hand is the whole result
  const [sortKey, setSortKey] = useState<SortKey>("decisionDate");
  const [sortAsc, setSortAsc] = useState(false);

  // --- the two lookups that are not the browse table ----------------------
  const [caseInput, setCaseInput] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [nameInput, setNameInput] = useState("");
  // The narrowing filters: title contains, filed between. Applied on submit
  // like the name, so a half-typed month never fires a request.
  const [titleInput, setTitleInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [narrow, setNarrow] = useState<{ title: string; from: string; to: string }>({
    title: "",
    from: "",
    to: "",
  });
  const [nameField, setNameField] = useState<"employer" | "attorney">("employer");
  const [nameQuery, setNameQuery] = useState("");
  // A submit counter, folded into each lookup url. Without it, pressing the
  // button again with an UNCHANGED value is a no-op: the url does not change,
  // so usePublicQuery does not re-run - which after a failure looks like a dead
  // page. Bumping the counter on every submit (and on an explicit retry) forces
  // a fresh request. Manual lookups are rare and mostly unique numbers, so the
  // lost edge-cache sharing is negligible.
  const [caseSubmit, setCaseSubmit] = useState(0);
  const [nameSubmit, setNameSubmit] = useState(0);
  const [listSubmit, setListSubmit] = useState(0);

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

  // One url per distinct question, so the hook's dependency is the question
  // itself and a repeat is served from the edge cache rather than Turso.
  /**
   * A dimension is picked but its value is not.
   *
   * The empty option is a real, addressable slice on the server: 12,017 cases
   * genuinely carry a blank worksite state, so `state=""` returns them. That
   * is correct as an API contract and wrong as a default view - someone who
   * has chosen "State" and not yet chosen one is mid-thought, not asking for
   * the cases DOL left blank. Prompt instead of answering a question they did
   * not ask.
   */
  const awaitingValue =
    (dimension === "state" && stateValue === "") ||
    (dimension === "occupation" && socValue === "") ||
    (dimension === "employer" && employerSlug === "") ||
    (dimension === "attorney" && attorneySlug === "");

  const dimensionLabel =
    dimension === "state"
      ? "a state"
      : dimension === "occupation"
        ? "an occupation"
        : dimension === "employer"
          ? "an employer"
          : "a law firm";

  const listUrl = useMemo(() => {
    if (awaitingValue) return "skip" as const;
    const p = new URLSearchParams({ action: "list", kind: filter.slice.kind });
    const s = filter.slice;
    if (s.kind === "state") p.set("state", s.state);
    else if (s.kind === "occupation") p.set("soc", s.socCode);
    else if (s.kind === "employer") p.set("employer", s.employerSlug);
    else if (s.kind === "attorney") p.set("firm", s.attorneySlug);
    if (filter.status) p.set("status", filter.status);
    if (filter.from) p.set("from", filter.from);
    if (filter.to) p.set("to", filter.to);
    p.set("order", order);
    p.set("numItems", String(pageSize));
    const cursor = cursors[pageIndex];
    if (cursor) p.set("cursor", cursor);
    if (listSubmit) p.set("s", String(listSubmit));
    return `/api/perm-cases?${p.toString()}`;
  }, [filter, order, pageSize, cursors, pageIndex, awaitingValue, listSubmit]);

  const { data: page, failed: pageFailed } = usePublicQuery<CasePage>(listUrl);

  const { data: lookupData, failed: caseFailed } = usePublicQuery<{
    disclosed: CaseRow | null;
    live: LiveHit | null;
  }>(
    caseQuery
      ? `/api/perm-cases?action=lookup&caseNumber=${encodeURIComponent(caseQuery)}&s=${caseSubmit}`
      : "skip",
  );
  const caseHit = lookupData?.disclosed ?? null;
  const caseLookupPending = caseQuery !== "" && lookupData === undefined && !caseFailed;
  const liveHit = lookupData?.live ?? null;

  const { data: searchData, failed: nameFailed } = usePublicQuery<{
    cases: CaseRow[];
    live: LiveHit[];
  }>(
    nameQuery.length >= 2
      ? `/api/perm-cases?action=search&field=${nameField}&limit=100&text=${encodeURIComponent(nameQuery)}` +
          (narrow.title ? `&title=${encodeURIComponent(narrow.title)}` : "") +
          (narrow.from ? `&from=${narrow.from}` : "") +
          (narrow.to ? `&to=${narrow.to}` : "") +
          `&s=${nameSubmit}`
      : "skip",
  );
  const nameHits = searchData?.cases;
  const liveHits = searchData?.live ?? [];
  const nameSearchPending = nameQuery.length >= 2 && searchData === undefined && !nameFailed;

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

  // Hold the last non-empty result set so a page change or a new search dims
  // the current rows in place instead of collapsing to nothing and jumping the
  // layout - the SalaryExplorer pattern.
  //
  // STATE SET FROM AN EFFECT, not a ref written during render. Reading and
  // writing a ref mid-render is unsafe under concurrent rendering, because
  // React may discard a render and re-run it, leaving the ref holding a value
  // from a render that never committed. `react-hooks/refs` rejects it.
  //
  // An effect is the right shape here rather than the "adjust state during
  // render" pattern, because `prevRows` is only ever READ on a render where
  // `shown` is empty. The retained set is therefore never needed on the same
  // render that produces it, so updating it after commit costs nothing
  // visible, and it cannot loop: the write is guarded on `shown` being
  // non-empty, and an empty `shown` is the only value whose identity changes
  // every render (`page?.page ?? []`).
  const tableBusy =
    (searching ? nameSearchPending : page === undefined && !pageFailed && !awaitingValue);
  const [prevRows, setPrevRows] = useState<CaseRow[]>([]);
  useEffect(() => {
    if (shown.length > 0) setPrevRows(shown);
  }, [shown]);
  const displayRows: CaseRow[] =
    shown.length > 0 ? shown : tableBusy ? prevRows : [];

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
            setCaseSubmit((s) => s + 1);
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
          <button
            type="submit"
            className={`${BUTTON} bg-primary text-primary-foreground`}
            disabled={caseLookupPending}
            aria-busy={caseLookupPending}
          >
            {caseLookupPending ? "Checking…" : "Look it up"}
          </button>
        </form>
        {caseFailed ? (
          <div className="mt-4">
            <p className="text-base text-foreground/70">
              The case table couldn’t be reached just now. That’s a fault at our
              end.
            </p>{" "}
            <button
              type="button"
              className={`${BUTTON} mt-3`}
              onClick={() => setCaseSubmit((s) => s + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}
        {caseQuery !== "" && lookupData && !caseHit && liveHit ? (
          /* Not published yet, but DOL's live system knows it - the case the
             disclosure files cannot show for another quarter. */
          <div className="mt-4 border-2 border-border bg-tint-primary p-4">
            <p className="text-base font-bold">
              Found in DOL&apos;s live system - not yet in the published files.
            </p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/70">
              {liveHit.employerName ?? "This case"}
              {liveHit.jobTitle ? ` · ${liveHit.jobTitle}` : ""}
              {liveHit.filingDate ? ` · filed ${liveHit.filingDate}` : ""} ·
              status <b className="font-bold">{liveHit.status ?? "on file"}</b>.
              Details like the law firm and wage appear when DOL publishes the
              decided case.
            </p>{" "}
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(liveHit.caseNumber)}`}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-4 font-heading font-black text-primary-foreground shadow-hard-sm"
            >
              <LinkPending />
              View the live status
            </Link>
          </div>
        ) : null}
        {caseQuery !== "" && lookupData && !caseHit && !liveHit ? (
          <div className="mt-4 border-2 border-border bg-tint-primary p-4">
            <p className="text-base font-bold">
              No case with that number in this window.
            </p>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/70">
              DOL&apos;s disclosure files carry decided cases only, and our live
              feed hasn&apos;t seen this number either. It may be very new:{" "}
              <PendingLink
                href={`/perm-case-status?case=${encodeURIComponent(caseQuery)}`}
                className="font-bold underline decoration-primary decoration-2 underline-offset-2"
              >
                check it against DOL&apos;s live system
              </PendingLink>
              , which asks DOL directly and remembers the answer.
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
              {/* The `{" "}` between adjacent options is the same glued-JSX
                  fix the rest of the app carries. JSX drops the newline
                  between two elements, so an extractor walking the DOM reads
                  "EverythingStateOccupation" as one run. Whitespace between
                  options is valid inside a select and is ignored when the
                  control is rendered, so it costs nothing visually.

                  Only the boundaries where a word character meets a word
                  character are worth spacing. The options built by `.map()`
                  below all end in a count - "Alabama (1,234)" - so their
                  boundary is ")" against a letter, which no reader or
                  extractor mistakes for a compound word. That is the same
                  predicate `scripts/audit_glued_text.py` uses, and it is why
                  it flagged three pairs on this page rather than dozens. */}
              <option value="all">Everything</option>{" "}
              <option value="state">State</option>{" "}
              <option value="occupation">Occupation</option>{" "}
              {employerSlug ? <option value="employer">Employer</option> : null}{" "}
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
              <option value="newest">Newest decision first</option>{" "}
              <option value="oldest">Oldest decision first</option>
            </select>
          </label>{" "}
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
            setNarrow({
              title: titleInput.trim(),
              from: MONTH_INPUT_RE.test(fromInput) ? fromInput : "",
              to: MONTH_INPUT_RE.test(toInput) ? toInput : "",
            });
            setNameSubmit((s) => s + 1);
          }}
        >
          <label className="block">
            <span className="sr-only">Search in</span>{" "}
            <select
              value={nameField}
              onChange={(e) => setNameField(e.target.value as "employer" | "attorney")}
              className={CONTROL}
            >
              <option value="employer">Employer</option>{" "}
              <option value="attorney">Law firm</option>
            </select>
          </label>{" "}
          <label className="block">
            <span className="sr-only">Name</span>{" "}
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Start of a name"
              maxLength={120}
              autoComplete="off"
              className={CONTROL}
            />
          </label>{" "}
          <button
            type="submit"
            className={BUTTON}
            disabled={nameSearchPending}
            aria-busy={nameSearchPending}
          >
            {nameSearchPending ? "Searching…" : "Search"}
          </button>{" "}
          {/* Narrowing: the two facts an applicant has besides the employer.
              Optional, and they narrow both halves - the published cases by
              the month DOL received them, the live ones by filing date. */}
          <label className="block sm:col-start-2">
            <span className="mb-1 block text-sm font-bold">Job title contains</span>{" "}
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. software, analyst"
              maxLength={80}
              autoComplete="off"
              className={CONTROL}
            />
          </label>{" "}
          <div className="grid grid-cols-2 gap-3 sm:col-start-2 [&>*]:min-w-0">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed from</span>{" "}
              <input
                type="month"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                placeholder="YYYY-MM"
                pattern="\\d{4}-\\d{2}"
                className={CONTROL + " min-w-0"}
              />
            </label>{" "}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Filed to</span>{" "}
              <input
                type="month"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="YYYY-MM"
                pattern="\\d{4}-\\d{2}"
                className={CONTROL + " min-w-0"}
              />
            </label>
          </div>
        </form>
        {searching && nameField === "employer" && liveHits.length > 0 ? (
          /* The live strip: the exact case Adam searched for and could not
             find - filings newer than the last disclosure file, from DOL's
             live feed, each linking to its own status page. */
          <div className="mt-4 border-2 border-border bg-tint-primary p-4">
            <p className="text-base font-bold">
              {narrow.title || narrow.from || narrow.to
                ? "Matching filings - live from DOL, not yet in the published files"
                : "Newest filings - live from DOL, not yet in the published files"}
            </p>{" "}
            <ul className="mt-2 divide-y divide-border/60">
              {liveHits.map((h) => (
                <Fragment key={h.caseNumber}>{" "}
                <li
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base"
                >
                  {/* PendingLink: /perm-case-status is dynamic and can ask
                      DOL live, so a bare link is seconds of silence. */}
                  <PendingLink
                    href={`/perm-case-status?case=${encodeURIComponent(h.caseNumber)}`}
                    className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2"
                  >
                    {h.caseNumber}
                  </PendingLink>{" "}
                  <span className="font-medium">{h.employerName}</span>{" "}
                  {h.jobTitle ? (
                    <span className="text-foreground/70">{h.jobTitle}</span>
                  ) : null}{" "}
                  <span className="ml-auto text-sm text-foreground/70">
                    {h.filingDate ? `filed ${h.filingDate} · ` : ""}
                    {h.status ?? ""}
                  </span>
                </li>
                </Fragment>
              ))}
            </ul>{" "}
            <p className="mt-2 text-sm text-foreground/70">
              The law firm and wage for these appear when DOL publishes the
              decided case.
            </p>
          </div>
        ) : null}
        {searching && nameField === "attorney" ? (
          <p className="mt-3 text-sm text-foreground/70">
            Newer, unpublished cases can&apos;t be listed by firm: DOL only
            names the firm when it publishes a decided case.
          </p>
        ) : null}
        {searching ? (
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            {nameHits === undefined ? (
              "Searching the case table…"
            ) : (
              <>
                Showing {fmtInt(nameHits.length)} decided matches, newest first
                and capped. A name search matches from the start of a name, so
                “fragomen” finds Fragomen, Del Rey, Bernsen &amp; Loewy and “del
                rey” finds nothing. The filters don’t apply to it.{" "}
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
              </>
            )}
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

        {awaitingValue && !searching ? (
          <div className="mt-6 border-2 border-border bg-card p-6 shadow-hard-sm">
            <p className="text-base text-foreground/70">
              Pick {dimensionLabel} to see its cases.
            </p>
          </div>
        ) : null}

        {/* Only on the FIRST read, when there are no rows to dim in place.
            A page change keeps the previous rows mounted at reduced opacity
            (tableBusy) instead of flashing this message. */}
        {page === undefined &&
        !searching &&
        !pageFailed &&
        !awaitingValue &&
        prevRows.length === 0 ? (
          <p className="mt-6 text-base text-foreground/60">Reading the case table…</p>
        ) : null}

        {(searching ? nameFailed : pageFailed) ? (
          <div className="mt-6 border-2 border-border bg-card p-6 shadow-hard-sm">
            <p className="text-base text-foreground/70">
              The case table couldn’t be reached just now. Nothing is missing
              from the record; this is a fault at our end.
            </p>{" "}
            <button
              type="button"
              className={`${BUTTON} mt-3`}
              onClick={() =>
                searching
                  ? setNameSubmit((s) => s + 1)
                  : setListSubmit((s) => s + 1)
              }
            >
              Try again
            </button>
          </div>
        ) : null}

        {shown.length === 0 &&
        !awaitingValue &&
        (searching ? nameHits !== undefined : page !== undefined) ? (
          <div className="mt-6 border-2 border-border bg-card p-6 shadow-hard-sm">
            <p className="text-base text-foreground/70">
              Nothing matches that combination in this disclosure window.
            </p>
          </div>
        ) : null}

        {displayRows.length > 0 ? (
          <div
            className={`mt-4 overflow-x-auto border-2 border-border shadow-hard-sm transition-opacity ${
              tableBusy ? "opacity-60" : ""
            }`}
            aria-busy={tableBusy}
          >
            <CaseTable
              rows={displayRows}
              columns={columns}
              sortable={!searching && sortable}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={sortBy}
              caption="PERM cases with outcome, employer, job, wage and decision dates"
            />
          </div>
        ) : null}

        {!searching && (rows.length > 0 || prevRows.length > 0) ? (
          /* `disabled={page?.isDone !== false}` used to sit on Next, which is
             true while the page is STILL LOADING as well as when there is no
             next page - so a slow fetch and the end of the list were the same
             greyed button. Pager separates the two and writes the reason down
             where it can be read. */
          <Pager
            id="perm-case-pager"
            page={pageIndex + 1}
            hasPrevious={!isFirstPage}
            hasNext={page?.isDone === false}
            loading={page === undefined && !pageFailed && !awaitingValue}
            noun="case"
            labelClassName={LABEL}
            buttonClassName={BUTTON}
            onPrevious={() => setCursors((c) => (c.length > 1 ? c.slice(0, -1) : c))}
            onNext={() =>
              setCursors((c) => (page && !page.isDone ? [...c, page.continueCursor] : c))
            }
          />
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
            <td className="whitespace-nowrap px-3 py-3 font-mono text-base">{r.caseNumber}{" "}</td>
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
            <td className="hidden px-3 py-3 sm:table-cell">{r.jobTitle || "—"}{" "}</td>
            <td className="whitespace-nowrap px-3 py-3">{r.state || "—"}{" "}</td>
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
            {" "}</td>
            <td className="hidden whitespace-nowrap px-3 py-3 text-right font-mono text-base tabular-nums sm:table-cell">
              {r.receivedDate}
            {" "}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-base tabular-nums">
              {r.decisionDate}
            {" "}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
              {fmtInt(r.days)}
            {" "}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
