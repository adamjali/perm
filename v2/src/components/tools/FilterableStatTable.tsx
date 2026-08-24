"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * The searchable table both the wages and the employers pages stand on.
 *
 * One component because the second caller already exists (extract shared
 * logic the SECOND time). Generic over the row: each page declares its
 * columns and which fields the search box reads. Sorting is per-column with
 * aria-sort; the count line always says how much of the whole is showing, so
 * a filter can never silently read as the full list.
 */

export interface StatColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  sortValue: (row: T) => number | string;
  render: (row: T, index: number) => ReactNode;
}

export interface FilterableStatTableProps<T> {
  rows: T[];
  columns: StatColumn<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  /** Column key to sort by initially (descending for numeric). */
  initialSort: string;
  caption: string;
}

export function FilterableStatTable<T>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  initialSort,
  caption,
}: FilterableStatTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(initialSort);
  const [sortDesc, setSortDesc] = useState(true);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = columns.find((c) => c.key === sortKey) ?? columns[0];
    const filtered = q
      ? rows.filter((r) => searchText(r).toLowerCase().includes(q))
      : [...rows];
    if (col) {
      filtered.sort((a, b) => {
        const av = col.sortValue(a);
        const bv = col.sortValue(b);
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return sortDesc ? -cmp : cmp;
      });
    }
    return filtered;
  }, [rows, columns, query, sortKey, sortDesc, searchText]);

  const toggleSort = (key: string, numeric: boolean | undefined) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(Boolean(numeric));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-[44px] flex-1 items-center gap-2 border-2 border-border bg-card px-3 shadow-hard-sm focus-within:ring-2 focus-within:ring-primary sm:max-w-sm">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
            Search
          </span>{" "}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full min-w-0 bg-transparent py-2 text-base outline-none placeholder:text-foreground/40"
          />
        </label>
        <p aria-live="polite" className="text-sm text-foreground/60">
          Showing {visible.length.toLocaleString("en-US")} of{" "}
          {rows.length.toLocaleString("en-US")}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-2 border-border text-left text-sm shadow-hard-sm">
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
                    className={"p-0 " + (c.numeric ? "text-right" : "")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key, c.numeric)}
                      className={
                        "min-h-[44px] w-full px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:text-primary " +
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
            {visible.map((row, i) => (
              <tr key={i} className="border-t border-border/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={"px-3 py-2.5 " + (c.numeric ? "text-right tabular-nums" : "")}
                  >
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-foreground/60">
                  Nothing matches that search. Clear it to see the full list.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
