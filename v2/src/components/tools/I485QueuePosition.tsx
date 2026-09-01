"use client";

/**
 * How many employment-based adjustment applications sit ahead of a priority
 * date, from USCIS's own monthly pending inventory.
 *
 * THE ANSWER IS A RANGE AND IT IS PRESENTED AS ONE. USCIS replaces any cell
 * holding 1 to 10 applications with the letter D, so an exact total is not
 * knowable from the release. Two figures of equal weight, a floor and a
 * ceiling, both arithmetically true. Resolving every D to its midpoint, which
 * is what the rival does, invents a precision the source withheld. This is the
 * same discipline /perm-denial-risk applies when it refuses to blend its
 * factors into a single score.
 *
 * THE CERTAINTY BAR carries it: solid up to the floor, hatched across the span
 * USCIS refuses to resolve, scaled to the ceiling with NO empty track behind
 * it, so it cannot read as a progress meter. Its two ticks sit at the two
 * figures' own coordinates, which is the whole reason it is an axis and not a
 * decoration: this repo has already shipped a diagram whose label sat 204
 * units from the date it named.
 *
 * WHAT THE COUNT DOES AND DOES NOT INCLUDE. An I-485 can only be filed once
 * the Dates for Filing chart reaches your priority date, so the inventory is
 * the filed cohort, not the eligible one. Anyone AHEAD of you is past that
 * same gate by definition and is counted. Anyone eligible who has not filed
 * yet is not, and that is stated as a caveat and never quantified.
 *
 * Computation is client-side over the whole published table, which is how
 * every other calculator in this suite works. See `src/lib/i485/position.ts`.
 */

import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UsersIcon, InfoIcon } from "@phosphor-icons/react";

import {
  certaintySplit,
  computeI485Position,
  type I485CellTable,
} from "@/lib/i485/position";
import { formatAsOf, formatAsOfShort, formatMonth } from "@/lib/dolFormat";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface I485QueuePositionProps {
  cells: I485CellTable;
  options: readonly { country: string; categories: readonly string[] }[];
  /** USCIS's own as-of date for the release, `YYYY-MM-DD`. */
  asOf: string | null;
  /** Counted pending inventory per release, oldest first. */
  trend: readonly { asOf: string; total: number }[];
  /**
   * The newest Dates for Filing chart, `{ EB1: { india: "15JAN15", ... } }`.
   *
   * Explains the state most visitors land in. Someone holding a 2019 priority
   * date is beyond what USCIS publishes BECAUSE filing has not opened for them
   * yet, and that is an answer rather than a dead end.
   */
  filingChart?: Record<string, Partial<Record<string, string>>> | null;
  /** Which bulletin that chart came from, `YYYY-MM`. */
  filingChartMonth?: string | null;
  className?: string;
}

/**
 * USCIS reports the code; the reader needs the preference category.
 *
 * Declared in PREFERENCE ORDER, which is also the order the selects use: the
 * source sorts alphabetically by code, which put "Certain religious worker"
 * above EB-1 and stranded EW-3 behind four EB-5 set-asides on a site whose
 * traffic is almost entirely EB-2 and EB-3.
 *
 * Labels are kept short because the select is a real constraint: the longest
 * string was the DEFAULT selection and it overflowed its control at every
 * breakpoint. The preference number is what identifies the category; the
 * qualifier only has to disambiguate it.
 */
