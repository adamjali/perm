"use client";

/**
 * One section, two readings of the same numbers, both always in the document.
 *
 * THE CRAWLER RULE. The table is not fetched on demand and it is not rendered
 * only when it is asked for. Both views are in the served HTML from the first
 * byte, and the toggle decides which one is displayed. A search engine, an
 * assistant reading the page, and a reader with the chart open all get the
 * same numbers, because there is only one copy of them.
 *
 * `hidden` rather than a `display` utility on purpose: a Tailwind class that
 * sets `display:grid` on the same element wins over the attribute's UA
 * `display:none`, which is how a "hidden" panel ends up visible. These
 * wrappers carry no display class at all.
 */

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ViewToggle } from "./ViewToggle";

export type DataViewMode = "chart" | "table";

export interface DataViewProps {
  /** Names the data, for the toggle's accessible name. */
  label: string;
  chart: ReactNode;
  table: ReactNode;
  /** Scoping controls for this section, rendered beside the toggle. */
  controls?: ReactNode;
  initial?: DataViewMode;
  chartLabel?: string;
  tableLabel?: string;
  className?: string;
}

export function DataView({
  label,
  chart,
  table,
  controls,
  initial = "chart",
  chartLabel = "Chart",
  tableLabel = "Table",
  className,
}: DataViewProps) {
  const [mode, setMode] = useState<DataViewMode>(initial);

  return (
    <div className={cn(className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">{controls}</div>{" "}
        <ViewToggle<DataViewMode>
          label={`${label}: chart or table`}
          value={mode}
          options={[
            { value: "chart", label: chartLabel },
            { value: "table", label: tableLabel },
          ]}
          onChange={setMode}
        />
      </div>
      <div hidden={mode !== "chart"}>{chart}</div>{" "}
      <div hidden={mode !== "table"}>{table}</div>
    </div>
  );
}

/**
 * A labelled `<select>` in the house frame, for the scoping controls that sit
 * in a `DataView`'s control bar.
 *
 * 16px text and a 44px box because these are the controls that decide what the
 * page says, not decoration around it.
 */
export function ScopeSelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  /** Appended to the accessible name, for a control whose effect is not obvious. */
  hint?: string;
}) {
  return (
    // `max-w-full` because a flex item's automatic minimum size is its
    // content, so a long option label ("District of Columbia") pushes the
    // control past a 390px viewport and takes the page sideways with it.
    <label className="flex min-h-[44px] max-w-full items-center gap-2 border-2 border-border bg-card px-3 shadow-hard-sm focus-within:ring-2 focus-within:ring-primary">
      <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>{" "}
      <select
        value={value}
        aria-label={hint ? `${label}. ${hint}` : label}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 max-w-[16rem] bg-transparent py-2 text-base outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
