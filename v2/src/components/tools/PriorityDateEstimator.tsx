"use client";

/**
 * A priority date against the archived visa bulletin series.
 *
 * The verdict is the smaller half. Anyone can read this month's cutoff off the
 * State Department's own page, and this cannot even fetch that page. What the
 * archive gives is the DIRECTION, and direction is the thing a priority date
 * holder actually needs: measured across the archived run, EB-2 India advanced
 * eighteen months, then went backwards, then became unavailable outright.
 *
 * The drawing has to carry three states, not one, which is why it is its own
 * chart rather than the frontier chart reskinned. A cutoff cell is a date, or
 * `C` when the category is open to everyone, or `U` when it is shut to
 * everyone. Plotting `U` as a very old date would read as "nearly there" at
 * the exact moment the category closed.
 */

import { useId, useMemo, useState } from "react";
import { CalendarBlank as CalendarRange, ClockCounterClockwise as History, TrendDown, Warning } from "@phosphor-icons/react";

import {
  estimatePriorityDate,
  type BulletinMonth,
  type CountryKey,
  type ChartKind,
} from "@/lib/perm";
import { formatMonth, formatMonthShort, formatAsOf } from "@/lib/dolFormat";
import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PriorityDateEstimatorProps {
  bulletins: readonly BulletinMonth[];
  /**
   * Today, `YYYY-MM-DD`, computed on the server and passed down.
   *
   * Deliberately not read from `new Date()` in here. This is a client
   * component on an otherwise static page, so a server render either side of
   * midnight from the client's would disagree and React would flag a
   * hydration mismatch. One value, decided once, is also what makes the
   * future-date check testable.
   */
  today: string;
  /**
   * The newest bulletin the State Department has actually published,
   * `YYYY-MM`, read from USCIS at render time. Null when that read failed.
   *
   * It matters that this is sourced rather than guessed: the bulletin is
   * forward-dated, so on 2026-08-25 the bulletin in force is August and
   * September is already out. Deriving "how far behind" from the calendar
   * alone understates it by one, and inventing the number is exactly the
   * thing this page must not do.
   */
  currentBulletinMonth?: string | null;
  /**
   * Which chart USCIS accepts for EMPLOYMENT-BASED adjustment filings in
   * `currentBulletinMonth`, read from USCIS at render time. Null when that
   * read failed.
   *
   * Worth surfacing because it decides whether an I-485 can be filed at all,
   * it changes month to month, and it is the one current, primary fact this
   * page can honestly show while its cutoff series is stuck in the past.
   */
  currentEmploymentChart?: "Final Action Dates" | "Dates for Filing" | null;
  className?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const DOS_BULLETIN_URL =
  "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html";
const USCIS_CHARTS_URL =
  "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";

/** Whole months from `from` to `to`, both `YYYY-MM`. Negative if `to` is earlier. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (fy === undefined || fm === undefined || ty === undefined || tm === undefined) return 0;
  return (ty - fy) * 12 + (tm - fm);
}

function countOfMonths(n: number): string {
  return n === 1 ? "one month" : `${n} months`;
}

function countOfBulletins(n: number): string {
  return n === 1 ? "one bulletin" : `${n} bulletins`;
}

const CATEGORIES = [
  { code: "EB1", label: "EB-1 (extraordinary ability, researchers, managers)" },
  { code: "EB2", label: "EB-2 (advanced degree or exceptional ability)" },
  { code: "EB3", label: "EB-3 (skilled workers and professionals)" },
  { code: "EW3", label: "EB-3 other workers (unskilled)" },
  { code: "EB4", label: "EB-4 (special immigrants)" },
  { code: "EB5", label: "EB-5 (investors, unreserved)" },
] as const;

const COUNTRIES: { code: CountryKey; label: string }[] = [
  { code: "worldwide", label: "All other countries" },
  { code: "india", label: "India" },
  { code: "china", label: "China (mainland born)" },
  { code: "mexico", label: "Mexico" },
  { code: "philippines", label: "Philippines" },
];

const CHARTS: { code: ChartKind; label: string; note: string }[] = [
  {
    code: "finalAction",
    label: "Final action dates",
    note: "When a green card can actually be approved.",
  },
  {
    code: "datesForFiling",
    label: "Dates for filing",
    note: "When the adjustment application can be submitted, if USCIS is honouring this chart.",
  },
];

// Plot geometry. Labels live in gutters so none sits on the drawing.
const W = 720;
const H = 300;
const PAD_L = 78;
const PAD_R = 16;
const PAD_T = 26;
const PAD_B = 42;

export function PriorityDateEstimator({
  bulletins,
  today,
  currentBulletinMonth = null,
  currentEmploymentChart = null,
  className,
}: PriorityDateEstimatorProps) {
  const dateId = useId();
  const catId = useId();
  const countryId = useId();
  const chartId = useId();
  const gradId = useId();

  const [priorityDate, setPriorityDate] = useState("");
  const [category, setCategory] = useState("EB2");
  const [country, setCountry] = useState<CountryKey>("india");
  const [chart, setChart] = useState<ChartKind>("finalAction");

  const pdWellFormed = DATE_RE.test(priorityDate);

  // A priority date is the day DOL received the PERM application, or USCIS the
  // I-140. A date in the future names nothing that has happened, so there is
  // no fact to compare against a cutoff.
  //
  // The old behaviour was the dangerous kind of wrong: 2027-05-25 against a
  // 2014 cutoff returned a confident "your date was not yet current" and a
  // days-later count in the thousands. Every number was arithmetic, none of it
  // meant anything, and nothing on the page suggested doubt. Warn and
  // withhold, the same way the deadline calculator handles reversed
  // recruitment dates.
  const warnings = useMemo(() => {
    const out: string[] = [];
    if (pdWellFormed && priorityDate > today) {
      out.push(
        `A priority date of ${formatAsOf(priorityDate)} is in the future. The priority date is the day DOL received the PERM application, or USCIS received the I-140, so it cannot be later than today. Nothing is compared against the bulletin until that is corrected.`,
      );
    }
    return out;
  }, [pdWellFormed, priorityDate, today]);

  // One flag, read by the verdict, the caveats and the chart alike, so a
  // withheld date cannot leak back in through the drawing.
  const pdUsable = pdWellFormed && warnings.length === 0;

  const estimate = useMemo(() => {
    if (!pdUsable) return null;
    try {
      return estimatePriorityDate({ priorityDate, category, country, chart, bulletins });
    } catch {
      return null;
    }
  }, [pdUsable, priorityDate, category, country, chart, bulletins]);

  // How stale, stated in the two units that are actually true at once: the
  // newest bulletin here versus today's calendar month, and versus the newest
  // bulletin the State Department has published.
  const newestMonth = useMemo(
    () =>
      bulletins.reduce<string | null>(
        (acc, b) => (acc === null || b.bulletinMonth > acc ? b.bulletinMonth : acc),
        null,
      ),
    [bulletins],
  );
  const todayMonth = today.slice(0, 7);
  const monthsBehind = newestMonth ? Math.max(monthsBetween(newestMonth, todayMonth), 0) : 0;
  const bulletinsBehind =
    newestMonth && currentBulletinMonth
      ? Math.max(monthsBetween(newestMonth, currentBulletinMonth), 0)
      : null;

  // USCIS names its charts in prose; the selector names them in ours. One
  // mapping so the comparison below is a string equality and not a guess.
  const selectedChartName =
    chart === "finalAction" ? "Final Action Dates" : "Dates for Filing";
  const uscisChartDiffers =
    currentEmploymentChart !== null && currentEmploymentChart !== selectedChartName;

  // When the newest cutoff is U, the verdict alone is a dead end: "closed that
  // month" is true and tells the reader nothing about their own case. The last
  // bulletin that DID publish a cutoff is where they can still see where they
  // stand.
  // Returns an already-narrowed shape rather than the raw CutoffPoint: the
  // loop rules `unavailable` out at runtime, and handing the union back leaves
  // the JSX unable to reach `.iso` without a cast.
  const lastOpen = useMemo<
    | { bulletinMonth: string; kind: "current" }
    | { bulletinMonth: string; kind: "date"; iso: string }
    | null
  >(() => {
    if (!estimate || estimate.latest?.kind !== "unavailable") return null;
    for (let i = estimate.history.length - 1; i >= 0; i -= 1) {
      const point = estimate.history[i]!;
      if (point.cutoff.kind === "current") {
        return { bulletinMonth: point.bulletinMonth, kind: "current" };
      }
      if (point.cutoff.kind === "date") {
        return { bulletinMonth: point.bulletinMonth, kind: "date", iso: point.cutoff.iso };
      }
    }
    return null;
  }, [estimate]);

  // Positive means the priority date sits BEFORE that cutoff, so it was past it.
  const lastOpenDeltaDays =
    lastOpen && lastOpen.kind === "date" && pdUsable
      ? Math.round((Date.parse(lastOpen.iso) - Date.parse(priorityDate)) / DAY_MS)
      : null;

  // The series is drawn whether or not a priority date has been entered: the
  // movement is worth seeing on its own.
  const series = useMemo(() => {
    const out: { month: string; iso: string | null; state: "date" | "current" | "unavailable" }[] = [];
    for (const b of [...bulletins].sort((a, z) => a.bulletinMonth.localeCompare(z.bulletinMonth))) {
      const cell = b[chart]?.[category]?.[country];
      if (!cell) continue;
      const v = String(cell).trim().toUpperCase();
      if (v === "C") out.push({ month: b.bulletinMonth, iso: null, state: "current" });
      else if (v === "U") out.push({ month: b.bulletinMonth, iso: null, state: "unavailable" });
      else {
        const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(v);
        if (!m) continue;
        const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
        const mo = MONTHS[m[2]!];
        if (!mo) continue;
        const yy = Number(m[3]);
        out.push({
          month: b.bulletinMonth,
          iso: `${yy < 50 ? 2000 + yy : 1900 + yy}-${String(mo).padStart(2, "0")}-${m[1]}`,
          state: "date",
        });
      }
    }
    return out;
  }, [bulletins, chart, category, country]);

  if (bulletins.length === 0) {
    return (
      <div className={cn("border-2 border-border bg-card p-6 shadow-hard", className)}>
        <p className="text-base leading-relaxed">
          The visa bulletin series is being fetched. Until it lands,{" "}
          <a
            href={DOS_BULLETIN_URL}
            className="font-bold underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            the State Department publishes it directly
          </a>
          .
        </p>
      </div>
    );
  }

  const dated = series.filter((s) => s.state === "date" && s.iso);
  const times = dated.map((s) => Date.parse(s.iso!));
  // A withheld priority date is withheld from the drawing too. A 2027 date
  // left in the domain stretches the y axis by years and squashes the real
  // series into a band a few pixels tall, so the chart would misreport the
  // very movement it exists to show.
  const pdTime = pdUsable ? Date.parse(priorityDate) : null;

  // The vertical scale exists only if something dated is plotted. A category
  // that reads C in every bulletin has no dates at all, and an earlier version
  // gated the whole figure on `dated.length >= 2` and so drew NOTHING for it:
  // EB-1 worldwide is C across the entire series, so the one case the legend
  // describes as "a green bar is a month the category was current" was the one
  // case that never rendered a bar.
  const yDomain = (() => {
    if (times.length === 0) return null;
    const all = [...times, ...(pdTime !== null ? [pdTime] : [])];
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    // A single distinct value would collapse the axis and print three
    // identical tick labels. Give it half a year of room either side.
    if (hi === lo) {
      lo -= 180 * DAY_MS;
      hi += 180 * DAY_MS;
    }
    return { lo, hi, span: hi - lo };
  })();

  const px = (i: number) =>
    PAD_L + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - PAD_L - PAD_R));
  const py = (t: number) =>
    yDomain === null
      ? H - PAD_B
      : H - PAD_B - ((t - yDomain.lo) / yDomain.span) * (H - PAD_T - PAD_B);

  // Segments, not one polyline. A month with no cutoff is a BREAK: joining
  // across it draws a smooth rise through a period when the category was
  // shut and nothing moved, inventing movement that never happened.
  const lineSegments: string[] = [];
  {
    let run: string[] = [];
    series.forEach((s, i) => {
      if (s.state === "date" && s.iso) {
        run.push(`${px(i)},${py(Date.parse(s.iso))}`);
      } else {
        if (run.length > 1) lineSegments.push(run.join(" "));
        run = [];
      }
    });
    if (run.length > 1) lineSegments.push(run.join(" "));
  }

  const xTickIndices = evenTickIndices(series.length);
  const yTicks = yDomain
    ? [yDomain.lo, (yDomain.lo + yDomain.hi) / 2, yDomain.hi]
    : [];
  const isoOf = (t: number) => new Date(t).toISOString().slice(0, 7);

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            Is my priority date current?
          </h2>
        </div>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          And which way the cutoff has been moving. Cutoffs go backwards as
          well as forwards.
        </p>{" "}

        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={dateId} className="text-sm font-bold">
              Your priority date
            </Label>
            {/* Shared DateInput: it carries min-w-0, which is what keeps a date
                field inside its grid track on iOS. */}
            <DateInput
              id={dateId}
              value={priorityDate}
              onChange={(e) => setPriorityDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor={catId} className="text-sm font-bold">
              Category
            </Label>
            <select
              id={catId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={countryId} className="text-sm font-bold">
              Country of birth
            </Label>
            <select
              id={countryId}
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryKey)}
              className="mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={chartId} className="text-sm font-bold">
              Chart
            </Label>
            <select
              id={chartId}
              value={chart}
              onChange={(e) => setChart(e.target.value as ChartKind)}
              className="mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {CHARTS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-foreground/60">
              {CHARTS.find((c) => c.code === chart)?.note}
            </p>
          </div>
        </div>
      </div>

      {warnings.length > 0 ? (
        // Warnings sit ABOVE everything they cast doubt on. A date computed
        // from suspect input must never read as more authoritative than the
        // doubt about the input, and below the answer is where nobody looks.
        <div className="border-b-2 border-border bg-tint-primary p-6 sm:p-8" role="alert">
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-3 [&+&]:mt-4">
              <Warning
                className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                aria-hidden="true"
              />{" "}
              <p className="text-base font-bold leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      ) : null}{" "}

      {newestMonth ? (
        // Which bulletin is being read, and how old it is, next to the answer
        // rather than in a footnote. Being two bulletins behind is defensible.
        // Being two bulletins behind silently is not.
        <div className="border-b-2 border-border bg-muted p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <History className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
            <div>
              <p className="text-base font-bold leading-relaxed">
                Reading the {formatMonth(newestMonth)} visa bulletin
                {bulletinsBehind !== null && bulletinsBehind > 0 ? (
                  <>
                    , {countOfBulletins(bulletinsBehind)} behind the current one
                    ({formatMonth(currentBulletinMonth!)})
                  </>
                ) : monthsBehind > 0 ? (
                  <>, {countOfMonths(monthsBehind)} behind {formatMonth(todayMonth)}</>
                ) : null}
                .
              </p>{" "}
              {monthsBehind > 0 || (bulletinsBehind !== null && bulletinsBehind > 0) ? (
                <>
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    That&apos;s the newest bulletin this page can read, and it
                    won&apos;t catch up on its own. The State Department
                    publishes the bulletin on a site that refuses automated
                    requests, and since mid-July 2026 it has refused the
                    Internet Archive&apos;s crawler too, so the months after{" "}
                    {formatMonth(newestMonth)} have never been archived
                    anywhere this page can reach.
                  </p>{" "}
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    For the current cutoff, read it at the source. What the
                    archive holds and a single bulletin doesn’t is the movement:{" "}
                    {bulletins.length} bulletins of it, including the months the
                    cutoff went backwards.
                  </p>{" "}
                </>
              ) : (
                <p className="mt-2 text-base leading-relaxed text-foreground/70">
                  These figures come from that bulletin and the ones before it.
                  Cutoffs change every month, in both directions.
                </p>
              )}{" "}
              <p className="mt-3">
                <a
                  href={DOS_BULLETIN_URL}
                  className="inline-flex min-h-[44px] items-center font-bold underline underline-offset-2 hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the current visa bulletin at travel.state.gov
                </a>
              </p>{" "}

              {currentBulletinMonth && currentEmploymentChart ? (
                // The one CURRENT, primary fact this page can honestly show
                // while its own cutoff series is stuck in the past. Which
                // chart USCIS accepts decides whether an I-485 can be filed at
                // all, it changes month to month, and it is published on a
                // host that serves scripts. Dated, sourced, and never used to
                // infer a cutoff.
                <div className="mt-4 border-2 border-border bg-card p-4">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                    What USCIS is accepting now
                  </p>{" "}
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    For {formatMonth(currentBulletinMonth)}, USCIS says
                    employment-based adjustment of status filings must use the{" "}
                    <strong>{currentEmploymentChart}</strong> chart.
                    {uscisChartDiffers ? (
                      <>
                        {" "}
                        You have the <strong>{selectedChartName}</strong> chart
                        selected, which is the other one.
                      </>
                    ) : null}
                  </p>{" "}
                  <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                    Read from uscis.gov on {formatAsOf(today)}. It publishes
                    which chart controls, not the cutoff dates themselves.{" "}
                    <a
                      href={USCIS_CHARTS_URL}
                      className="font-bold underline underline-offset-2 hover:text-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      USCIS filing charts
                    </a>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}{" "}

      {estimate && estimate.asOfBulletin ? (
        <div
          className={cn(
            "border-b-2 border-border p-6 sm:p-8",
            estimate.latest?.kind === "unavailable"
              ? "bg-[color-mix(in_srgb,var(--data-bad)_14%,var(--card))]"
              : estimate.isCurrent
                ? "bg-primary/15"
                : "bg-muted",
          )}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            In the {formatMonth(estimate.asOfBulletin)} bulletin
          </p>{" "}
          <p className="mt-2 font-heading text-2xl font-black leading-tight sm:text-3xl">
            {estimate.latest?.kind === "unavailable"
              ? "This category was closed that month"
              : estimate.isCurrent
                ? "Your date was current"
                : "Your date wasn’t current yet"}
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            {estimate.latest?.kind === "date" ? (
              <>
                The cutoff was <strong>{formatAsOf(estimate.latest.iso)}</strong>.
                {estimate.daysFromCutoff !== null && estimate.daysFromCutoff < 0 ? (
                  <>
                    {" "}
                    Yours is {Math.abs(estimate.daysFromCutoff).toLocaleString("en-US")}{" "}
                    days later.
                  </>
                ) : null}
              </>
            ) : estimate.latest?.kind === "current" ? (
              "The category was open to every priority date."
            ) : (
              "No visa numbers were available in this category, so no priority date qualified."
            )}
          </p>{" "}
          {estimate.latest?.kind === "unavailable" && lastOpen ? (
            // "Closed that month" is true and it is a dead end: it says
            // nothing about the reader's own case. The last bulletin that did
            // publish a cutoff is where they can still see where they stand,
            // and that gap is the thing worth watching when it reopens.
            <div className="mt-4 border-2 border-border bg-card p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                Where your date stood before it closed
              </p>{" "}
              <p className="mt-2 text-base leading-relaxed text-foreground/70">
                {lastOpen.kind === "current" ? (
                  <>
                    The last bulletin here before it closed is{" "}
                    <strong>{formatMonth(lastOpen.bulletinMonth)}</strong>, and
                    the category was <strong>current</strong> that month: open
                    to every priority date, including yours.
                  </>
                ) : (
                  <>
                    The last cutoff published in this category is{" "}
                    <strong>{formatAsOf(lastOpen.iso)}</strong>, in the{" "}
                    <strong>{formatMonth(lastOpen.bulletinMonth)}</strong>{" "}
                    bulletin.{" "}
                    {lastOpenDeltaDays === null ? null : lastOpenDeltaDays >= 0 ? (
                      <>
                        Yours is{" "}
                        {lastOpenDeltaDays.toLocaleString("en-US")} days earlier
                        than that, so it was past the cutoff and would have been
                        current in that month.
                      </>
                    ) : (
                      <>
                        Yours is{" "}
                        {Math.abs(lastOpenDeltaDays).toLocaleString("en-US")}{" "}
                        days later than that, so the cutoff still had that much
                        ground to cover.
                      </>
                    )}
                  </>
                )}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                October starts a new fiscal year with a fresh allocation of visa
                numbers, and the cutoff the category reopens at is set then. It
                can reopen anywhere, earlier or later than where it stood.
              </p>
            </div>
          ) : null}{" "}
          {estimate.latest?.kind === "unavailable" ? (
            <div className="mt-4 border-2 border-border bg-card p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                Why a category closes
              </p>{" "}
              <p className="mt-2 text-base leading-relaxed text-foreground/70">
                Each category gets a fixed number of visas per fiscal year. When
                a category uses its allocation, the State Department marks it
                &quot;U&quot; for the rest of the year and it reopens in October
                with the new year&apos;s numbers. It happens every year, most
                often in the last months of the fiscal year.
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                The chart still shows where the cutoff stood before it closed.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {estimate && estimate.retrogressions.length > 0 ? (
        <div className="flex items-start gap-3 border-b-2 border-border bg-muted p-6 sm:p-8">
          <TrendDown className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <p className="text-base leading-relaxed">
            <strong>This cutoff has gone backwards.</strong> It retrogressed in{" "}
            {estimate.retrogressions.map((m) => formatMonth(m)).join(", ")}. Being
            current in one bulletin doesn’t mean being current in the next.
          </p>
        </div>
      ) : null}

      {series.length >= 2 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">How the cutoff has moved</h3>{" "}
          <figure className="m-0">
            <div className="-mx-1 mt-6 overflow-x-auto px-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full min-w-[34rem]"
                role="img"
                aria-label={
                  yDomain === null
                    ? `${category} ${country} published no cutoff date in any bulletin from ${formatMonth(series[0]!.month)} to ${formatMonth(series[series.length - 1]!.month)}; each month was either current or closed.`
                    : `Cutoff dates for ${category} ${country} from ${formatMonth(series[0]!.month)} to ${formatMonth(series[series.length - 1]!.month)}.`
                }
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {yTicks.map((t) => (
                  <line
                    key={`g${t}`}
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={py(t)}
                    y2={py(t)}
                    stroke="currentColor"
                    strokeOpacity="0.14"
                  />
                ))}

                {lineSegments.map((pts) => (
                  <polyline
                    key={pts.slice(0, 24)}
                    points={pts}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="text-primary"
                  />
                ))}

                {series.map((s, i) =>
                  s.state === "date" && s.iso ? (
                    <circle
                      key={s.month}
                      cx={px(i)}
                      cy={py(Date.parse(s.iso))}
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  ) : (
                    // Two OPPOSITE states, drawn in opposite colours. "Current"
                    // means open to every priority date; "unavailable" means
                    // shut to all of them. An earlier version drew both as the
                    // same grey bar in two opacities and captioned them both
                    // as "no visa numbers at all", which was exactly backwards
                    // for the lighter one.
                    <rect
                      key={s.month}
                      x={px(i) - 5}
                      y={PAD_T}
                      width="10"
                      height={H - PAD_T - PAD_B}
                      fill={
                        s.state === "unavailable" ? "var(--data-bad)" : "var(--primary)"
                      }
                      fillOpacity={s.state === "unavailable" ? 0.3 : 0.22}
                    >
                      <title>
                        {s.state === "unavailable"
                          ? `${formatMonth(s.month)}: category closed, no visa numbers`
                          : `${formatMonth(s.month)}: current, open to every priority date`}
                      </title>
                    </rect>
                  ),
                )}

                {pdTime !== null && yDomain !== null ? (
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={py(pdTime)}
                    y2={py(pdTime)}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="7 5"
                    strokeOpacity="0.85"
                  />
                ) : null}

                {yTicks.map((t) => (
                  <text
                    key={`y${t}`}
                    x={PAD_L - 10}
                    y={py(t) + 4}
                    textAnchor="end"
                    fontSize="13"
                    fill="currentColor"
                    fillOpacity="0.7"
                  >
                    {formatMonthShort(isoOf(t))}
                  </text>
                ))}

                {xTickIndices.map((idx, i) => (
                  <text
                    key={`x${series[idx]!.month}`}
                    x={px(idx)}
                    y={H - PAD_B + 22}
                    textAnchor={tickAnchor(i, xTickIndices.length)}
                    fontSize="13"
                    fill="currentColor"
                    fillOpacity="0.7"
                  >
                    {formatMonthShort(series[idx]!.month)}
                  </text>
                ))}
              </svg>
            </div>
            <figcaption className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/70">
              <p>
                {yDomain !== null ? (
                  <>
                    <span className="font-bold text-foreground">The line</span>{" "}
                    is the cutoff in each bulletin along the bottom, and it
                    breaks wherever there was no cutoff to plot. A{" "}
                  </>
                ) : (
                  <>
                    No bulletin in this range published a cutoff date for this
                    category, so there’s no line to draw. Every month was one
                    of the two other states instead. A{" "}
                  </>
                )}
                <span className="font-bold text-primary">green bar</span> is a month
                the category was <strong>current</strong>, open to every priority
                date. A{" "}
                <span className="font-bold text-[var(--data-bad-ink)]">red bar</span>{" "}
                is a month it was <strong>closed</strong>, with no visa numbers at
                all.
                {pdTime !== null ? (
                  <>
                    {" "}
                    <span className="font-bold text-foreground">The dashed line</span>{" "}
                    is your priority date; the cutoff has to rise above it.
                  </>
                ) : null}
              </p>{" "}
              <p>
                From the visa bulletins published between{" "}
                {formatMonth(series[0]!.month)} and{" "}
                {formatMonth(series[series.length - 1]!.month)}.
              </p>
            </figcaption>
          </figure>
        </div>
      ) : null}

      <div className="bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <Warning className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-base font-black">What this can’t tell you</h3>{" "}
            <ul className="mt-3 space-y-2">
              {(estimate?.caveats ?? [
                "Enter a priority date to see where it sits against the cutoff.",
              ]).map((c) => (
                <li key={c} className="text-base leading-relaxed text-foreground/70">
                  {c}
                </li>
              ))}
              <li className="text-base leading-relaxed text-foreground/70">
                It can’t tell you this month&apos;s cutoff. It holds archived
                bulletins only, and the archive itself stops at{" "}
                {newestMonth ? formatMonth(newestMonth) : "the last month captured"}.{" "}
                <a
                  href={DOS_BULLETIN_URL}
                  className="font-bold underline underline-offset-2 hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check the current bulletin
                </a>{" "}
                before acting on any of it.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
