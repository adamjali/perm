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

import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
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
   * The category codes the archive actually publishes, computed on the server
   * from these same bulletins.
   *
   * It used to be a hardcoded list of six, and the archive holds three. The
   * failure was silent and total: picking EB-4, EB-5 or EB-3 other workers
   * left every cell lookup undefined, so the verdict panel, the retrogression
   * note and the whole chart simply stopped rendering, with the only
   * explanation four scrolls down under "what this can't tell you". A
   * selector should not be able to offer a question the data cannot answer.
   */
  categoryCodes: readonly string[];
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
  /**
   * How much of this series came through a third-party mirror rather than
   * from the State Department or a public archive of its own pages.
   *
   * The dataset has two provenances and the split is not cosmetic: the newest
   * bulletins are the ones a verdict is drawn from, and they are the ones the
   * archive missed. A reader is entitled to know which of the two a number in
   * front of them came through, and the row carries it, so there is no reason
   * to average the two into one unqualified claim.
   */
  provenance?: { newestIsMirror: boolean; mirrored: number; total: number } | null;
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

/**
 * Labels for the codes the bulletin uses. Which of these are OFFERED is
 * decided by the archive, not by this map: an entry here for a category the
 * ingest does not hold is inert, and a code with no entry falls back to
 * itself rather than disappearing.
 */
const CATEGORY_LABELS: Record<string, string> = {
  EB1: "EB-1 (extraordinary ability, researchers, managers)",
  EB2: "EB-2 (advanced degree or exceptional ability)",
  EB3: "EB-3 (skilled workers and professionals)",
  EW3: "EB-3 other workers (unskilled)",
  EB4: "EB-4 (special immigrants)",
  EB5: "EB-5 (investors, unreserved)",
};

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

// Plot geometry. Labels live in gutters so none sits on the drawing, and both
// gutters carry an axis TITLE as well as tick labels: the chart puts two
// different date scales on one drawing, bulletin month along the bottom and
// cutoff date up the side, and unlabelled they are indistinguishable.
const W = 720;
const H = 320;
const PAD_L = 104;
const PAD_R = 16;
const PAD_T = 34;
const PAD_B = 58;

type SeriesState = "date" | "current" | "unavailable";
type PdPlacement = "none" | "inside" | "above" | "below";

/**
 * The key, drawn in the same fills the marks use.
 *
 * Every entry renders a real swatch rather than a coloured word. A word
 * tinted with `--data-bad-ink` next to a mark filled with `--data-bad` is two
 * different colours claiming to be one, and the ink token is a different
 * value again in dark mode. Drawing the swatch removes the question.
 *
 * Each entry states when it applies, so the key never lists a mark that is
 * not on the drawing. A key describing marks the reader cannot find is the
 * same defect as a mark with no key.
 */
const LEGEND: {
  key: string;
  label: string;
  show: (series: readonly { state: SeriesState }[], pd: PdPlacement) => boolean;
  swatch: () => ReactNode;
}[] = [
  {
    key: "cutoff",
    label: "The cutoff that month",
    show: (s) => s.some((x) => x.state === "date"),
    swatch: () => (
      <>
        <rect x="0" y="6" width="26" height="10" fill="var(--data-good-ink)" fillOpacity="0.16" />
        <line x1="0" y1="6" x2="26" y2="6" stroke="var(--primary-text)" strokeWidth="3" />
      </>
    ),
  },
  {
    key: "qualified",
    label: "Dates that qualified",
    show: (s) => s.some((x) => x.state === "date"),
    swatch: () => (
      <rect x="0" y="2" width="26" height="14" fill="var(--data-good-ink)" fillOpacity="0.16" />
    ),
  },
  {
    key: "current",
    label: "Current, open to every date",
    show: (s) => s.some((x) => x.state === "current"),
    swatch: () => (
      <>
        <rect x="0" y="2" width="26" height="14" fill="var(--data-good-ink)" fillOpacity="0.16" />
        <rect x="0" y="2" width="26" height="3" fill="var(--data-good-ink)" />
      </>
    ),
  },
  {
    key: "closed",
    label: "Closed, no visa numbers",
    show: (s) => s.some((x) => x.state === "unavailable"),
    swatch: () => (
      <>
        <rect x="0" y="2" width="26" height="14" fill="var(--data-bad)" fillOpacity="0.13" />
        <g stroke="var(--data-bad-ink)" strokeWidth="2.5" strokeOpacity="1">
          <line x1="1" y1="16" x2="15" y2="2" />
          <line x1="9" y1="16" x2="23" y2="2" />
          <line x1="17" y1="16" x2="26" y2="7" />
        </g>
      </>
    ),
  },
  {
    key: "pd",
    label: "Your priority date",
    show: (_s, pd) => pd === "inside",
    swatch: () => (
      <line
        x1="0"
        y1="9"
        x2="26"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="7 5"
        strokeOpacity="0.85"
      />
    ),
  },
];

