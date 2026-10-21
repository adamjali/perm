"use client";

import Link from "next/link";

import { formatInt } from "@/lib/format";

/**
 * The rows of one of ICE's top-200 lists. A client component on purpose: a
 * server component's whole rendered tree goes into the page's data a second
 * time, while a client component's props go in once, as plain data. Rendered
 * on the server, /opt-employers was 3.3 MB, 2 MB of it that data (Oct 21
 * 2026), and Googlebot reads only a page's first 2 MB (Google's Googlebot
 * page, updated Feb 3 2026).
 */

export interface SevpTableRow {
  rank: number;
  employer: string;
  total: number;
  opt: number | null;
  stemOpt: number | null;
}

const fmt = (n: number | null) => (n === null ? "" : formatInt(n));

export function SevpRowsTable({
  opt,
  count,
  rows,
  top,
}: {
  /** The OPT and STEM OPT list (three counts) rather than CPT (one). */
  opt: boolean;
  /** Employers on the whole list, for "#3 of 200". */
  count: number;
  rows: SevpTableRow[];
  /** The list leader's count, which every bar is drawn against. */
  top: number;
}) {
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
                <Link href={`/perm-employers?q=${encodeURIComponent(r.employer)}`} className="link">
                  {r.employer}
                </Link>{" "}
                {/* The counts sit to the right, off a phone's screen; the
                    total is printed by the bar there too. */}
                <span className="mt-1 flex max-w-xs items-center gap-2" aria-hidden="true">
                  <span
                    className="block h-2 min-w-0 flex-1 bg-sage"
                    data-tip={[
                      r.employer,
                      `#${r.rank} of ${count}`,
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
