import { Fragment } from "react";

import type { StageCohort } from "@/lib/turso/rfi";
import { GROUP_STYLE, stageMeta } from "./stageMeta";

/**
 * Which filing months are holding each review stage right now.
 *
 * WHAT THIS IS NOT. It is not RFIs per month and it is not a trend. The
 * mirror holds one observation per case, so it cannot see a case enter a
 * stage or leave one, and any line drawn through these columns over time
 * would be a fabrication. Every number here is a count of cases sitting at a
 * stage TODAY, grouped by the month they were filed.
 *
 * WHAT IT DOES SHOW, and it is the clearest evidence on the page: the stages
 * do not overlap. Every open RFI belongs to a five-month band of filings, the
 * NORDs belong to a different four-month band a year earlier, and the appeals
 * to a third. Read across a row and each stage occupies its own slice of the
 * backlog.
 *
 * EACH ROW IS SCALED TO ITS OWN LARGEST MONTH, and the caption says so.
 * On one shared scale the 1,142-case hold column sets the maximum and the
 * NORD row, the appeal rows and the reconsideration row all round to a
 * hairline. Rounding the rare stages into invisibility on a page whose
 * subject is the rare stages is the one thing this chart must not do.
 *
 * ONE NUMBER PER ROW, NOT ONE PER BAR. The first version printed a count on
 * every cell: 125 figures at 9px, smaller than anything else on this site and
 * below anything legible, and as a block they read as texture rather than as
 * data. The peak month is the one figure the row is actually making a claim
 * about. Every exact count lives in the table view, which ships in the same
 * HTML rather than being fetched when asked for.
 */

