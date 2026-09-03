"use client";

import Link from "next/link";

import { SortableHeader } from "@/components/tools/SortableHeader";
import type { SortColumn, SortState } from "@/lib/tableSort";
import { PROGRAM_LABEL } from "@/lib/changeProgram";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { DecidedCase } from "@/lib/turso/decidedDays";
import { toneOf } from "./ChangeTable";

/**
 * A wage, with the period DOL quoted it per.
 *
 * NEVER ANNUALISED HERE. Multiplying an hourly rate by 2,080 assumes a
 * full-time year that the filing does not state, and the result would be
 * indistinguishable on the page from a salary DOL actually published. The unit
 * is printed instead, and PERM rows say nothing because `perm_cases` carries
 * no unit column at all.
 */
function wageText(c: DecidedCase): string {
  if (c.wage === null) return "";
  const n = c.wage.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: c.wage < 1000 ? 2 : 0,
  });
  return c.wageUnit ? `${n} / ${c.wageUnit.toLowerCase()}` : n;
}

/**
 * Every column this table sorts on.
 *
 * SORTING IS NOT FILTERING, AND THEY FAIL DIFFERENTLY. A filter on a wage
 * cannot evaluate a row whose wage is unknown, so it has to drop it. A SORT
 * just puts the unknowns last, which `sortRows` already does in both
 * directions. So every column here stays sortable even when the corresponding
 * filter is unavailable - the two were previously switched off together, which
 * disabled sorting for a reason that only ever applied to filtering.
 */
export const DECIDED_COLUMNS: SortColumn<DecidedCase>[] = [
  { key: "case", label: "Case", get: (r) => r.caseNumber },
  { key: "program", label: "Program", get: (r) => PROGRAM_LABEL[r.program] },
  { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decidedOn },
  { key: "employer", label: "Employer", get: (r) => r.employerName },
  { key: "title", label: "Job title", get: (r) => r.jobTitle },
  { key: "soc", label: "Occupation", get: (r) => r.socTitle ?? r.socCode },
  { key: "state", label: "State", get: (r) => r.state },
  { key: "wage", label: "Wage", descFirst: true, get: (r) => r.wage },
  { key: "status", label: "Outcome", get: (r) => r.status },
];

/**
 * The cases DOL decided on the chosen dates, from the quarterly files.
 *
 * A SEPARATE TABLE FROM `ChangeTable`, NOT A WIDER ONE. That table shows a
 * TRANSITION, with a from and a to, because a status alone cannot tell an RFI
 * being issued apart from one being answered. This one shows an OUTCOME on a
 * date DOL published, and it carries four columns the live record does not
 * have at all. Rendering both shapes through one table would mean half the
 * columns are always blank and the reader cannot tell which half is missing
 * because DOL withholds it and which because nothing happened.
 *
 * NO WHITESPACE TEXT NODE MAY SIT BETWEEN CELLS. A JSX space expression placed
 * after a closing cell tag is a text node whose parent is the row, which is
 * invalid HTML and a hydration error; the separator lives inside the cell
 * instead. `no-whitespace-in-table-rows.test.ts` is the gate.
 */
export function DecidedTable({
  rows,
  sort,
  onSort,
  caption,
  sortable = true,
}: {
  rows: DecidedCase[];
  sort: SortState;
  onSort: (key: string) => void;
  caption: string;
  sortable?: boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <SortableHeader
          columns={DECIDED_COLUMNS}
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
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                {c.decidedOn}{" "}
              </td>
              <td className="px-3 py-3 font-bold">
                {c.employerSlug ? (
                  <Link
                    href={`/perm-employers/${c.employerSlug}`}
                    className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                  >
                    {c.employerName}
                  </Link>
                ) : (
                  (c.employerName ?? "")
                )}{" "}
              </td>
              <td className="px-3 py-3 text-foreground/80">{c.jobTitle ?? ""}{" "}</td>
              <td className="px-3 py-3 text-sm text-foreground/80">
                {c.socTitle ?? c.socCode ?? ""}{" "}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm">
                {c.state ?? ""}{" "}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-sm tabular-nums">
                {wageText(c)}{" "}
              </td>
              <td
                className={
                  "whitespace-nowrap px-3 py-3 text-sm font-bold " + toneOf(c.status)
                }
              >
                {c.status}{" "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
