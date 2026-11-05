"use client";

import { useState } from "react";

import { RequestFailed } from "@/components/tools/RequestFailed";
import { SortableHeader } from "@/components/tools/SortableHeader";
import { ScrollBox } from "@/components/ui/scroll-box";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { formatInt } from "@/lib/format";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";
import { fyLabel, type KnownGap, type RefusalRow, type RefusalTotals } from "@/lib/visaRefusals";

/**
 * Every ground of one fiscal year from State's refusal table, sortable, with State's own total
 * line under it. The newest year comes with the page; picking another asks /api/visa-refusals.
 * State's "-" (the ground can't apply to that kind of visa) reads "N/A" and sorts last.
 */

interface YearAnswer {
  fy: number;
  grounds: RefusalRow[];
  totals: RefusalTotals | null;
  knownGaps: KnownGap[];
}

const COLUMNS: SortColumn<RefusalRow>[] = [
  { key: "line", label: "Ground", get: (r) => r.line },
  { key: "ivFound", label: "Immigrant, found", get: (r) => r.ivFound, descFirst: true },
  { key: "ivOvercome", label: "Immigrant, overcome", get: (r) => r.ivOvercome, descFirst: true },
  { key: "nivFound", label: "Nonimmigrant, found", get: (r) => r.nivFound, descFirst: true },
  { key: "nivOvercome", label: "Nonimmigrant, overcome", get: (r) => r.nivOvercome, descFirst: true },
];

const SELECT =
  "min-h-[44px] min-w-0 border-2 border-input bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";

function Cell({ value }: { value: number | null }) {
  return (
    <td className="px-3 py-3 text-right font-mono tabular-nums">
      {value === null ? (
        <span className="text-muted-foreground" title="Not applicable: the ground can't apply to this kind of visa">
          N/A
        </span>
      ) : (
        formatInt(value)
      )}{" "}
    </td>
  );
}

export function RefusalYearTable({ years, initial }: { years: readonly number[]; initial: YearAnswer }) {
  const [fy, setFy] = useState(initial.fy);
  const [sort, setSort] = useState<SortState>({ key: "line", dir: 1 });
  const asked = usePublicQuery<YearAnswer & { ok: boolean }>(fy === initial.fy ? "skip" : `/api/visa-refusals?fy=${fy}`);
  const answer: YearAnswer | undefined = fy === initial.fy ? initial : asked.data;
  const shown = answer ?? (asked.failed ? undefined : asked.previous);
  const loading = fy !== initial.fy && !asked.data && !asked.failed;
  const rows = shown ? sortRows(shown.grounds, COLUMNS, sort) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="refusal-year" className="text-base font-bold">
          Fiscal year
        </label>{" "}
        <select id="refusal-year" value={fy} onChange={(e) => setFy(Number(e.target.value))} className={SELECT}>
          {[...years].sort((a, b) => b - a).map((y) => (
            <option key={y} value={y}>
              {fyLabel(y)}
            </option>
          ))}
        </select>{" "}
        <p role="status" className="text-sm text-muted-foreground">
          {loading ? `Loading ${fyLabel(fy)}...` : shown ? `${fyLabel(shown.fy)}: ${formatInt(shown.grounds.length)} grounds, in State's order unless sorted` : ""}
        </p>
      </div>
      {asked.failed ? <RequestFailed what={`${fyLabel(fy)}'s table`} failure={asked.failure} onRetry={asked.retry} className="mt-4 bg-tint p-4" /> : null}
      {shown ? (
        <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <ScrollBox label={`Visa refusals by ground, ${fyLabel(shown.fy)}`} className="mt-4">
          <table className="w-full min-w-[46rem] text-left text-base">
            <caption className="sr-only">
              Visa refusals by ground of ineligibility, {fyLabel(shown.fy)}, worldwide, from the State Department{" "}
            </caption>
            <SortableHeader columns={COLUMNS} sort={sort} onSort={(key) => setSort(nextSort(sort, key, COLUMNS))} />
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className="border-b border-border">
                  <th scope="row" className="px-3 py-3 align-top font-normal">
                    <span className="block font-mono text-sm font-bold">{r.code}</span>{" "}
                    <span className="block">{r.ground}</span>
                  </th>
                  <Cell value={r.ivFound} />
                  <Cell value={r.ivOvercome} />
                  <Cell value={r.nivFound} />
                  <Cell value={r.nivOvercome} />
                </tr>
              ))}
            </tbody>
            {shown.totals ? (
              <tfoot className="border-t-2 border-[var(--object-border)] font-bold">
                <tr>
                  <th scope="row" className="px-3 py-3">
                    State&apos;s total line{" "}
                  </th>
                  <Cell value={shown.totals.iv_found} />
                  <Cell value={shown.totals.iv_overcome} />
                  <Cell value={shown.totals.niv_found} />
                  <Cell value={shown.totals.niv_overcome} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </ScrollBox>
        </div>
      ) : null}
      {shown?.knownGaps.length ? (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          {shown.knownGaps.map((g) => g.why).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
