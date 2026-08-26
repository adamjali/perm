"use client";

/**
 * How many employment-based adjustment applications sit ahead of a priority
 * date, from USCIS's own monthly pending inventory.
 *
 * THE ANSWER IS A RANGE AND IT IS PRESENTED AS ONE. USCIS replaces any cell
 * holding 1 to 10 applications with the letter D, so an exact total is not
 * knowable from the release. Two figures of equal weight, a floor and a
 * ceiling, both arithmetically true. Printing "12,340 to 23,450" as one
 * string would read as a single number with a typographic hiccup, and
 * resolving every D to its midpoint, which is what the rival does, invents a
 * precision the source withheld. This is the same discipline /perm-denial-risk
 * applies when it refuses to blend its factors into one score.
 *
 * THE CERTAINTY BAR is the drawing that carries it: solid up to the floor,
 * hatched across the span USCIS refuses to resolve, scaled to the ceiling
 * with NO empty track behind it, so it cannot read as a progress meter. The
 * ratio of solid to hatched IS the precision of the answer and it varies
 * enormously: half a percent hatched on the Rest-of-the-World EB2 span, and
 * ninety percent on the seven pairs USCIS publishes as nothing but suppressed
 * cells. Texture rather than colour alone, so the distinction survives being
 * read without colour.
 *
 * Computation is client-side over the whole published table, which is how
 * every other calculator here works. See `src/lib/i485/position.ts`.
 */

import { Fragment, useId, useMemo, useState } from "react";
import { Users, Warning, Info } from "@phosphor-icons/react";

import {
  certaintySplit,
  computeI485Position,
  type I485CellTable,
} from "@/lib/i485/position";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface I485QueuePositionProps {
  cells: I485CellTable;
  options: readonly { country: string; categories: readonly string[] }[];
  /** USCIS's own as-of date for the release, `YYYY-MM-DD`. */
  asOf: string | null;
  /** Counted pending inventory per release, oldest first. */
  trend: readonly { asOf: string; total: number }[];
  className?: string;
}

/**
 * USCIS reports the code; the reader needs the preference category.
 *
 * The four EB-5 set-asides all print "(EB5)" in the source workbook and are
 * genuinely separate visa pools with their own allocations, so they are
 * separate rows here rather than one EB-5 line.
 */
const CATEGORY_LABELS: Record<string, string> = {
  EB1: "EB-1, priority worker",
  EB2: "EB-2, advanced degree or exceptional ability",
  EB3: "EB-3, skilled worker or professional",
  EW3: "EW-3, other worker",
  EB4: "EB-4, special immigrant",
  CRW: "Certain religious worker",
  EB5R: "EB-5, rural set-aside",
  EB5HU: "EB-5, high-unemployment set-aside",
  EB5I: "EB-5, infrastructure set-aside",
  EB5U: "EB-5, unreserved",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The years the form offers, which is deliberately WIDER than any one
 * category's published span.
 *
 * Clamping the year select to the selected pair's coverage would make the
 * out-of-range answer unreachable, and that answer is the honest half of this
 * tool: India's EB2 and EB3 backlogs are published only through priority-date
 * year 2015, so someone holding a 2019 date has to be able to select 2019 and
 * be told plainly that every published application is ahead of them.
 */
const FIRST_YEAR = 2006;
const LAST_YEAR = 2026;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i);

const SELECT_CLASS =
  "mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

