import { Fragment } from "react";

import { STAGE_META, prettyStatus, type StageGroup } from "./stages";

/**
 * Every DOL status a pending case is sitting in, grouped by queue.
 *
 * The legend gives three numbers. This gives the twelve underneath them,
 * because "906 cases have an information request outstanding" is a fact
 * nobody else publishes and it is lost the moment it is folded into a group.
 *
 * A table, not a list of cards: this is two columns of the same kind of thing
 * repeated twelve times, which is what a table is for. Rows carry a single
 * bottom rule rather than a rule top and bottom, and the group headings are
 * real `<th scope="row">` cells so the structure survives being read aloud.
 *
 * EVERY CELL ENDS WITH A SPACE, AND THE SPACE IS INSIDE THE CELL. A table is
 * the worst case for JSX whitespace stripping: `<td>NORD Issued{" "}</td><td>110
 * {" "}</td>` reaches an extractor as `NORD Issued110`, which the rendered page
 * confirmed before these were added, and cell padding hides it completely in
 * a browser.
 *
 * The obvious repair, a `{" "}` BETWEEN the cells, is invalid HTML and React
 * says so: a whitespace text node cannot be a child of `<tr>`, `<tbody>` or
 * `<table>`, and the parser foster-parents it out. This repo has already
 * shipped that exact mistake across seven files and 44 places, which is why
 * `no-whitespace-in-table-rows.test.ts` exists. The separator belongs before
 * the closing tag, where it is legal and an extractor still reads a boundary.
 */

const int = (n: number) => n.toLocaleString("en-US");

export function PendingCensus({
  stages,
  caption,
}: {
  stages: readonly StageGroup[];
  caption: string;
}) {
  const populated = stages.filter((s) => s.statuses.length > 0);
  if (populated.length === 0) return null;

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption} </caption>
      <thead>
        <tr>
          <th
            scope="col"
            className="border-b-2 border-border pb-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground/80"
          >
            DOL status{" "}
          </th>
          <th
            scope="col"
            className="border-b-2 border-border pb-2 text-right font-mono text-xs font-bold uppercase tracking-wider text-foreground/80"
          >
            Cases{" "}
          </th>
        </tr>
      </thead>
      <tbody>
        {populated.map((group) => {
          const meta = STAGE_META[group.stage];
          return (
            <Fragment key={group.stage}>
              <tr>
                <th
                  scope="row"
                  colSpan={2}
                  className="pt-5 text-left align-bottom"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-3 w-3 shrink-0 border-2 border-border ${meta.fill}`}
                      aria-hidden="true"
                    />{" "}
                    <span className="font-heading text-base font-black">
                      {meta.label}
                    </span>{" "}
                    <span className="font-mono text-sm tabular-nums text-foreground/70">
                      {int(group.count)}
                    </span>
                  </span>{" "}
                </th>
              </tr>
              {group.statuses.map((s) => (
                <tr key={s.status} className="border-b-2 border-border">
                  <td className="py-2 pr-4 text-base text-foreground/80">
                    {prettyStatus(s.status)}{" "}
                  </td>
                  <td className="py-2 text-right text-base font-bold tabular-nums">
                    {int(s.count)}{" "}
                  </td>
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The decided side, as a plain two-column list.
 *
 * Kept structurally simpler than the pending table on purpose. A decided case
 * has left the queue, so the grouping that makes the pending side readable
 * carries nothing here.
 */
export function DecidedList({
  statuses,
}: {
  statuses: readonly { status: string; count: number }[];
}) {
  if (statuses.length === 0) return null;
  return (
    <ul className="space-y-2">
      {statuses.map((s) => (
        <Fragment key={s.status}>
          {" "}
          <li className="flex items-baseline justify-between gap-4 border-b-2 border-border pb-2 text-base">
            <span className="text-foreground/80">{prettyStatus(s.status)}</span>{" "}
            <span className="font-bold tabular-nums">{int(s.count)}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}
