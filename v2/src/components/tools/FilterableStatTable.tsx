"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The searchable, filterable, paged table every entity index stands on.
 *
 * One component because there are four callers (employers, law firms,
 * occupations, states). Each declares its own columns, which fields the
 * search box reads, and which facets it offers.
 *
 * THE SEED PROBLEM. An index page server-renders a few hundred rows so that
 * a crawler and a first paint get real content, but the corpus behind it is
 * 12,240 employers. A search or a sort over the seed alone would answer a
 * question about the whole corpus using a slice of it, and would look
 * exactly like a correct answer. So the first interaction of any kind
 * triggers the full fetch, and until it lands the count line says plainly
 * that it is still reading a slice.
 */

export interface StatColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  /** Nulls sort last in both directions; return null, do not substitute -1. */
  sortValue: (row: T) => number | string | null;
  render: (row: T, index: number) => ReactNode;
  /** Hidden below `sm`, for columns that would force a wide scroll on a phone. */
  secondary?: boolean;
}

export interface Facet<T> {
  key: string;
  label: string;
  /** The row's value for this facet, or null when it does not apply. */
  value: (row: T) => string | null;
  /** Optional display name for a raw value, e.g. a state code to a name. */
  format?: (value: string) => string;
}

export interface CsvSpec<T> {
  filename: string;
  header: string[];
  row: (row: T) => (string | number | null)[];
}

export interface FilterableStatTableProps<T> {
  /** The server-rendered seed. */
  rows: T[];
  columns: StatColumn<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  initialSort: string;
  caption: string;
  /** Plural noun for the count line, e.g. "employers". */
  noun: string;
  /** Size of the whole corpus. Omit when the seed IS the whole corpus. */
  totalCount?: number;
  /** Fetches the whole corpus. Called at most once. */
  loadAll?: () => Promise<T[]>;
  facets?: Facet<T>[];
  csv?: CsvSpec<T>;
  pageSize?: number;
}

const PAGE_SIZES = [25, 50, 100, 250] as const;

/**
 * Order two cells, nulls ALWAYS last.
 *
 * The null handling has to live here, above the direction flip, rather than
 * inside a comparator whose result gets negated: negating "null goes after"
 * turns it into "null goes first" on a descending sort, which is how "no
 * data" ends up at the top of a column sorted by median days, reading as the
 * fastest employer on the page. A missing median is not a low median.
 */
function compare(
  a: number | string | null,
  b: number | string | null,
  desc: boolean,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
  return desc ? -cmp : cmp;
}

