"use client";

/**
 * Every employment-based queue in the archive, side by side.
 *
 * The estimator above answers "where does my date sit", which needs one cell
 * of the bulletin. This answers the question underneath it, which needs all
 * thirty: a cutoff that advances thirty days per calendar month is standing
 * still, and a queue only shortens above that. The number on the page going
 * up is not the same thing as the wait getting shorter, and nothing anywhere
 * says so.
 *
 * The pace is arithmetic over a closed, named window. It is not a forecast,
 * there is no per-person estimate anywhere in here, and the pace is withheld
 * outright for a category that is currently shut, because a pace measured up
 * to the month a queue stopped reads as a promise about a queue that no
 * longer exists.
 */

import { Fragment, useMemo, useState } from "react";

import { ViewToggle } from "@/components/tools/ViewToggle";
import { formatMonth, formatAsOf } from "@/lib/dolFormat";
// TYPE-ONLY. `@/lib/turso/bulletin` carries `import "server-only"`, and a
// value import from here would drag it into the client bundle. The type
// import is erased at compile time; the labels below are presentation and
// live with the presentation.
import type { BulletinBoard as Board, BoardCell } from "@/lib/turso/bulletin";
import type { ChartKind, CountryKey } from "@/lib/perm";
import { cn } from "@/lib/utils";

export interface BulletinBoardProps {
  board: Board;
  className?: string;
}

const CHART_OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "finalAction", label: "Final action" },
  { value: "datesForFiling", label: "Dates for filing" },
];

const COUNTRY_LABELS: Record<CountryKey, string> = {
  worldwide: "All other countries",
  china: "China",
  india: "India",
  mexico: "Mexico",
  philippines: "Philippines",
};

/** Short forms for the column heads, where the full label will not fit. */
const COUNTRY_SHORT: Record<CountryKey, string> = {
  worldwide: "Rest of world",
  china: "China",
  india: "India",
  mexico: "Mexico",
  philippines: "Philippines",
};

const CATEGORY_LABELS: Record<string, string> = {
  EB1: "EB-1",
  EB2: "EB-2",
  EB3: "EB-3",
  EW3: "EB-3 other workers",
  EB4: "EB-4",
  EB5: "EB-5",
};

function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

/** "610 days" as "1 year 8 months", which is how a wait is actually thought about. */
function asYearsMonths(days: number): string {
  const months = Math.round(days / 30.4375);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return m === 1 ? "1 month" : `${m} months`;
  const years = y === 1 ? "1 year" : `${y} years`;
  if (m === 0) return years;
  return `${years} ${m === 1 ? "1 month" : `${m} months`}`;
}

function stateText(cell: BoardCell): string {
  if (cell.latest.kind === "current") return "Current";
  if (cell.latest.kind === "unavailable") return "Closed";
  return formatAsOf(cell.latest.iso) ?? cell.latest.iso;
}

