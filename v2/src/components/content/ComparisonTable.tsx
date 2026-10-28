import type { ReactNode } from "react";

import { ScrollBox } from "@/components/ui/scroll-box";

/** An article's table: headers, then rows of cells. A cell may hold a live figure (`<DolNow />`), so cells are nodes. */
export function ComparisonTable({
  headers = [],
  rows = [],
}: {
  headers?: string[];
  // A cell may hold a live figure (<DolNow />), so cells are nodes, not strings.
  rows?: ReactNode[][];
}) {
  if (!headers.length || !rows.length) return null;

  if (process.env.NODE_ENV === "development") {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.length !== headers.length) {
        console.warn(`[ComparisonTable] Row ${i} has ${rows[i]!.length} cells but headers has ${headers.length}`);
      }
    }
  }

  return (
    <ScrollBox label={`Table: ${headers.join(", ")}`} className="my-6 overscroll-x-none">
      <table className="w-full border border-border text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-border px-4 py-2 text-left font-heading font-bold"
              >
                {h}{" "}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="transition-colors hover:bg-muted/50"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-4 py-2">
                  {cell}{" "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollBox>
  );
}
