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
import { CalendarRange, TrendingDown, TriangleAlert } from "lucide-react";

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
  className?: string;
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

export function PriorityDateEstimator({ bulletins, className }: PriorityDateEstimatorProps) {
  const dateId = useId();
  const catId = useId();
  const countryId = useId();
  const chartId = useId();
  const gradId = useId();

  const [priorityDate, setPriorityDate] = useState("");
  const [category, setCategory] = useState("EB2");
  const [country, setCountry] = useState<CountryKey>("india");
  const [chart, setChart] = useState<ChartKind>("finalAction");

  const estimate = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate)) return null;
    try {
      return estimatePriorityDate({ priorityDate, category, country, chart, bulletins });
    } catch {
      return null;
    }
  }, [priorityDate, category, country, chart, bulletins]);

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
            href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
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
  const pdTime = /^\d{4}-\d{2}-\d{2}$/.test(priorityDate) ? Date.parse(priorityDate) : null;
  const yMin = Math.min(...times, ...(pdTime ? [pdTime] : []));
  const yMax = Math.max(...times, ...(pdTime ? [pdTime] : []));
  const ySpan = Math.max(yMax - yMin, 1);

  const px = (i: number) =>
    PAD_L + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - PAD_L - PAD_R));
  const py = (t: number) => H - PAD_B - ((t - yMin) / ySpan) * (H - PAD_T - PAD_B);

  const line = series
    .map((s, i) => (s.state === "date" && s.iso ? `${px(i)},${py(Date.parse(s.iso))}` : null))
    .filter(Boolean)
    .join(" ");

  const xTickIndices = evenTickIndices(series.length);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const isoOf = (t: number) => new Date(t).toISOString().slice(0, 7);

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            Is my priority date current?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          And, more usefully, which way the line has been moving. Cutoffs go
          backwards as well as forwards.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

      {estimate && estimate.asOfBulletin ? (
        <div
          className={cn(
            "border-b-2 border-border p-6 sm:p-8",
            estimate.isCurrent ? "bg-primary/15" : "bg-muted",
          )}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            In the {formatMonth(estimate.asOfBulletin)} bulletin
          </p>{" "}
          <p className="mt-2 font-heading text-2xl font-black leading-tight sm:text-3xl">
            {estimate.latest?.kind === "unavailable"
              ? "This category was unavailable"
              : estimate.isCurrent
                ? "Your date was current"
                : "Your date was not yet current"}
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
              "No visa numbers were available in this category, whatever the priority date."
            )}
          </p>
        </div>
      ) : null}

      {estimate && estimate.retrogressions.length > 0 ? (
        <div className="flex items-start gap-3 border-b-2 border-border bg-muted p-6 sm:p-8">
          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <p className="text-base leading-relaxed">
            <strong>This cutoff has gone backwards.</strong> It retrogressed in{" "}
            {estimate.retrogressions.map((m) => formatMonth(m)).join(", ")}. Being
            current in one bulletin does not mean being current in the next.
          </p>
        </div>
      ) : null}

      {dated.length >= 2 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">How the cutoff has moved</h3>{" "}
          <figure className="m-0">
            <div className="-mx-1 mt-6 overflow-x-auto px-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full min-w-[34rem]"
                role="img"
                aria-label={`Cutoff dates for ${category} ${country} from ${formatMonth(series[0]!.month)} to ${formatMonth(series[series.length - 1]!.month)}.`}
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

                <polyline
                  points={line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="text-primary"
                />

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
                    // A month with no numbers is drawn as a full-height bar, not
                    // as a missing point, because "shut" is a state and a gap
                    // reads as absent data.
                    <rect
                      key={s.month}
                      x={px(i) - 5}
                      y={PAD_T}
                      width="10"
                      height={H - PAD_T - PAD_B}
                      fill="currentColor"
                      fillOpacity={s.state === "unavailable" ? 0.22 : 0.08}
                    />
                  ),
                )}

                {pdTime !== null ? (
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
                <span className="font-bold text-foreground">The line</span> is the
                cutoff in each bulletin along the bottom. A{" "}
                <span className="font-bold text-foreground">shaded bar</span> is a
                month with no visa numbers at all.
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
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-base font-black">What this cannot tell you</h3>{" "}
            <ul className="mt-3 space-y-2">
              {(estimate?.caveats ?? [
                "Enter a priority date to see where it sits against the cutoff.",
              ]).map((c) => (
                <li key={c} className="text-base leading-relaxed text-foreground/70">
                  {c}
                </li>
              ))}
              <li className="text-base leading-relaxed text-foreground/70">
                This holds archived bulletins, so it is behind the current month.{" "}
                <a
                  href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
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
