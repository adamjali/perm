import { Fragment } from "react";
import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import type { SevpList } from "@/lib/db/sevpEmployers";
import { formatInt } from "@/lib/format";

/**
 * One of ICE's top-200 lists as a ranked table with a bar per employer, drawn
 * to the list's leader. Names are ICE's own ("Amazon", "University of
 * California"), not legal entities, so each links a search rather than a
 * claimed match to one employer's record.
 */

const fmt = (n: number | null) => (n === null ? "" : formatInt(n));

function RowsTable({ list, rows, top }: { list: SevpList; rows: SevpList["rows"]; top: number }) {
  const opt = list.list === "opt";
  return (
    // A card ground of its own, so the sage bar tracks read on any panel.
    <div className="overflow-x-auto border-t-2 border-[var(--object-border)] bg-card">
      <table className="w-full min-w-[560px] text-left text-base">
        <thead className="border-b-2 border-border bg-sage">
          <tr>
            <th scope="col" className="w-12 px-3 py-2 font-bold">#{" "}</th>
            <th scope="col" className="px-3 py-2 font-bold">Employer, as ICE names it{" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">{opt ? "OPT or STEM OPT" : "CPT"}{" "}</th>
            {opt ? <th scope="col" className="px-3 py-2 text-right font-bold">OPT{" "}</th> : null}
            {opt ? <th scope="col" className="px-3 py-2 text-right font-bold">STEM OPT{" "}</th> : null}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.rank} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-sm">{r.rank}{" "}</td>
              <th scope="row" className="px-3 py-2 font-normal">
                <Link
                  href={`/perm-employers?q=${encodeURIComponent(r.employer)}`}
                  className="link"
                >
                  {r.employer}
                </Link>{" "}
                {/* The counts sit to the right, off a phone's screen; the
                    total is printed by the bar there too. */}
                <span className="mt-1 flex max-w-xs items-center gap-2" aria-hidden="true">
                <span
                  className="block h-2 min-w-0 flex-1 bg-sage"
                  data-tip={[
                    r.employer,
                    `#${r.rank} of ${list.rows.length}`,
                    `${fmt(r.total)} ${opt ? "OPT or STEM OPT" : "CPT"}`,
                    opt && r.opt !== null ? `${fmt(r.opt)} OPT` : null,
                    opt && r.stemOpt !== null ? `${fmt(r.stemOpt)} STEM OPT` : null,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                >
                  <span className="block h-full bg-primary" style={{ width: `${Math.max(1, (r.total / top) * 100)}%` }} />
                </span>{" "}
                <span className="shrink-0 text-sm font-bold tabular-nums sm:hidden">{fmt(r.total)}</span>
                </span>{" "}
              </th>
              <td className="px-3 py-2 text-right font-bold">{fmt(r.total)}{" "}</td>
              {opt ? <td className="px-3 py-2 text-right">{fmt(r.opt)}{" "}</td> : null}
              {opt ? <td className="px-3 py-2 text-right">{fmt(r.stemOpt)}{" "}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `open` rows show; the rest of the list sits in a fold below, in the HTML
 * either way, on the same bar scale as the rows above it.
 */
export function SevpEmployerTable({ list, open }: { list: SevpList; open?: number }) {
  const top = list.rows[0]?.total ?? 1;
  const shown = open ? list.rows.slice(0, open) : list.rows;
  const rest = open ? list.rows.slice(open) : [];
  const opt = list.list === "opt";
  return (
    // The tooltip sits outside the scrolling table, which would clip it.
    <ChartTips label={`ICE's top employers for ${opt ? "OPT and STEM OPT" : "CPT"}, ${list.year}`}>
      <RowsTable list={list} rows={shown} top={top} />{" "}
      {rest.length > 0 ? (
        <details className="group mt-3 bg-sage">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
            Ranks {rest[0]!.rank} to {rest[rest.length - 1]!.rank}{" "}
            <PlusIcon aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
          </summary>{" "}
          <div className="p-3 pt-0">
            <RowsTable list={list} rows={rest} top={top} />
          </div>
        </details>
      ) : null}
    </ChartTips>
  );
}

/** ICE's own ordering slips, said where the table is. */
export function AsPrinted({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      As ICE printed it:{" "}
      {notes.map((n, i) => (
        <Fragment key={n}>
          {i > 0 ? "; " : ""}
          {n}
        </Fragment>
      ))}
      .
    </p>
  );
}
