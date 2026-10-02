import { businessDayPace, type DailyTotal } from "@/lib/dolPace";
import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { ChartHoverLayer, type HoverPoint } from "@/components/tools/ChartHoverLayer";

/**
 * How much work DOL has actually been clearing, week by week.
 *
 * WHY WEEKLY AND NOT DAILY, given the series is daily. Drawing 947 days across
 * a 626-unit plot gives each day 0.66 units, and two of every seven are zero
 * because DOL does not decide at weekends. That reads as noise, not as
 * throughput. Summing into weeks keeps every one of the 947 days in the
 * drawing, drops the weekend sawtooth, and leaves about 135 points, which is
 * roughly 4.6 units each - a legible line.
 *
 * WHY THE HEADLINE IS PER BUSINESS DAY. A weekly total answers "how much", and
 * the line already shows that. The number a reader wants next to it is the
 * rate, and a rate over calendar days would be wrong for the same reason the
 * daily chart would be: see businessDayPace.
 *
 * MONTHS PAST THREE YEARS. Since Oct 2 2026 the series reaches back to
 * October 2015 (about 3,900 days): weekly, that is ~560 points at 1.1 units
 * each, the sawtooth problem again one level up. Past three years of record
 * the buckets are calendar months (~130 points), and the readout and labels
 * say so.
 *
 * Both figures come from the same array. Nothing here is modelled, smoothed or
 * projected - the line is DOL's own decisions, summed.
 */

/** Past this many days of record, the line is drawn by month, not by week. */
export const MONTHLY_AFTER_DAYS = 3 * 366;

const W = 720;
const H = 260;
const PAD_L = 64;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 40;

export interface DailyDecisionsChartProps {
  points: readonly DailyTotal[];
  className?: string;
}

/** The Monday of the ISO week a date falls in, as "YYYY-MM-DD". */
function weekStart(iso: string): string {
  // Date-only strings parse as UTC midnight, and every operation below stays
  // in UTC, so this never shifts a day at a timezone boundary.
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** "14 Jul 2025", for the readout, where a month alone would be ambiguous. */
function longDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

/** "July 2025", for a month's readout. */
function monthLong(iso: string): string {
  const [y, m] = iso.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[Number(m) - 1]} ${y}`;
}

function shortLabel(iso: string): string {
  const [y, m] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${y!.slice(2)}`;
}

export function DailyDecisionsChart({ points, className }: DailyDecisionsChartProps) {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, z) => a.date.localeCompare(z.date));
  const spanDays =
    (Date.parse(`${sorted[sorted.length - 1]!.date}T00:00:00Z`) - Date.parse(`${sorted[0]!.date}T00:00:00Z`)) / 86_400_000;
  const monthly = spanDays > MONTHLY_AFTER_DAYS;
  const unit = monthly ? "month" : "week";
  const byWeek = new Map<string, number>();
  for (const p of points) {
    const k = monthly ? `${p.date.slice(0, 7)}-01` : weekStart(p.date);
    byWeek.set(k, (byWeek.get(k) ?? 0) + p.total);
  }
  // Drop the first and last buckets: a series almost never starts on a Monday
  // (or the 1st) or ends on a Sunday (or the last day), so those buckets are
  // partial and would draw as a cliff at each end that nothing in the data
  // justifies.
  const weeks = [...byWeek.entries()].sort((a, z) => a[0].localeCompare(z[0])).slice(1, -1);
  if (weeks.length < 3) return null;

  const pace = businessDayPace(points, 28);
  const max = Math.max(...weeks.map(([, v]) => v));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i * plotW) / (weeks.length - 1);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const line = weeks.map(([, v], i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${PAD_L},${PAD_T + plotH} ${line} ${(PAD_L + plotW).toFixed(1)},${PAD_T + plotH}`;
  const ticks = evenTickIndices(weeks.length, 7);
  // The points the reader can interrogate. A week is the unit that is drawn, so
  // it is the unit the readout names: reporting a day would be answering a
  // question the line does not ask.
  const hover: HoverPoint[] = weeks.map(([w, v], i) => ({
    x: x(i),
    y: y(v),
    label: monthly ? monthLong(w) : `Week of ${longDay(w)}`,
    value: `${v.toLocaleString("en-US")} decisions`,
  }));
  const yTicks = [0, max / 2, max];
  const first = weeks[0]![0];
  const last = weeks[weeks.length - 1]![0];

  return (
    <div className={className}>
      {pace ? (
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {pace.perBusinessDay.toLocaleString("en-US")} decisions per working day
        </p>
      ) : null}{" "}
      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[44rem]"
          role="img"
          aria-label={`Decisions per ${unit} from ${shortLabel(first)} to ${shortLabel(last)}, peaking at ${max.toLocaleString("en-US")}`}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth={v === 0 ? 2 : 1}
                opacity={v === 0 ? 1 : 0.35}
              />
              <text
                x={PAD_L - 8}
                y={y(v) + 5}
                textAnchor="end"
                fontSize="15"
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {Math.round(v).toLocaleString("en-US")}
              </text>
            </g>
          ))}
          <polygon points={area} fill="var(--primary)" opacity="0.14" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--data-good-ink)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {ticks.map((i, n) => (
            <text
              key={i}
              x={x(i)}
              y={H - 12}
              textAnchor={tickAnchor(n, ticks.length)}
              fontSize="15"
              fill="var(--muted-foreground)"
              className="font-mono"
            >
              {shortLabel(weeks[i]![0])}
            </text>
          ))}
          <ChartHoverLayer
            points={hover}
            plot={{ x: PAD_L, y: PAD_T, width: plotW, height: plotH }}
            viewBox={{ width: W, height: H }}
            label={`Decisions per ${unit}. Use the arrow keys to step through the ${unit}s.`}
          />
        </svg>
      </div>{" "}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {monthly ? "Monthly" : "Weekly"} totals from {points.length.toLocaleString("en-US")} days of DOL&apos;s published
        records. The rate counts working days only.
      </p>
    </div>
  );
}