function label(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** "2026-08-05" to "August 5, 2026". Formats on the server-supplied string. */
function formatAsOf(iso: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function I485QueuePosition({
  cells,
  options,
  asOf,
  trend,
  className,
}: I485QueuePositionProps) {
  const countryId = useId();
  const categoryId = useId();
  const yearId = useId();
  const monthId = useId();

  // India EB2 is the default because it is the queue this site's readers are
  // actually in: PERM filers are overwhelmingly EB-2 and EB-3, and India is
  // the backlog those readers arrive asking about. 2013 sits inside its
  // published span, so the tool opens on a real answer rather than on its
  // own out-of-range state.
  const [country, setCountry] = useState(
    () => options.find((o) => o.country === "India")?.country ?? options[0]?.country ?? "",
  );
  const [category, setCategory] = useState("EB2");
  const [year, setYear] = useState(2013);
  const [month, setMonth] = useState(1);

  const categories = useMemo(
    () => options.find((o) => o.country === country)?.categories ?? [],
    [options, country],
  );

  // Countries do not all publish the same categories, so a country change can
  // strand the selected one. Resolved at render rather than in an effect: the
  // fallback is what gets computed AND what the select shows, so the two
  // cannot disagree for a frame.
  const activeCategory = categories.includes(category) ? category : (categories[0] ?? "");

  const position = useMemo(
    () => computeI485Position(cells, country, activeCategory, year, month),
    [cells, country, activeCategory, year, month],
  );

  const asOfLabel = formatAsOf(asOf);

  if (!position) {
    // The deploy-skew window: a frontend live before its data, or a release
    // that dropped a pair. Never a bad selection, since the options come from
    // the same release as the cells.
    return (
      <div className={cn("border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
        <p className="text-base leading-relaxed">
          USCIS&apos;s pending inventory for this category is being fetched. Until
          it lands,{" "}
          <a
            href="https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data"
            className="font-bold underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            USCIS publishes it directly
          </a>
          .
        </p>
      </div>
    );
  }

  const split = certaintySplit(position);
  const coverageLabel =
    position.coverage.earliest === 0
      ? `before ${FIRST_YEAR} through ${position.coverage.latest}`
      : `${position.coverage.earliest} through ${position.coverage.latest}`;
  const latestPublishedLabel = `${MONTHS[position.latestPublished[1] - 1]} ${position.latestPublished[0]}`;

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            How many are ahead of you?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Employment-based adjustment applications USCIS had pending with a
          priority date earlier than yours
          {asOfLabel ? `, as of ${asOfLabel}` : ""}.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor={countryId} className="text-sm font-bold">
              Country of chargeability
            </Label>
            <select
              id={countryId}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={SELECT_CLASS}
            >
              {options.map((o) => (
                <option key={o.country} value={o.country}>
                  {o.country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={categoryId} className="text-sm font-bold">
              Preference category
            </Label>
            <select
              id={categoryId}
              value={activeCategory}
              onChange={(e) => setCategory(e.target.value)}
              className={SELECT_CLASS}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={yearId} className="text-sm font-bold">
              Priority date year
            </Label>
            <select
              id={yearId}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={monthId} className="text-sm font-bold">
              Priority date month
            </Label>
            <select
              id={monthId}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {position.beyondPublished ? (
        /*
         * The out-of-range answer REPLACES the figures rather than sitting as
         * a warning above them. There is no number being withheld here: USCIS
         * publishes no cell at this priority date, so every application in the
         * release is ahead and a position inside the queue does not exist.
         * Greying out a bar under a caveat would imply otherwise.
         */
        <div className="border-b-2 border-border bg-muted p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Warning className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
            <div>
              <h3 className="font-heading text-lg font-black">
                Every published application is ahead of you
              </h3>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/80">
                USCIS publishes {label(activeCategory)} for {country} up to a
                priority date of {latestPublishedLabel}, and yours is later than
                that. So there’s no position to report inside this queue: all{" "}
                {position.categoryLow.toLocaleString("en-US")}
                {position.categorySuppressedCells > 0
                  ? ` to ${position.categoryHigh.toLocaleString("en-US")}`
                  : ""}{" "}
                applications the release carries sit in front of yours.
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                It doesn’t mean nobody is behind you. USCIS reports this
                category by priority-date year from {coverageLabel} and stops
                there, so applications filed with later dates aren’t in the
                release at all and this page can’t count them.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b-2 border-border p-6 sm:p-8">
            {position.exact ? (
              /* USCIS suppressed nothing in this span, so the floor and the
                 ceiling agree and the reader is owed one number rather than
                 the same value printed twice under two different words. */
              <div>
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Ahead of you
                </p>{" "}
                <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">
                  {position.low.toLocaleString("en-US")}
                </p>{" "}
                <p className="mt-3 text-base leading-relaxed text-foreground/70">
                  Exact. USCIS suppressed no cell in this span, so every
                  application it holds ahead of your priority date is counted
                  individually.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      At least
                    </p>{" "}
                    <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">
                      {position.low.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      At most
                    </p>{" "}
                    <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">
                      {position.high.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>

                {/* The certainty bar. Scaled to the ceiling, no empty track. */}
                <div
                  className="mt-6 flex h-10 w-full overflow-hidden border-2 border-border"
                  role="img"
                  aria-label={`Between ${position.low.toLocaleString("en-US")} and ${position.high.toLocaleString("en-US")} applications are ahead. ${position.counted.toLocaleString("en-US")} are counted individually and ${position.suppressedCells.toLocaleString("en-US")} cells were withheld by USCIS.`}
                >
                  <div
                    className="h-full border-r-2 border-border bg-primary"
                    style={{ width: `${split.solid}%` }}
                  />
                  <div
                    className="h-full bg-muted"
                    style={{
                      width: `${split.hatched}%`,
                      // Texture, not a second colour, so the two segments stay
                      // distinguishable without relying on hue. Both stops are
                      // theme tokens, so the hatch inverts with the page.
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--border) 0 2px, transparent 2px 7px)",
                    }}
                  />
                </div>
                <p className="mt-3 text-base leading-relaxed text-foreground/70">
                  <strong>{position.counted.toLocaleString("en-US")}</strong>{" "}
                  {position.counted === 1 ? "application is" : "applications are"}{" "}
                  published individually. USCIS withheld another{" "}
                  <strong>{position.suppressedCells.toLocaleString("en-US")}</strong>{" "}
                  {position.suppressedCells === 1 ? "cell" : "cells"}, each holding
                  between 1 and 10 applications, which is where the gap between the
                  two figures comes from.
                </p>
              </>
            )}
          </div>

          <div className="border-b-2 border-border bg-tint-primary p-6 sm:p-8">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-foreground/60">
              The whole category
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-black leading-none tabular-nums">
              {position.categorySuppressedCells > 0
                ? `${position.categoryLow.toLocaleString("en-US")} to ${position.categoryHigh.toLocaleString("en-US")}`
                : position.categoryLow.toLocaleString("en-US")}
            </p>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              {label(activeCategory)} applications pending for {country}, at every
              priority date USCIS publishes, {coverageLabel}.
              {position.categoryCounted === 0
                ? " USCIS withheld every cell in this category, so its size is only knowable as a range."
                : ""}
            </p>
          </div>
        </>
      )}

      {trend.length > 1 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">
            The whole pending inventory, release by release
          </h3>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Every employment-based adjustment application USCIS reports as
            pending, across all countries and categories. Counted cells only, so
            each figure is a floor.
          </p>
          <ol className="mt-6 space-y-2">
            {[...trend].reverse().map((t) => {
              const max = Math.max(...trend.map((x) => x.total));
              return (
                <Fragment key={t.asOf}>
                  {" "}
                  <li className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-3 [&>*]:min-w-0 sm:grid-cols-[9rem_1fr_6rem]">
                    <span className="truncate text-sm text-foreground/70">
                      {formatAsOf(t.asOf)}
                    </span>{" "}
                    <span className="h-6 w-full border-2 border-border bg-muted">
                      <span
                        className="block h-full bg-foreground/45"
                        style={{ width: `${Math.max((t.total / max) * 100, 1.5)}%` }}
                      />
                    </span>{" "}
                    <span className="text-right text-sm tabular-nums">
                      {t.total.toLocaleString("en-US")}
                    </span>
                  </li>
                </Fragment>
              );
            })}
          </ol>
          <p className="mt-4 text-sm text-foreground/60">
            {(() => {
              const last = trend[trend.length - 1];
              const prev = trend[trend.length - 2];
              if (!last || !prev) return null;
              const delta = last.total - prev.total;
              if (delta === 0) return "The counted inventory didn’t move between these two releases.";
              return `The counted inventory ${delta < 0 ? "fell" : "rose"} by ${Math.abs(delta).toLocaleString("en-US")} between these two releases.`;
            })()}{" "}
            USCIS keeps no archive of past releases, so this series can only grow
            forward from the ones already captured.
          </p>
        </div>
      ) : null}

      <div className="bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-base font-black">
              What this can&apos;t tell you
            </h3>
            <ul className="mt-3 space-y-2">
              {[
                "When you’ll be reached. That depends on how many visa numbers your category and country receive, which the visa bulletin governs and this inventory doesn’t.",
                "The queue is a snapshot taken once a month. Applications ahead of you leave it by being approved, denied or withdrawn, and new ones can arrive with earlier priority dates when someone transfers an approved petition.",
                "Every family member files their own adjustment application, so a household appears here more than once. These are applications, not cases.",
                `Priority dates earlier than ${FIRST_YEAR} sit in a single "prior years" column, so a date before then counts as the front of the queue.`,
              ].map((c) => (
                <li key={c} className="text-base leading-relaxed text-foreground/70">
                  {c}
                </li>
              ))}
            </ul>
            {asOfLabel ? (
              <p className="mt-4 text-sm text-foreground/60">
                USCIS employment-based pending inventory, as of {asOfLabel}.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
