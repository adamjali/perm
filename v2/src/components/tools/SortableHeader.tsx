"use client";

import { Fragment } from "react";

import type { SortColumn, SortState } from "@/lib/tableSort";

/**
 * The header row of a sortable table, on this site's inverted header bar.
 *
 * NOT `text-primary` FOR THE ACTIVE OR HOVER STATE. The bar is `bg-foreground`,
 * which is near-black in light and near-WHITE in dark, while the brand lime
 * holds still at #2ecc40 - so a lime label measures about 2:1 in dark mode.
 * Underline and the caret are the emphasis that survives the flip. This is the
 * same defect the ink card on /tools already carries a comment about.
 *
 * `aria-sort` goes on the `th`, not the button: a screen reader announces the
 * column's state from the header cell.
 *
 * `disabled` exists for a caller whose rows are still a TRUNCATED sample.
 * Sorting a slice puts a confident-looking order over data the reader cannot
 * see the rest of, so the change feed turns the headers off until the whole
 * day has landed rather than reordering the first page of it.
 */
export function SortableHeader<T>({
  columns,
  sort,
  onSort,
  leading,
  disabled = false,
}: {
  columns: SortColumn<T>[];
  sort: SortState;
  onSort: (key: string) => void;
  /** Columns rendered before the sortable ones, e.g. the case number. */
  leading?: string[];
  /** Turn sorting off while the rows on screen are only part of the set. */
  disabled?: boolean;
}) {
  return (
    <thead className="bg-foreground text-background">
      <tr>
        {(leading ?? []).map((h) => (
          <Fragment key={h}>
            <th
              scope="col"
              className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider"
            >
              {h}{" "}
            </th>
          </Fragment>
        ))}
        {columns.map((c) => {
          const active = sort.key === c.key;
          return (
            <Fragment key={c.key}>
              <th
                scope="col"
                aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                className="whitespace-nowrap p-0 font-mono text-xs font-bold uppercase tracking-wider"
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSort(c.key)}
                  className={
                    "flex min-h-[44px] w-full items-center gap-1 px-3 py-3 text-left uppercase underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary " +
                    (active ? "underline" : "")
                  }
                >
                  {c.label}
                  <span aria-hidden="true" className={active ? "" : "opacity-30"}>
                    {active ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
                  </span>
                </button>
            </th>
            </Fragment>
          );
        })}
      </tr>
    </thead>
  );
}
