import { Fragment } from "react";
import { PlusIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { SevpRowsTable, type SevpTableRow } from "@/components/data/SevpRowsTable";
import type { SevpList } from "@/lib/db/sevpEmployers";

/**
 * One of ICE's top-200 lists as a ranked table with a bar per employer, drawn
 * to the list's leader. Names are ICE's own ("Amazon", "University of
 * California"), not legal entities, so each links a search rather than a
 * claimed match to one employer's record.
 */

/** Only what a row draws: the page's data carries these once per row. */
const slim = (rows: SevpList["rows"]): SevpTableRow[] =>
  rows.map(({ rank, employer, total, opt, stemOpt }) => ({ rank, employer, total, opt, stemOpt }));

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
      <SevpRowsTable opt={opt} count={list.rows.length} rows={slim(shown)} top={top} />{" "}
      {rest.length > 0 ? (
        <details className="group mt-3 bg-sage">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
            Ranks {rest[0]!.rank} to {rest[rest.length - 1]!.rank}{" "}
            <PlusIcon aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
          </summary>{" "}
          <div className="p-3 pt-0">
            <SevpRowsTable opt={opt} count={list.rows.length} rows={slim(rest)} top={top} />
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
