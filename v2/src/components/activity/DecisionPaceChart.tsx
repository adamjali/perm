import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { segments, toWeeks, weekStart, type ActivityDay } from "@/lib/activityStats";

/**
 * Decisions per week across the whole record, drawn with its holes intact.
 *
 * WHY WEEKLY. The series is daily, but 947 days across a 626-unit plot gives
 * each day 0.66 units, and the weekday-to-weekend swing (a mean near 520
 * against 91 on Saturday) reads as noise rather than as throughput. Weeks keep
 * every day in the drawing and leave about 135 points, which is legible.
 *
 * WHY IT BREAKS. Two periods carry no record at all: 23 days in October 2025,
 * and 43 days between 2026-06-30 and 2026-08-13, where the quarterly
 * disclosure file had ended and the live scan had not begun. A polyline drawn
 * straight through either one would show a smooth trend across six weeks
 * nobody measured. Each contiguous run gets its own polyline and the hole is
 * left as a hole.
 *
 * WHY TWO COLOURS. The two runs at the right come from different instruments,
 * not different weeks of one instrument: everything up to 2026-06-30 is
 * derived from the quarterly disclosure corpus, and everything after is the
 * per-case scan of flag.dol.gov. Different meaning gets a different colour,
 * never a different opacity, because two shapes that differ only in opacity
 * end up sharing one caption.
 */

const W = 720;
const H = 260;
const PAD_L = 60;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 40;

export interface PaceSeries {
  /** Legend label for this instrument. */
  label: string;
  /** A CSS colour, resolved from a theme token by the caller. */
  color: string;
  days: readonly ActivityDay[];
}

function monthLabel(iso: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m] = iso.split("-");
  return `${months[Number(m) - 1]} ${y!.slice(2)}`;
}

export function DecisionPaceChart({
  series,
  className,
}: {
  series: PaceSeries[];
  className?: string;
}) {
  // One week axis across every instrument, so a week sits at the same x
  // whichever series holds it. Built from the union's own ends rather than
  // per series, or the two runs would each be stretched to the full width and
  // the six-week hole between them would vanish.
  const all = series.flatMap((s) => [...s.days]).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length === 0) return null;
  const spine = toWeeks(all);
  if (spine.length < 3) return null;
  // Every calendar week between the ends, named, so a tick can label a week
  // that no series happens to cover and a series' own weeks can be looked up
  // by name to find their place on the shared axis.
  const weekNames: string[] = [];
  const cursor = new Date(`${weekStart(all[0]!.date)}T00:00:00Z`);
  for (let i = 0; i < spine.length; i++) {
    weekNames.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const weekIndex = new Map(weekNames.map((name, i) => [name, i] as const));

  const runs = series.flatMap((s) =>
    segments(toWeeks(s.days)).map((run) => ({
      color: s.color,
      label: s.label,
      points: run.map(({ week }) => ({
        i: weekIndex.get(week.weekStart) ?? 0,
        total: week.total,
      })),
    })),
  );
  const values = runs.flatMap((r) => r.points.map((p) => p.total));
  if (values.length === 0) return null;
  const max = Math.max(...values);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i * plotW) / Math.max(1, spine.length - 1);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const ticks = evenTickIndices(spine.length, 7);
  const yTicks = [0, max / 2, max];

  return (
    <div className={className}>
      <ul className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-foreground/70">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-[3px] w-8"
              style={{ background: s.color }}
            />{" "}
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[44rem]"
          role="img"
          aria-label={`Decisions per week from ${monthLabel(weekNames[0] ?? "")} to ${monthLabel(weekNames[weekNames.length - 1] ?? "")}, peaking at ${max.toLocaleString("en-US")} in one week. Weeks with no record are drawn as breaks.`}
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
          {runs.map((run, n) =>
            // A run of one week cannot be a line. Drawing it as a dot says
            // "one measurement here", which is exactly what it is: the live
            // scan has produced a single complete week so far.
            run.points.length === 1 ? (
              <circle
                key={`${run.label}-${n}`}
                cx={x(run.points[0]!.i)}
                cy={y(run.points[0]!.total)}
                r="4"
                fill={run.color}
              />
            ) : (
              <polyline
                key={`${run.label}-${n}`}
                points={run.points
                  .map((p) => `${x(p.i).toFixed(1)},${y(p.total).toFixed(1)}`)
                  .join(" ")}
                fill="none"
                stroke={run.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ),
          )}
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
              {monthLabel(weekNames[i] ?? "")}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