export function PriorityDateEstimator({
  bulletins,
  categoryCodes,
  today,
  currentBulletinMonth = null,
  currentEmploymentChart = null,
  provenance = null,
  className,
}: PriorityDateEstimatorProps) {
  const dateId = useId();
  const catId = useId();
  const countryId = useId();
  const chartId = useId();
  const hatchId = useId();
  const clipId = useId();

  const [priorityDate, setPriorityDate] = useState("");
  // EB-2 is the category most people arrive asking about, so it opens there
  // when the archive holds it, and falls back to whatever the archive does
  // hold rather than opening on a code that renders nothing.
  const [category, setCategory] = useState(
    () => categoryCodes.find((c) => c === "EB2") ?? categoryCodes[0] ?? "EB2",
  );
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
  //
  // THE DOMAIN IS THE CUTOFFS, NOT THE CUTOFFS PLUS THE READER'S DATE. Those
  // two ranges are routinely a decade apart: EB-2 India's cutoffs cover about
  // two and a half years while the people reading it hold dates from 2022 and
  // later. Stretching the axis to reach one dashed line compresses the whole
  // series into a sliver and destroys the one thing the chart exists to show.
  // An out-of-range date gets an edge marker and the gap stated in words
  // instead, which is a more precise answer than a squashed line anyway.
  const yDomain = (() => {
    if (times.length === 0) return null;
    let lo = Math.min(...times);
    let hi = Math.max(...times);
    // A single distinct value would collapse the axis and print three
    // identical tick labels. Give it half a year of room either side.
    if (hi === lo) {
      lo -= 180 * DAY_MS;
      hi += 180 * DAY_MS;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    return { lo, hi, span: hi - lo };
  })();

  // Inside the drawing, above every cutoff on it, or below every one.
  const pdPlacement: "none" | "inside" | "above" | "below" =
    pdTime === null || yDomain === null
      ? "none"
      : pdTime > yDomain.hi
        ? "above"
        : pdTime < yDomain.lo
          ? "below"
          : "inside";

  // The gap to the nearest end of the drawn range, for an out-of-range date.
  const pdEdgeDays =
    pdTime === null || yDomain === null || pdPlacement === "inside" || pdPlacement === "none"
      ? null
      : Math.round(
          Math.abs(pdTime - (pdPlacement === "above" ? Math.max(...times) : Math.min(...times))) /
            DAY_MS,
        );

  const px = (i: number) =>
    PAD_L + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - PAD_L - PAD_R));
  const py = (t: number) =>
    yDomain === null
      ? H - PAD_B
      : H - PAD_B - ((t - yDomain.lo) / yDomain.span) * (H - PAD_T - PAD_B);

  // One column per bulletin, tiling with no gaps, so a run of closed months
  // reads as a closed PERIOD rather than as a row of unexplained ticks. Wide
  // enough to be a tap target's worth of hover surface at 36 points.
  const stepW =
    series.length <= 1 ? 24 : (W - PAD_L - PAD_R) / (series.length - 1);

  const PLOT_BOTTOM = H - PAD_B;

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

  const xTickIndices = evenTickIndices(series.length, 7);
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
              {categoryCodes.map((code) => (
                <option key={code} value={code}>
                  {CATEGORY_LABELS[code] ?? code}
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
              {provenance && provenance.mirrored > 0 ? (
                <p className="mt-2 text-base leading-relaxed text-foreground/70">
                  {provenance.newestIsMirror ? (
                    <>
                      That bulletin reached this page through a third-party
                      mirror rather than from the State Department or an
                      archive of its own pages, so the figures on it are
                      second-hand.
                    </>
                  ) : (
                    <>
                      That bulletin came from an archive of the State
                      Department&rsquo;s own page.
                    </>
                  )}{" "}
                  {provenance.mirrored} of the {provenance.total} bulletins
                  held here are mirrored the same way. Every one of them is
                  checkable against the source.
                </p>
              ) : null}{" "}
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
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
            Bulletin month along the bottom, the cutoff it published up the
            side. The shaded part of each column is the range of priority dates
            that qualified that month, so a taller column is a month more
            people were current in.
          </p>{" "}
          {pdPlacement === "above" || pdPlacement === "below" ? (
            // Said ABOVE the drawing, because it explains an absence in the
            // drawing. A reader who typed a date and sees no dashed line has
            // to be told why before they read the picture, not after.
            <p className="mt-3 max-w-2xl border-2 border-border bg-muted p-4 text-base font-bold leading-relaxed">
              {formatAsOf(priorityDate)} is{" "}
              {pdEdgeDays !== null
                ? `${pdEdgeDays.toLocaleString("en-US")} days `
                : ""}
              {pdPlacement === "above" ? "later" : "earlier"} than every cutoff
              this category published in the window, so it sits off the{" "}
              {pdPlacement === "above" ? "top" : "bottom"} of the chart. The
              scale stays on the cutoffs: stretching it to reach one line would
              flatten the movement into nothing.
            </p>
          ) : null}{" "}
          <figure className="m-0">
            <div
              className="-mx-1 mt-6 overflow-x-auto px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              // The drawing is wider than a phone, so this scrolls. A
              // scrollable box that cannot be reached or named is unusable by
              // keyboard and invisible to a screen reader.
              role="group"
              aria-label="Cutoff history, scrollable"
              tabIndex={0}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full min-w-[44rem]"
                role="img"
                aria-label={
                  yDomain === null
                    ? `${category} ${country} published no cutoff date in any bulletin from ${formatMonth(series[0]!.month)} to ${formatMonth(series[series.length - 1]!.month)}; each month was either current or closed.`
                    : `Cutoff dates for ${category} ${country} from ${formatMonth(series[0]!.month)} to ${formatMonth(series[series.length - 1]!.month)}. ${series.filter((s) => s.state === "unavailable").length} of the ${series.length} bulletins closed the category outright.`
                }
              >
                <defs>
                  {/* Hatching, not a second opacity. Two states that differ
                      only in how faint they are get read as one state at two
                      strengths, which is how a closed month and an open one
                      once shared a caption. Shut is a different TEXTURE as
                      well as a different colour. */}
                  <pattern
                    id={hatchId}
                    width="7"
                    height="7"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="7" height="7" fill="var(--data-bad)" fillOpacity="0.13" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="7"
                      stroke="var(--data-bad-ink)"
                      strokeWidth="2.5"
                      strokeOpacity="1"
                    />
                  </pattern>
                  <clipPath id={clipId}>
                    <rect
                      x={PAD_L}
                      y={PAD_T}
                      width={W - PAD_L - PAD_R}
                      height={PLOT_BOTTOM - PAD_T}
                    />
                  </clipPath>
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

                {/* Everything that belongs to the plot is clipped to it, so a
                    column half a step wide at either end cannot spill into a
                    gutter and print over an axis label. */}
                <g clipPath={`url(#${clipId})`}>
                  {series.map((s, i) => {
                    const x = px(i) - stepW / 2;
                    if (s.state === "unavailable") {
                      return (
                        <rect
                          key={`c${s.month}`}
                          x={x}
                          y={PAD_T}
                          width={stepW}
                          height={PLOT_BOTTOM - PAD_T}
                          fill={`url(#${hatchId})`}
                        />
                      );
                    }
                    // A current month qualifies every priority date, so its
                    // column is the full height and its cutoff rule sits at
                    // the ceiling. That is not a flourish: for a C month the
                    // cutoff genuinely is "everything".
                    const top = s.state === "current" ? PAD_T : py(Date.parse(s.iso!));
                    return (
                      <g key={`c${s.month}`}>
                        <rect
                          x={x}
                          y={top}
                          width={stepW}
                          height={Math.max(PLOT_BOTTOM - top, 0)}
                          fill="var(--data-good-ink)"
                          fillOpacity="0.16"
                        />
                        {s.state === "current" ? (
                          <rect
                            x={x}
                            y={PAD_T}
                            width={stepW}
                            height="3"
                            fill="var(--data-good-ink)"
                          />
                        ) : null}
                      </g>
                    );
                  })}

                  {/* Segments, never one polyline. A month with no cutoff is a
                      BREAK: joining across it draws a smooth rise through a
                      period when the category was shut and nothing moved. */}
                  {lineSegments.map((pts) => (
                    <polyline
                      key={pts.slice(0, 24)}
                      points={pts}
                      fill="none"
                      stroke="var(--primary-text)"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}

                  {series.map((s, i) =>
                    s.state === "date" && s.iso ? (
                      <circle
                        key={`d${s.month}`}
                        cx={px(i)}
                        cy={py(Date.parse(s.iso))}
                        r="3.5"
                        fill="var(--primary-text)"
                      />
                    ) : null,
                  )}

                  {pdPlacement === "inside" && pdTime !== null ? (
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

                  {/* One hover surface per bulletin, over everything, so any
                      month reports its own cutoff rather than only the two
                      states that used to carry a title. */}
                  {series.map((s, i) => (
                    <rect
                      key={`h${s.month}`}
                      x={px(i) - stepW / 2}
                      y={PAD_T}
                      width={stepW}
                      height={PLOT_BOTTOM - PAD_T}
                      fill="transparent"
                    >
                      <title>
                        {s.state === "unavailable"
                          ? `${formatMonth(s.month)}: closed, no visa numbers`
                          : s.state === "current"
                            ? `${formatMonth(s.month)}: current, open to every priority date`
                            : `${formatMonth(s.month)}: cutoff ${formatAsOf(s.iso!)}`}
                      </title>
                    </rect>
                  ))}
                </g>

                {pdPlacement === "inside" && pdTime !== null ? (
                  // The label shares the line's coordinate. A label parked at
                  // a fixed offset sits under whatever date happens to be
                  // there instead, which is how a rail on another chart on
                  // this site ended up naming a date 204 units away from it.
                  <text
                    x={W - PAD_R - 6}
                    y={Math.min(Math.max(py(pdTime) - 8, PAD_T + 13), PLOT_BOTTOM - 6)}
                    textAnchor="end"
                    fontSize="14"
                    fontWeight="700"
                    fill="currentColor"
                    stroke="var(--card)"
                    strokeWidth="4"
                    paintOrder="stroke"
                  >
                    Your date, {formatAsOf(priorityDate)}
                  </text>
                ) : null}

                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={PLOT_BOTTOM}
                  y2={PLOT_BOTTOM}
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
                <line
                  x1={PAD_L}
                  x2={PAD_L}
                  y1={PAD_T}
                  y2={PLOT_BOTTOM}
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />

                <text
                  x={4}
                  y={18}
                  textAnchor="start"
                  fontSize="13"
                  fontWeight="700"
                  fill="currentColor"
                  fillOpacity="0.75"
                >
                  Cutoff date
                </text>

                {yTicks.map((t) => (
                  <Fragment key={`y${t}`}>
                    {" "}
                    <text
                    x={PAD_L - 10}
                    y={py(t) + 4}
                    textAnchor="end"
                    fontSize="15"
                    fill="currentColor"
                    fillOpacity="0.7"
                  >
                    {formatMonthShort(isoOf(t))}
                    </text>
                  </Fragment>
                ))}

                {xTickIndices.map((idx, i) => (
                  <Fragment key={`x${series[idx]!.month}`}>
                    {" "}
                    <text
                    x={px(idx)}
                    y={PLOT_BOTTOM + 22}
                    textAnchor={tickAnchor(i, xTickIndices.length)}
                    fontSize="15"
                    fill="currentColor"
                    fillOpacity="0.7"
                  >
                    {formatMonthShort(series[idx]!.month)}
                    </text>
                  </Fragment>
                ))}

                <text
                  x={PAD_L + (W - PAD_L - PAD_R) / 2}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="currentColor"
                  fillOpacity="0.75"
                >
                  Bulletin month
                </text>
              </svg>
            </div>
            <figcaption className="mt-5 text-sm leading-relaxed text-foreground/70">
              {/* The legend sits with the marks, drawn in the same fills the
                  marks use. Naming a colour in prose under a chart that
                  scrolls sideways puts the key out of sight of the thing it
                  explains, and a coloured WORD is a third colour that matches
                  neither the mark nor itself across themes. */}
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {LEGEND.filter((l) => l.show(series, pdPlacement)).map((l) => (
                  <Fragment key={l.key}>
                    {" "}
                    <li className="flex items-center gap-2">
                    <svg
                      width="26"
                      height="16"
                      viewBox="0 0 26 16"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      {l.swatch()}
                    </svg>{" "}
                    <span>{l.label}</span>
                    </li>
                  </Fragment>
                ))}
              </ul>{" "}
              <p className="mt-3">
                From the {series.length} visa bulletins published between{" "}
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
