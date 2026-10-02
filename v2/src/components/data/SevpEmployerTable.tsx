import { Fragment } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import type { SevpList } from "@/lib/turso/sevpEmployers";
import { formatInt } from "@/lib/format";

/**
 * One of ICE's top-200 lists as a ranked table with a bar per employer, drawn
 * to the list's leader. Names are ICE's own ("Amazon", "University of
 * California"), not legal entities, so each links a search rather than a
 * claimed match to one employer's record.
 */

const fmt = (n: number | null) => (n === null ? "" : formatInt(n));

export function SevpEmployerTable({ list, limit }: { list: SevpList; limit?: number }) {
  const shown = limit ? list.rows.slice(0, limit) : list.rows;
  const top = list.rows[0]?.total ?? 1;
  const opt = list.list === "opt";
  return (
    // The tooltip sits outside the scrolling table, which would clip it.
    <ChartTips label={`ICE's top employers for ${opt ? "OPT and STEM OPT" : "CPT"}, ${list.year}`}>
    <div className="overflow-x-auto border-2 border-border">
      <table className="w-full min-w-[560px] text-left text-base">
        <thead className="border-b-2 border-border bg-muted/40">
          <tr>
            <th scope="col" className="w-12 px-3 py-2 font-bold">#{" "}</th>
            <th scope="col" className="px-3 py-2 font-bold">Employer, as ICE names it{" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">{opt ? "OPT or STEM OPT" : "CPT"}{" "}</th>
            {opt ? <th scope="col" className="px-3 py-2 text-right font-bold">OPT{" "}</th> : null}
            {opt ? <th scope="col" className="px-3 py-2 text-right font-bold">STEM OPT{" "}</th> : null}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {shown.map((r) => (
            <tr key={r.rank} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-sm">{r.rank}{" "}</td>
              <th scope="row" className="px-3 py-2 font-normal">
                <Link
                  href={`/perm-employers?q=${encodeURIComponent(r.employer)}`}
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {r.employer}
                </Link>{" "}
                <span
                  className="mt-1 block h-2 w-full max-w-xs bg-muted"
                  aria-hidden="true"
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
                  <span className="block h-full bg-foreground" style={{ width: `${Math.max(1, (r.total / top) * 100)}%` }} />
                </span>
              </th>
              <td className="px-3 py-2 text-right font-bold">{fmt(r.total)}{" "}</td>
              {opt ? <td className="px-3 py-2 text-right">{fmt(r.opt)}{" "}</td> : null}
              {opt ? <td className="px-3 py-2 text-right">{fmt(r.stemOpt)}{" "}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </ChartTips>
  );
}

/** ICE's own ordering slips, said where the table is. */
export function AsPrinted({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <p className="mt-2 text-sm text-foreground/70">
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