const CATEGORY_LABELS: Record<string, string> = {
  EB1: "EB-1 priority worker",
  EB2: "EB-2 advanced degree",
  EB3: "EB-3 skilled worker",
  EW3: "EW-3 other worker",
  EB4: "EB-4 special immigrant",
  CRW: "Religious worker",
  EB5U: "EB-5 unreserved",
  EB5R: "EB-5 rural",
  EB5HU: "EB-5 high unemployment",
  EB5I: "EB-5 infrastructure",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

/** I-485 inventory country names to the visa bulletin's column keys. */
const BULLETIN_COUNTRY: Record<string, string> = {
  China: "china",
  India: "india",
  Mexico: "mexico",
  Philippines: "philippines",
  "Rest of the World": "worldwide",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The years the form offers, deliberately WIDER than any one category's
 * published span.
 *
 * Clamping to the selected pair's coverage would make the out-of-range answer
 * unreachable, and that answer is the one most visitors need: India's EB-2 and
 * EB-3 inventories stop at priority-date year 2015, so someone holding a 2019
 * date has to be able to select 2019 and be told what that means.
 */
const FIRST_YEAR = 2006;

const SELECT_CLASS =
  "mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
const EYEBROW_CLASS =
  "font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground";

function label(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Preference order, not the source's alphabetical-by-code order. */
function sortCategories(codes: readonly string[]): string[] {
  return [...codes].sort(
    (a, b) =>
      (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );
}

/** `15JAN15` to `2015-01-15`. The bulletin's own two-digit-year format. */
function parseFilingDate(cell: string | undefined): string | null {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec((cell ?? "").trim().toUpperCase());
  if (!m) return null;
  const idx = MONTHS.findIndex((x) => x.slice(0, 3).toUpperCase() === m[2]);
  if (idx < 0) return null;
  // The bulletin has published two-digit years since long before any priority
  // date this tool can offer, so the 2000s window needs no era heuristic.
  return `20${m[3]}-${String(idx + 1).padStart(2, "0")}-${m[1]}`;
}

export function I485QueuePosition({
  cells,
  options,
  asOf,
  trend,
  filingChart,
  filingChartMonth,
  className,
}: I485QueuePositionProps) {
  const countryId = useId();
  const categoryId = useId();
  const yearId = useId();
  const monthId = useId();
  const router = useRouter();
  const params = useSearchParams();

  // A priority date cannot be later than the release that is answering about
  // it, so the last offerable month is the release's own. Without this the
  // form offers December 2026 against an August 2026 release: a date that
  // cannot exist yet, answered with a panel that never says so.
  const [lastYear, lastMonth] = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(asOf ?? "");
    return m ? [Number(m[1]), Number(m[2])] : [new Date().getUTCFullYear(), 12];
  }, [asOf]);

  const years = useMemo(
    () => Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => lastYear - i),
    [lastYear],
  );

  // India EB2 is the default because it is the queue this site's readers are
  // in: PERM filers are overwhelmingly EB-2 and EB-3, and India is the backlog
  // they arrive asking about. 2013 sits inside its published span, so the tool
  // opens on a real answer rather than on its own out-of-range state.
  const [country, setCountry] = useState(
    () =>
      params.get("country") ||
      options.find((o) => o.country === "India")?.country ||
      options[0]?.country ||
      "",
  );
  const [category, setCategory] = useState(() => params.get("category") || "EB2");
  const [year, setYear] = useState(() => Number(params.get("year")) || 2013);
  const [month, setMonth] = useState(() => Number(params.get("month")) || 1);

  const categories = useMemo(
    () => sortCategories(options.find((o) => o.country === country)?.categories ?? []),
    [options, country],
  );

  // Countries do not all publish the same categories, so a country change can
  // strand the selected one. Resolved at render rather than in an effect: the
  // fallback is what gets computed AND what the select shows, so the two
  // cannot disagree for a frame. The list is in preference order, so the
  // fallback is now the lowest preference number rather than whichever code
  // sorted first alphabetically.
  const activeCategory = categories.includes(category) ? category : (categories[0] ?? "");

  // The whole selection lives in the URL, so a position can be bookmarked,
  // filed in a case note, or sent to a client. An attorney checking five
  // clients could not do any of that before.
  useEffect(() => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("country", country);
    next.set("category", activeCategory);
    next.set("year", String(year));
    next.set("month", String(month));
    if (next.toString() !== params.toString()) {
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }, [country, activeCategory, year, month, params, router]);

  const clampedMonth = year === lastYear ? Math.min(month, lastMonth) : month;

  const position = useMemo(
    () => computeI485Position(cells, country, activeCategory, year, clampedMonth),
    [cells, country, activeCategory, year, clampedMonth],
  );

  const asOfLabel = formatAsOf(asOf);

  /** The Dates for Filing cutoff for this pair, when the bulletin carries one. */
  const filing = useMemo(() => {
    const key = BULLETIN_COUNTRY[country];
    const cell = key ? filingChart?.[activeCategory]?.[key] : undefined;
    if (!cell) return null;
    const trimmed = cell.trim().toUpperCase();
    if (trimmed === "C") return { kind: "current" as const };
    if (trimmed === "U") return { kind: "unavailable" as const };
    const iso = parseFilingDate(cell);
    return iso ? { kind: "date" as const, iso } : null;
  }, [filingChart, country, activeCategory]);

  const notYetFilable =
    filing?.kind === "date" &&
    `${year}-${String(clampedMonth).padStart(2, "0")}-01` > filing.iso;

  const restated = `${country} · ${label(activeCategory)} · ${MONTHS[clampedMonth - 1]} ${year}`;

  const setQuery = useCallback((next: Partial<{ country: string; category: string; year: number; month: number }>) => {
    if (next.country !== undefined) setCountry(next.country);
    if (next.category !== undefined) setCategory(next.category);
    if (next.year !== undefined) setYear(next.year);
    if (next.month !== undefined) setMonth(next.month);
  }, []);

  if (!position) {
    // The deploy-skew window: a frontend live before its data, or a release
    // that dropped a pair. Never a bad selection, since the options come from
    // the same release as the cells.
    return (
      <div className={cn("border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
        <p className="text-base leading-relaxed">
          USCIS’s pending inventory for this category is being fetched. Until
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
  // The low tick's label is dropped, never its tick, when it would run into
  // the high one. The coordinate stays visible either way.
  const showLowLabel = split.solid < 72;

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            How many are ahead of you?
          </h2>
        </div>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Employment-based adjustment applications USCIS had pending with a
          priority date earlier than yours
          {asOfLabel ? `, as of ${asOfLabel}` : ""}.
        </p>{" "}

        <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor={countryId} className="text-sm font-bold">
              Country of chargeability
            </Label>
            <select
              id={countryId}
              value={country}
              onChange={(e) => setQuery({ country: e.target.value })}
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
              onChange={(e) => setQuery({ category: e.target.value })}
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
              onChange={(e) => setQuery({ year: Number(e.target.value) })}
              className={SELECT_CLASS}
            >
              {years.map((y) => (
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
              value={clampedMonth}
              onChange={(e) => setQuery({ month: Number(e.target.value) })}
              className={SELECT_CLASS}
            >
              {MONTHS.filter((_, i) => year < lastYear || i + 1 <= lastMonth).map((m, i) => (
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
         * The out-of-range answer REPLACES the figures rather than warning
         * above them. There is no number being withheld: USCIS publishes no
         * cell at this priority date, so a position inside the queue does not
         * exist and a greyed-out bar would imply one did.
         *
         * It is also the MODAL state, because today's PERM filer holds a
         * 2019-2023 priority date, so it is a neutral result surface and its
         * heading is the data-coverage fact rather than a verdict about the
         * reader. It was bg-muted under a warning triangle, which styled the
         * ordinary case as an error.
         */
        <div className="border-b-2 border-border p-6 sm:p-8">
          <p className={EYEBROW_CLASS}>{restated}</p>{" "}
          <h3 className="mt-2 font-heading text-2xl font-black leading-tight">
            USCIS doesn’t publish this queue past {latestPublishedLabel}
          </h3>{" "}
          {notYetFilable && filing?.kind === "date" ? (
            <p className="mt-3 text-base leading-relaxed text-foreground/80">
              Filing hasn’t opened for this priority date yet. The Dates for
              Filing chart for {label(activeCategory)}, {country} stands at{" "}
              {formatAsOf(filing.iso)}
              {filingChartMonth ? ` in the ${formatMonth(filingChartMonth)} bulletin` : ""},
              and an I-485 can only be filed once that chart reaches your
              priority date. So nobody at your date has filed one, which is why
              USCIS publishes no inventory for it.{" "}
              <a
                href="/tools/priority-date-calculator"
                className="font-bold underline underline-offset-2 hover:text-primary"
              >
                Track that cutoff
              </a>
              .
            </p>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-foreground/80">
              Every application the release carries has an earlier priority date
              than yours, so all{" "}
              {position.categoryLow.toLocaleString("en-US")}
              {position.categorySuppressedCells > 0
                ? ` to ${position.categoryHigh.toLocaleString("en-US")}`
                : ""}{" "}
              of them sit in front of it.
            </p>
          )}{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            It doesn’t mean nobody is behind you. USCIS reports this
            category by priority-date year from {coverageLabel} and stops there,
            so applications filed with later dates aren’t in the release at
            all and this page can’t count them.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b-2 border-border p-6 sm:p-8">
            <p className={EYEBROW_CLASS}>{restated}</p>{" "}
            {position.exact ? (
              /* USCIS suppressed nothing in this span, so the floor and the
                 ceiling agree and the reader is owed one number rather than
                 the same value printed twice under two different words. */
              <div className="mt-4">
                <p className={EYEBROW_CLASS}>Ahead of you</p>{" "}
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
                <div className="mt-4 grid grid-cols-1 gap-6 [&>*]:min-w-0 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <p className={EYEBROW_CLASS}>At least</p>{" "}
                    <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">
                      {position.low.toLocaleString("en-US")}
                    </p>
                  </div>{" "}
                  <div>
                    <p className={EYEBROW_CLASS}>At most</p>{" "}
                    <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">
                      {position.high.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>{" "}

                {/* The certainty bar, as an axis. Scaled to the ceiling, no
                    empty track, and both ticks at their own coordinates. */}
                <div className="mt-6">
                  <div
                    className="flex h-10 w-full overflow-hidden border-2 border-border"
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
                  {/* Ticks carry the two figures at the coordinates they
                      actually occupy. A label parked at a fixed edge while its
                      value sits elsewhere is the defect this repo already
                      booked on the deadline diagram. */}
                  <div className="relative h-9" aria-hidden="true">
                    <span
                      className="absolute top-0 h-2 w-0.5 bg-border"
                      style={{ left: `${split.solid}%` }}
                    />
                    {showLowLabel ? (
                      <span
                        className="absolute top-3 -translate-x-1/2 whitespace-nowrap font-mono text-xs tabular-nums text-foreground/70"
                        style={{ left: `${split.solid}%` }}
                      >
                        {position.low.toLocaleString("en-US")}
                      </span>
                    ) : null}{" "}
                    <span className="absolute right-0 top-0 h-2 w-0.5 bg-border" />
                    <span className="absolute right-0 top-3 whitespace-nowrap font-mono text-xs tabular-nums text-foreground/70">
                      {position.high.toLocaleString("en-US")}
                    </span>{" "}
                  </div>{" "}
                </div>
                <p className="mt-1 text-base leading-relaxed text-foreground/70">
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

{" "}
          <div className="grid grid-cols-1 gap-px [&>*]:min-w-0 border-b-2 border-border bg-border sm:grid-cols-2">
            <div className="bg-card p-6 sm:p-8">
              <p className={EYEBROW_CLASS}>Behind you</p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-none tabular-nums">
                {position.behindLow === position.behindHigh
                  ? position.behindLow.toLocaleString("en-US")
                  : `${position.behindLow.toLocaleString("en-US")} to ${position.behindHigh.toLocaleString("en-US")}`}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                Applications the release carries with a later priority date than
                yours. Anyone who hasn’t filed yet isn’t in this figure.
              </p>
            </div>{" "}
            <div className="bg-tint-primary p-6 sm:p-8">
              <p className={EYEBROW_CLASS}>The whole category</p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-none tabular-nums">
                {position.categorySuppressedCells > 0
                  ? `${position.categoryLow.toLocaleString("en-US")} to ${position.categoryHigh.toLocaleString("en-US")}`
                  : position.categoryLow.toLocaleString("en-US")}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {label(activeCategory)} applications pending for {country}, at
                every priority date USCIS publishes, {coverageLabel}.
                {position.categoryCounted === 0
                  ? " USCIS withheld every cell in this category, so its size is only knowable as a range."
                  : ""}
              </p>
            </div>
          </div>{" "}
        </>
      )}{" "}

      {trend.length > 1 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">
            The whole pending inventory, release by release
          </h3>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Every employment-based adjustment application USCIS reports as
            pending, across all countries and categories, so this is the system
            rather than your own queue. Counted cells only, which makes each
            figure a floor.
          </p>
          {(() => {
            const max = Math.max(...trend.map((x) => x.total));
            return (
              <ol className="mt-6 space-y-2">
                {[...trend].reverse().map((t) => (
                  // Mapped siblings arrive with nothing between them, so the
                  // rows read as one glued run to any extractor.
                  <Fragment key={t.asOf}>
                    {" "}
                    <li className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-3 [&>*]:min-w-0 sm:grid-cols-[9rem_1fr_6rem]">
                      {/* One string at every width. A responsive pair of spans
                          puts BOTH forms in textContent, so an extractor reads
                          "Aug 5, 2026August 5, 2026", and the long form
                          truncates in the 88px track below 640px anyway. The
                          short form fits everywhere and says the same thing. */}
                      <span className="truncate text-sm text-foreground/70">
                        {formatAsOfShort(t.asOf)}
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
                ))}
              </ol>
            );
          })()}{" "}
          <p className="mt-4 text-sm text-foreground/60">
            Each release counts what was pending on its own date, so a month
            moves with both new filings and decisions. USCIS keeps no archive of
            past releases, so this series can only grow forward from the ones
            already captured.
          </p>
        </div>
      ) : null}{" "}

      <div className="bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-base font-black">
              What this can’t tell you
            </h3>{" "}
            <ul className="mt-3 space-y-2">
              {[
                "When you'll be reached. That depends on how many visa numbers your category and country receive, which the visa bulletin governs and this inventory doesn't.",
                "This counts applications already filed. Someone with an earlier priority date who could file and hasn't is ahead of you and isn't in this figure, and USCIS publishes nothing that would size that group.",
                "The queue is a snapshot taken once a month. Applications ahead of you leave it by being approved, denied or withdrawn, and new ones can arrive with earlier priority dates when someone transfers an approved petition.",
                "Every family member files their own adjustment application, so a household appears here more than once. These are applications, not cases.",
                `Priority dates earlier than ${FIRST_YEAR} sit in a single "prior years" column, so a date before then counts as the front of the queue.`,
              ].map((c) => (
                <Fragment key={c}>
                  {" "}
                  <li className="text-base leading-relaxed text-foreground/70">
                    {c}
                  </li>
                </Fragment>
              ))}
            </ul>{" "}
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
