"use client";

import Link from "next/link";

import { SortableHeader } from "@/components/tools/SortableHeader";
import { getStatusMeaning } from "@/lib/permStatus";
import type { SortColumn, SortState } from "@/lib/tableSort";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { CaseChange } from "@/lib/turso/changes";
import { PROGRAM_LABEL } from "@/lib/changeProgram";

/**
 * The colour a status is written in, from its kind.
 *
 * The kind lookup is the shared logic and lives in `permStatus`; only this
 * mapping to a text token is local, because the one in `CaseStatusResult`
 * paints backgrounds for a hero band and would be wrong inline.
 *
 * An unknown status gets the plain foreground rather than a guess. The wage
 * and LCA programs use words PERM never does, and inventing a colour for one
 * would assert a meaning the lookup does not hold.
 */
function toneOf(status: string): string {
  switch (getStatusMeaning(status)?.kind) {
    case "decided":
      return "text-data-good-ink";
    case "action":
      return "text-data-warn-ink";
    case "appeal":
      return "text-data-bad-ink";
    default:
      return "text-foreground";
  }
}

/**
 * Every column this table sorts on. Exported because the browser above needs
 * them to build the ordering, and two copies of a column list is two places
 * for a sort key to drift out of a header label.
 */
export const CHANGE_COLUMNS: SortColumn<CaseChange>[] = [
  { key: "case", label: "Case", get: (r) => r.caseNumber },
  { key: "program", label: "Program", get: (r) => PROGRAM_LABEL[r.program] },
  { key: "employer", label: "Employer", get: (r) => r.employerName },
  { key: "title", label: "Job title", get: (r) => r.jobTitle },
  { key: "filed", label: "Filed", descFirst: true, get: (r) => r.filingDate },
  { key: "from", label: "Changed from", get: (r) => r.fromStatus },
  { key: "to", label: "Changed to", get: (r) => r.toStatus },
];

/**
 * Which cases DOL moved, one row each, sortable on every column.
 *
 * THE TRANSITION IS THE POINT, SO BOTH ENDS ARE COLUMNS. A status on its own
 * cannot tell an RFI being issued apart from one being answered: both rows say
 * "RFI ISSUED" somewhere. `ANALYST REVIEW -> RFI ISSUED` and
 * `RFI ISSUED -> ANALYST REVIEW` are opposite events, which is the whole
 * reason this reads from the event table rather than from a status column, and
 * why "changed from" and "changed to" sort independently.
 *
 * NO WHITESPACE TEXT NODE MAY SIT BETWEEN CELLS. A JSX space expression placed
 * after a closing cell tag is a text node whose parent is the row, which is
 * invalid HTML and a hydration error; a separator has to live inside the cell
 * instead. `no-whitespace-in-table-rows.test.ts` is the gate, and it matches on
 * the file's text - so quoting the offending form in a comment trips it, which
 * is how this very docstring first failed it.
 */
export function ChangeTable({
  rows,
  sort,
  onSort,
  caption,
  sortable = true,
}: {
  rows: CaseChange[];
  sort: SortState;
  onSort: (key: string) => void;
  caption: string;
  /** False while the rows are only the prerendered head of the day. */
  sortable?: boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[1040px] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={CHANGE_COLUMNS}
          sort={sort}
          onSort={onSort}
          disabled={!sortable}
        />
        <tbody className="bg-card">
          {rows.map((c) => (
            <tr
              key={`${c.program}:${c.caseNumber}`}
              className="border-t-2 border-border/30 align-top"
            >
              {/* A SEPARATOR INSIDE EVERY CELL. JSX puts nothing between
                  sibling cells, so a row reached extractors as one run:
                  "G-100-25269-338692PERMAbercrombie & Fitch...2025-09-26DENIED".
                  270 pairs on this page in the rendered sweep while the
                  source gate stayed green, because it cannot see .map()
                  output. It goes INSIDE the cell, before the closing tag: a
                  whitespace text node whose parent is <tr> is invalid HTML and
                  React warns it breaks hydration, which
                  no-whitespace-in-table-rows.test.ts pins. */}
              <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                <Link
                  href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {c.caseNumber}
                </Link>{" "}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm text-foreground/80">
                {PROGRAM_LABEL[c.program]}{" "}
              </td>
              <td className="px-3 py-3 font-bold">
                {c.employerName ?? (
                  <span className="font-normal text-foreground/70">
                    Not named in the live record yet
                  </span>
                )}{" "}
              </td>
              <td className="px-3 py-3 text-foreground/80">{c.jobTitle ?? ""}{" "}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                {c.filingDate ?? ""}{" "}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-sm text-foreground/70">
                {c.fromStatus}{" "}
              </td>
              <td
                className={
                  "whitespace-nowrap px-3 py-3 text-sm font-bold " + toneOf(c.toStatus)
                }
              >
                {c.toStatus}{" "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { toneOf };
