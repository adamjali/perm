import { RUNGS, RUNG_LABEL, isComplete, type Ladder } from "@/lib/wageLadder";
import { formatDollars } from "@/lib/format";
import { ScrollBox } from "@/components/ui/scroll-box";

/**
 * The same ladders as exact figures.
 *
 * A distribution drawn is a shape; a distribution tabulated is a number you
 * can check an offer against, and a reader comparing a specific salary needs
 * the second. Both readings ship in the served HTML from the first byte, so a
 * crawler and an assistant reading the page get the figures whichever view
 * the toggle happens to be showing.
 *
 * THE SEPARATOR GOES INSIDE THE CELL, as the cell's LAST CHILD, immediately
 * before the closing tag. Putting it after a closing cell tag instead makes it
 * a whitespace text node whose parent is the row, which is invalid HTML and
 * which React reports as a hydration error; this project already shipped that
 * shape in seven files and 44 places while fixing glued table text. Inside the
 * cell it is legal, and an extractor still sees a column boundary.
 *
 * (Written out rather than shown, because `no-whitespace-in-table-rows` scans
 * raw file text and cannot tell a code sample in a comment from real code. A
 * literal example here would fail the gate that this note exists to honour.)
 */

export function LadderTable({
  ladders,
  subjectLabel,
  unit = "certified cases",
}: {
  ladders: Ladder[];
  /** What the first column names: "Occupation", "State", "Fiscal year". */
  subjectLabel: string;
  unit?: string;
}) {
  const rows = ladders.filter(isComplete);
  if (rows.length === 0) return null;
  return (
    <ScrollBox label={`Offered wage percentiles by ${subjectLabel.toLowerCase()}`} className="-mx-1 px-1">
      <table className="w-full min-w-[640px] border-t-2 border-[var(--object-border)] text-left text-sm">
        <caption className="sr-only">
          {`Offered wage percentiles by ${subjectLabel.toLowerCase()}, with the number of ${unit} behind each row.`}
        </caption>
        <thead>
          <tr className="border-b-2 border-border bg-muted">
            <th scope="col" className="px-3 py-2 text-sm font-bold">
              {subjectLabel}{" "}
            </th>
            <th scope="col" className="px-3 py-2 text-right text-sm font-bold">
              Cases{" "}
            </th>
            {RUNGS.map((r) => (
              <th
                key={r}
                scope="col"
                className="px-3 py-2 text-right text-sm font-bold"
              >
                {RUNG_LABEL[r]}{" "}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.key} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-3 py-2 text-left font-bold">
                {l.label}{" "}
              </th>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {l.count.toLocaleString("en-US")}{" "}
              </td>
              {RUNGS.map((r) => (
                <td key={r} className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatDollars(l[r] as number)}{" "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollBox>
  );
}