export function StageCohortsChart({
  cohorts,
  statuses,
}: {
  cohorts: StageCohort[];
  statuses: string[];
}) {
  if (cohorts.length === 0) return null;
  const months = cohorts.map((c) => c.month);
  const rows = stageRows(cohorts, statuses);

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${Math.max(34, months.length * 2.2)}rem` }}>
          <Strip
            label="Cases filed"
            sub="all statuses"
            counts={cohorts.map((c) => c.filed)}
            months={months}
            // Not a data-scale colour and not a faded one. The context row is
            // a different KIND of thing from the stage rows, so it gets a
            // colour that appears nowhere in the legend rather than a paler
            // version of one that does.
            fill="var(--muted-foreground)"
            context
          />
          {rows.map((r) => {
            const meta = stageMeta(r.status);
            return (
              <Fragment key={r.status}>{" "}
              <Strip
                label={meta.label}
                sub={`${r.total.toLocaleString()} cases`}
                counts={r.counts}
                months={months}
                fill={GROUP_STYLE[meta.group].fill}
              />
              </Fragment>
            );
          })}
          <div className="grid grid-cols-[9.5rem_1fr] gap-3 pt-1">
            <div />{" "}
            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
              }}
            >
              {months.map((m, i) => (
                <Fragment key={m}>{" "}
                <div className="text-center font-mono text-[11px] leading-tight text-muted-foreground">
                  {/*
                    A year label only where the year changes, plus the first
                    column. Printing all 25 in a 2.2rem cell overlaps them into
                    a smear, and printing every third leaves the reader
                    counting to work out which month a bar belongs to.
                  */}
                  {i === 0 || m.slice(0, 4) !== months[i - 1]?.slice(0, 4) ? (
                    <span className="block font-bold text-foreground/70">
                      {m.slice(2, 4)}
                    </span>
                  ) : null}{" "}
                  <span className="block">{m.slice(5)}</span>
                </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Cases at each stage today, by the month they were filed. Every row is
        scaled to its own busiest month and labelled with it, so the rows show
        where a stage sits and not how big it is next to the others.
      </figcaption>
    </figure>
  );
}

interface Row {
  status: string;
  counts: number[];
  total: number;
}

function stageRows(cohorts: StageCohort[], statuses: string[]): Row[] {
  return statuses
    .map((status) => {
      const counts = cohorts.map((c) => c.stages[status] ?? 0);
      return { status, counts, total: counts.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.total > 0);
}

function Strip({
  label,
  sub,
  counts,
  months,
  fill,
  context = false,
}: {
  label: string;
  sub: string;
  counts: number[];
  months: string[];
  fill: string;
  /** The reference row, not one of the stages. */
  context?: boolean;
}) {
  const max = Math.max(1, ...counts);
  const peakAt = counts.indexOf(max);
  return (
    <div
      className={
        "grid grid-cols-[9.5rem_1fr] items-end gap-3 py-1.5" +
        (context ? " border-b-2 border-border/40 pb-3" : "")
      }
    >
      <div className="min-w-0 pb-1">
        <div className="truncate font-heading text-sm font-bold leading-tight">
          {label}
        </div>{" "}
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {sub}
        </div>
      </div>{" "}
      <div
        className="grid items-end gap-px"
        style={{
          gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
        }}
      >
        {counts.map((n, i) => {
          const isPeak = i === peakAt && n > 0;
          return (
            <Fragment key={months[i]}>{" "}
            <div className="flex flex-col items-center">
              {/*
                The peak figure is rendered for real; every other cell renders
                the same box transparently so all the bars in a row still share
                one baseline. `aria-hidden` on the spacers, or a screen reader
                hears a zero for every month.
              */}
              <span
                className={
                  "whitespace-nowrap font-mono text-[11px] font-bold leading-none tabular-nums " +
                  (isPeak ? "text-foreground" : "select-none text-transparent")
                }
                aria-hidden={isPeak ? undefined : "true"}
              >
                {isPeak ? n.toLocaleString() : "0"}
              </span>{" "}
              {/*
                A FULL-STRENGTH BORDER, NOT A 40% ONE. Measured: --data-warn on
                --card is 2.07:1 in light mode, under the 3:1 floor for a
                non-text shape. Every bar on this page carries a black border
                for that reason, and the border is what makes the amber legible
                rather than the fill. A 3px minimum on any non-zero month for a
                related reason: one case at 1/1142 of the scale computes to a
                fraction of a pixel and vanishes, which reads as "none" rather
                than "one".
              */}
              <div
                className={n > 0 ? "w-full border border-border" : "w-full"}
                style={{
                  height: n > 0 ? `${Math.max(3, (n / max) * 34)}px` : "1px",
                  backgroundColor: n > 0 ? fill : "var(--border)",
                  opacity: n > 0 ? 1 : 0.15,
                }}
                title={`${months[i]}: ${n.toLocaleString()}`}
              />
            </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The same counts as a table, always in the served HTML.
 *
 * Not a fallback. The chart deliberately prints one number per row, so this is
 * where the other 120 live, and a crawler or an assistant reading the page
 * gets them without running anything.
 */
export function StageCohortsTable({
  cohorts,
  statuses,
}: {
  cohorts: StageCohort[];
  statuses: string[];
}) {
  const rows = stageRows(cohorts, statuses);
  if (rows.length === 0) return null;
  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b-2 border-border text-left font-mono text-[11px] uppercase tracking-wider">
            {/* The space lives INSIDE each cell: a whitespace text node is
                not legal as a child of <tr> or <tbody> and React warns that it
                will cause a hydration error. */}
            <th className="py-2 pr-3 font-bold">Filed </th>
            <th className="py-2 pr-3 text-right font-bold">Cases filed </th>
            {rows.map((r) => (
              <th key={r.status} className="py-2 pr-3 text-right font-bold">
                {stageMeta(r.status).label}{" "}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c, i) => (
            <tr key={c.month} className="border-b border-border/25">
              <td className="py-1.5 pr-3 font-mono tabular-nums">{c.month} </td>
              <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                {c.filed.toLocaleString()}{" "}
              </td>
              {rows.map((r) => (
                <td
                  key={r.status}
                  className="py-1.5 pr-3 text-right font-mono tabular-nums"
                >
                  {(r.counts[i] ?? 0) > 0 ? (
                    (r.counts[i] ?? 0).toLocaleString()
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}{" "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