export function BulletinBoard({ board, className }: BulletinBoardProps) {
  const [chart, setChart] = useState<ChartKind>("finalAction");
  const cells = chart === "finalAction" ? board.finalAction : board.datesForFiling;

  const byKey = useMemo(() => {
    const m = new Map<string, BoardCell>();
    for (const c of cells) m.set(`${c.category}|${c.country}`, c);
    return m;
  }, [cells]);

  const countries = useMemo(
    () => [...new Set(cells.map((c) => c.country))] as CountryKey[],
    [cells],
  );

  // Ranked fastest first. A cell with no pace is not ranked; it is listed
  // below with the reason, because dropping it silently would make the chart
  // look like the whole board when it is a subset of it.
  const paced = useMemo(
    () =>
      cells
        .filter((c): c is BoardCell & { pace: number } => c.pace !== null)
        .sort((a, z) => z.pace - a.pace),
    [cells],
  );
  const withheld = useMemo(() => cells.filter((c) => c.pace === null), [cells]);

  // The scale always includes 1.0 with room past it, so the holding-station
  // line never sits against an edge where it reads as the maximum.
  const domainMax = useMemo(
    () => Math.max(2, ...paced.map((c) => c.pace)) * 1.06,
    [paced],
  );
  const zeroPct = (1 / domainMax) * 100;

  const window = `${formatMonth(board.firstMonth)} to ${formatMonth(board.lastMonth)}`;

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl font-black leading-tight">
              Which queues are actually moving
            </h2>{" "}
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
              A cutoff that advances thirty days in a month has stood still:
              everyone waiting behind it is exactly as far back as they were.
              Across the {board.bulletinCount} bulletins held here, {window},
              most of these queues moved slower than that.
            </p>
          </div>{" "}
          <ViewToggle
            label="Which chart"
            value={chart}
            options={CHART_OPTIONS}
            onChange={setChart}
          />
        </div>
      </div>

      <div className="border-b-2 border-border p-6 sm:p-8">
        <h3 className="font-heading text-lg font-black">
          Where every category stood in {formatMonth(board.lastMonth)}
        </h3>{" "}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-2 border-border text-left text-sm shadow-hard-sm">
            <caption className="sr-only">
              {`Employment-based ${chart === "finalAction" ? "final action" : "dates for filing"} cutoffs by category and country of birth, from the ${formatMonth(board.lastMonth)} visa bulletin.`}
            </caption>
            <thead className="bg-foreground text-background">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider"
                >
                  Category{" "}
                </th>
                {countries.map((c) => (
                  // The space rides INSIDE the cell. Whitespace between two
                  // <th> has <tr> as its parent, which is invalid HTML and
                  // breaks hydration; inside, it still separates the columns
                  // for anything walking the DOM and costs no layout.
                  <Fragment key={c}>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-mono text-xs font-bold uppercase tracking-wider"
                    >
                      {COUNTRY_SHORT[c]}{" "}
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card">
              {board.categories.map((cat) => (
                <tr key={cat} className="border-t border-border/40">
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left font-bold"
                  >
                    {categoryLabel(cat)}{" "}
                  </th>
                  {countries.map((country) => {
                    const cell = byKey.get(`${cat}|${country}`);
                    return (
                      <Fragment key={country}>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {cell ? (
                            <>
                              <span
                                className={cn(
                                  "font-bold",
                                  cell.latest.kind === "unavailable" &&
                                    "text-data-bad-ink",
                                  cell.latest.kind === "current" &&
                                    "text-primary-text",
                                )}
                              >
                                {stateText(cell)}
                              </span>{" "}
                              {cell.pace !== null ? (
                                <span className="block text-xs text-foreground/60">
                                  {cell.pace.toFixed(2)}x pace
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not held</span>
                          )}{" "}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>{" "}
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          Cutoffs as published in the {formatMonth(board.lastMonth)} bulletin.{" "}
          <strong className="font-bold text-primary-text">Current</strong> means
          the category was open to every priority date that month.{" "}
          <strong className="font-bold text-data-bad-ink">Closed</strong> means
          no visa numbers were being issued at all, so no priority date
          qualified however early it was.
        </p>
      </div>

      {paced.length > 0 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">
            Cutoff days gained per calendar month
          </h3>{" "}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
            Measured between the first and last bulletin here that published a
            real cutoff date for each queue. At 1.00 the cutoff advances one
            month per month and the wait ahead of a fixed priority date is
            unchanged. Below it, the wait got longer while the number on the
            page went up.
          </p>{" "}

          <ul className="mt-6 space-y-3">
            {paced.map((c) => {
              const gaining = c.pace >= 1;
              const pct = (c.pace / domainMax) * 100;
              const left = gaining ? zeroPct : pct;
              const width = Math.max(Math.abs(pct - zeroPct), 0.5);
              return (
                <Fragment key={`${c.category}|${c.country}`}>
                  {" "}
                  <li className="grid grid-cols-1 gap-1 sm:grid-cols-[13rem_1fr_5rem] sm:items-center sm:gap-3 [&>*]:min-w-0">
                  <span className="text-sm font-bold">
                    {categoryLabel(c.category)} {COUNTRY_LABELS[c.country]}
                  </span>{" "}
                  <span className="relative block h-6 border-2 border-border bg-muted">
                    <span
                      className="absolute inset-y-0 block"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: gaining
                          ? "var(--data-good-ink)"
                          : "var(--data-warn-ink)",
                      }}
                    />
                    {/* The baseline is the whole point of the drawing, so it
                        is drawn last and sits above the bars. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 block w-[2px] bg-foreground"
                      style={{ left: `${zeroPct}%` }}
                    />
                  </span>{" "}
                  <span className="text-sm font-bold tabular-nums sm:text-right">
                    {c.pace.toFixed(2)}x
                  </span>
                  </li>
                </Fragment>
              );
            })}
          </ul>{" "}

          <p className="mt-4 text-sm leading-relaxed text-foreground/60">
            The upright rule is 1.00, holding station. Bars reaching{" "}
            <strong className="font-bold text-primary-text">right</strong> of it
            are queues that shortened. Bars reaching{" "}
            <strong className="font-bold text-data-warn-ink">left</strong> of it
            are queues that lengthened while their cutoff was still moving
            forward.
          </p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/60">
            {paced.filter((c) => c.pace < 1).length} of the {paced.length}{" "}
            queues measured here moved slower than one month per month.
          </p>
        </div>
      ) : null}

      {withheld.length > 0 ? (
        <div className="p-6 sm:p-8">
          <h3 className="font-heading text-base font-black">
            Queues with no pace to report
          </h3>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            A pace needs two real cutoff dates to measure between, and it&rsquo;s
            withheld for a category that&rsquo;s currently shut: measured up to
            the month a queue stopped, it would describe a queue that no longer
            exists.
          </p>{" "}
          <ul className="mt-4 space-y-2">
            {withheld.map((c) => (
              <Fragment key={`${c.category}|${c.country}`}>
                {" "}
                <li className="text-base leading-relaxed text-foreground/70">
                <strong className="font-bold text-foreground">
                  {categoryLabel(c.category)} {COUNTRY_LABELS[c.country]}
                </strong>{" "}
                {c.latest.kind === "unavailable" ? (
                  <>
                    was closed in {formatMonth(c.latestMonth)}
                    {c.movedDays !== null && c.movedDays > 0 ? (
                      <>
                        , after advancing {asYearsMonths(c.movedDays)} across
                        the bulletins before it
                      </>
                    ) : null}
                    .
                  </>
                ) : c.latest.kind === "current" ? (
                  <>
                    published no cutoff date in this window. It was open to
                    every priority date instead.
                  </>
                ) : (
                  <>published one cutoff date here, which is too few to measure between.</>
                )}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
