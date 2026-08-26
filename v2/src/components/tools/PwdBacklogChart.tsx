"use client";

/**
 * DOL's prevailing-wage backlog, by month of receipt.
 *
 * Answers this page's own question and no other page's: "how much is actually
 * in front of me, and where does the pile start?" The shape of the real data
 * is the point. DOL has all but cleared everything before March 2026 (11, 63,
 * 106 and 627 requests remain) and then it jumps to 14,386. A visitor reading
 * the count alone cannot see that cliff; the chart makes it the first thing
 * they notice.
 *
 * Built from HTML and CSS grid rather than SVG on purpose. A horizontal bar
 * chart needs no viewBox arithmetic, cannot overflow its own container, scales
 * to any width, and stays readable to a screen reader. SVG earns its place for
 * drawings, not for bars.
 *
 * The table is the arithmetic the bars cannot show: each month's share of the
 * pile, and the running total from the oldest month, which is the only figure
 * that answers "how many requests are ahead of mine" exactly.
 */

import { Fragment, useMemo, useState } from "react";
import { formatMonth } from "@/lib/dolFormat";
import type { PwdBacklogMonth } from "@/lib/perm";
import { cn } from "@/lib/utils";
import { DataView, ScopeSelect } from "./DataView";

export interface PwdBacklogChartProps {
  backlog: readonly PwdBacklogMonth[];
  /** The visitor's own receipt month, highlighted. Omit for the whole pile. */
  selectedMonth?: string;
  className?: string;
}

type Scope = "all" | "ahead" | "from";

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function Bars({
  rows,
  max,
  selectedMonth,
}: {
  rows: PwdBacklogMonth[];
  max: number;
  selectedMonth?: string;
}) {
  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const isSelected = row.receiptMonth === selectedMonth;
        const isAhead = selectedMonth !== undefined && row.receiptMonth < selectedMonth;
        // Percentage of the widest bar, so the cliff between March and April
        // stays visible rather than being normalised away.
        const width = (row.remainingRequests / max) * 100;

        return (
          // The separator is why this is a Fragment. Mapped <li> siblings
          // arrive with nothing between them, so the rows read as
          // "December 2025 11January 2026 63" to any extractor.
          <Fragment key={row.receiptMonth}>
            {" "}
            <li className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_5.5rem]">
              <span
                className={cn(
                  "text-sm",
                  isSelected ? "font-black" : "text-foreground/70",
                )}
              >
                {formatMonth(row.receiptMonth)}
              </span>{" "}

              {/* The track is always full width, so a small bar reads as small
                  rather than as a missing row. */}
              <span className="h-6 w-full border-2 border-border bg-muted">
                <span
                  className={cn(
                    "block h-full",
                    isSelected
                      ? "bg-primary"
                      : isAhead
                        ? "bg-foreground/70"
                        : selectedMonth === undefined
                          ? "bg-foreground/70"
                          : "bg-foreground/20",
                  )}
                  // A bar under ~1% is invisible at any width, and four of
                  // these months are genuinely near zero. A floor keeps the row
                  // legible without misrepresenting the value, which the number
                  // beside it states exactly.
                  style={{ width: `${Math.max(width, 1.5)}%` }}
                />
              </span>{" "}

              <span
                className={cn(
                  "text-right text-sm tabular-nums",
                  isSelected ? "font-black" : "text-foreground/70",
                )}
              >
                {fmtInt(row.remainingRequests)}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function BacklogTable({
  rows,
  total,
  cumulative,
  selectedMonth,
}: {
  rows: PwdBacklogMonth[];
  total: number;
  cumulative: Map<string, number>;
  selectedMonth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
        <caption className="sr-only">
          Prevailing wage requests still pending by month of receipt, with each
          month&apos;s share of the pile and the running total from the oldest month
        </caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              Received
            {" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Still pending
            {" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Share
            {" "}</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell">
              This month and older
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {rows.map((row) => (
            <tr
              key={row.receiptMonth}
              className={cn(
                "border-t border-border/40",
                row.receiptMonth === selectedMonth && "bg-tint-primary",
              )}
            >
              <td className="px-3 py-2.5 font-bold">
                {formatMonth(row.receiptMonth)}
              {" "}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {fmtInt(row.remainingRequests)}
              {" "}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-foreground/70">
                {total > 0 ? `${((row.remainingRequests / total) * 100).toFixed(1)}%` : "—"}
              {" "}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/70 sm:table-cell">
                {fmtInt(cumulative.get(row.receiptMonth) ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted">
          <tr className="border-t-2 border-border">
            <td className="px-3 py-2.5 font-black">Whole pile{" "}</td>
            <td className="px-3 py-2.5 text-right font-black tabular-nums">
              {fmtInt(total)}
            {" "}</td>
            <td className="px-3 py-2.5" />
            <td className="hidden px-3 py-2.5 sm:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PwdBacklogChart({
  backlog,
  selectedMonth,
  className,
}: PwdBacklogChartProps) {
  const [scope, setScope] = useState<Scope>("all");

  const all = useMemo(
    () => [...backlog].sort((a, b) => a.receiptMonth.localeCompare(b.receiptMonth)),
    [backlog],
  );

  // Running total from the oldest month, over the WHOLE pile. Scoping the view
  // must not change what "this month and older" means.
  const cumulative = useMemo(() => {
    const out = new Map<string, number>();
    let run = 0;
    for (const r of all) {
      run += r.remainingRequests;
      out.set(r.receiptMonth, run);
    }
    return out;
  }, [all]);

  if (all.length === 0) return null;

  const total = all.reduce((sum, r) => sum + r.remainingRequests, 0);
  const rows =
    selectedMonth === undefined || scope === "all"
      ? all
      : scope === "ahead"
        ? all.filter((r) => r.receiptMonth < selectedMonth)
        : all.filter((r) => r.receiptMonth >= selectedMonth);

  const max = Math.max(...all.map((r) => r.remainingRequests));
  if (max <= 0) return null;

  const scopeControl =
    selectedMonth === undefined ? undefined : (
      <Fragment>
        <ScopeSelect
          label="Show"
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          hint="Narrows both the bars and the table to part of the pile."
          options={[
            { value: "all", label: "Every month" },
            { value: "ahead", label: "Received before yours" },
            { value: "from", label: "Yours and later" },
          ]}
        />{" "}
        <p className="text-sm text-foreground/70">
          {fmtInt(rows.reduce((s, r) => s + r.remainingRequests, 0))} of {fmtInt(total)}{" "}
          pending requests
        </p>
      </Fragment>
    );

  return (
    <figure className={cn("m-0", className)}>
      <DataView
        label="Prevailing wage backlog"
        controls={scopeControl}
        chart={
          rows.length === 0 ? (
            <p className="border-2 border-border bg-card p-6 text-base text-foreground/70 shadow-hard-sm">
              No months in the published backlog fall in that part of the pile.
            </p>
          ) : (
            <Bars rows={rows} max={max} selectedMonth={selectedMonth} />
          )
        }
        table={
          <BacklogTable
            rows={rows}
            total={total}
            cumulative={cumulative}
            selectedMonth={selectedMonth}
          />
        }
      />

      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70">
        {selectedMonth === undefined ? (
          <span>
            Every month DOL still has undecided prevailing wage requests in, oldest
            first. Each bar is a count of requests still pending.
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border-2 border-border bg-foreground/70" aria-hidden="true" />
              Ahead of yours
            </span>{" "}
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border-2 border-border bg-primary" aria-hidden="true" />
              Your month
            </span>{" "}
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border-2 border-border bg-foreground/20" aria-hidden="true" />
              Received after yours
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