function toCsv<T>(spec: CsvSpec<T>, rows: T[]): string {
  const cell = (v: string | number | null): string => {
    if (v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [spec.header.map(cell).join(",")];
  for (const r of rows) lines.push(spec.row(r).map(cell).join(","));
  return lines.join("\n");
}

export function FilterableStatTable<T>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  initialSort,
  caption,
  noun,
  totalCount,
  loadAll,
  facets = [],
  csv,
  pageSize: initialPageSize = 50,
}: FilterableStatTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(initialSort);
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});

  const [allRows, setAllRows] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requested = useRef(false);

  const corpusSize = totalCount ?? rows.length;
  const partial = allRows === null && corpusSize > rows.length;

  /** Fetch the whole corpus, once, on the first interaction of any kind. */
  const ensureAll = useCallback(() => {
    if (requested.current || !loadAll || allRows !== null) return;
    requested.current = true;
    setLoading(true);
    setLoadError(false);
    loadAll()
      .then((r) => setAllRows(r))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loadAll, allRows]);

  const working = allRows ?? rows;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q
      ? working.filter((r) => searchText(r).toLowerCase().includes(q))
      : [...working];

    for (const f of facets) {
      const want = facetValues[f.key];
      if (want) out = out.filter((r) => f.value(r) === want);
    }

    const col = columns.find((c) => c.key === sortKey) ?? columns[0];
    if (col) {
      out.sort((a, b) => compare(col.sortValue(a), col.sortValue(b), sortDesc));
    }
    return out;
  }, [working, columns, query, sortKey, sortDesc, searchText, facets, facetValues]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  // A filter that shortens the list can strand the viewer on a page past the
  // end, which renders as an empty table over a non-empty result.
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageRows = useMemo(
    () => visible.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [visible, safePage, pageSize],
  );

  const facetOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of facets) {
      const seen = new Set<string>();
      for (const r of working) {
        const v = f.value(r);
        if (v) seen.add(v);
      }
      out[f.key] = [...seen].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [facets, working]);

  const toggleSort = (key: string, numeric: boolean | undefined) => {
    ensureAll();
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(Boolean(numeric));
    }
    setPage(0);
  };

  const downloadCsv = () => {
    if (!csv) return;
    const blob = new Blob([toCsv(csv, visible)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csv.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFacets = facets.filter((f) => facetValues[f.key]);
  const filtersOn = query.trim() !== "" || activeFacets.length > 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] flex-1 items-center gap-2 border-2 border-border bg-card px-3 shadow-hard-sm focus-within:ring-2 focus-within:ring-primary sm:max-w-sm">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
              Search
            </span>{" "}
            <input
              type="search"
              value={query}
              onFocus={ensureAll}
              onChange={(e) => {
                ensureAll();
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 bg-transparent py-2 text-base outline-none placeholder:text-foreground/40"
            />
          </label>

          {facets.map((f) => (
            <label key={f.key} className="flex min-h-[44px] items-center gap-2 border-2 border-border bg-card px-3 shadow-hard-sm focus-within:ring-2 focus-within:ring-primary">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
                {f.label}
              </span>{" "}
              <select
                value={facetValues[f.key] ?? ""}
                onFocus={ensureAll}
                onChange={(e) => {
                  ensureAll();
                  setFacetValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setPage(0);
                }}
                className="min-w-0 bg-transparent py-2 text-base outline-none"
              >
                <option value="">All</option>
                {(facetOptions[f.key] ?? []).map((o) => (
                  <option key={o} value={o}>
                    {f.format ? f.format(o) : o}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {csv ? (
            <button
              type="button"
              onClick={downloadCsv}
              className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary"
            >
              Download CSV
            </button>
          ) : null}
        </div>

        {/* Status. Never let a filtered count read as the whole corpus, and
            never let a partial dataset read as a complete answer. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm text-foreground/70">
            {loading ? (
              <>Loading all {corpusSize.toLocaleString("en-US")} {noun}…</>
            ) : loadError ? (
              <span className="font-bold text-data-bad-ink">
                That list did not load. Showing the top{" "}
                {rows.length.toLocaleString("en-US")} only.
              </span>
            ) : partial ? (
              <>
                Showing the top {rows.length.toLocaleString("en-US")} of{" "}
                {corpusSize.toLocaleString("en-US")} {noun}. Search or sort to
                read all of them.
              </>
            ) : filtersOn ? (
              <>
                <strong className="font-bold">
                  {visible.length.toLocaleString("en-US")}
                </strong>{" "}
                of {working.length.toLocaleString("en-US")} {noun} match
              </>
            ) : (
              <>
                All{" "}
                <strong className="font-bold">
                  {working.length.toLocaleString("en-US")}
                </strong>{" "}
                {noun}
              </>
            )}
          </p>

          <div className="flex items-center gap-3">
            {partial && !loading && loadAll ? (
              <button
                type="button"
                onClick={ensureAll}
                className="min-h-[44px] border-2 border-border bg-primary px-4 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-primary"
              >
                Load all {corpusSize.toLocaleString("en-US")}
              </button>
            ) : null}
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-foreground/60">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Rows
              </span>{" "}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="border-2 border-border bg-card px-2 py-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* The table scrolls inside its own box; the page never scrolls sideways. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-foreground text-background">
            <tr>
              {columns.map((c) => {
                const isSorted = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={isSorted ? (sortDesc ? "descending" : "ascending") : "none"}
                    className={
                      "p-0 " +
                      (c.numeric ? "text-right " : "") +
                      (c.secondary ? "hidden sm:table-cell" : "")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key, c.numeric)}
                      className={
                        "min-h-[44px] w-full px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary " +
                        (c.numeric ? "text-right" : "text-left") +
                        (isSorted ? " text-primary" : "")
                      }
                    >
                      {c.label}
                      {isSorted ? (sortDesc ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-card">
            {pageRows.map((row, i) => (
              <tr key={safePage * pageSize + i} className="border-t border-border/40">
                {/* Cells rendered from a map arrive with nothing between them,
                    so a row reads as one run of characters to anything walking
                    the DOM. A space between cells costs nothing in a table. */}
                {columns.map((c) => (
                  <Fragment key={c.key}>
                    {" "}
                    <td
                      className={
                        "px-3 py-2.5 " +
                        (c.numeric ? "text-right tabular-nums " : "") +
                        (c.secondary ? "hidden sm:table-cell" : "")
                      }
                    >
                      {c.render(row, safePage * pageSize + i)}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-foreground/60">
                  Nothing matches that. Clear the search and the filters to see
                  the full list.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav
          aria-label={`${noun} pages`}
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            Page {safePage + 1} of {pageCount.toLocaleString("en-US")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                ensureAll();
                setPage((p) => Math.max(0, p - 1));
              }}
              disabled={safePage === 0}
              className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-colors hover:bg-tint-primary disabled:opacity-40 disabled:hover:bg-card focus-visible:ring-2 focus-visible:ring-primary"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => {
                ensureAll();
                setPage((p) => Math.min(pageCount - 1, p + 1));
              }}
              disabled={safePage >= pageCount - 1}
              className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-colors hover:bg-tint-primary disabled:opacity-40 disabled:hover:bg-card focus-visible:ring-2 focus-visible:ring-primary"
            >
              Next →
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
