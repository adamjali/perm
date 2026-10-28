import { shortDate, monthDay } from "@convex/lib/months";
import { ChartHoverLayer, type HoverPoint } from "@/components/tools/ChartHoverLayer";
import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { OpenAtEnd } from "@/components/ui/open-at-end";
import { formatInt } from "@/lib/format";

/**
 * One count over days, as a line: the analyst-review queue at the end of each
 * day, for one. Drawn in SVG with the site's hover and keyboard readout
 * (`ChartHoverLayer`) and the same figures in a table for screen readers.
 *
 * THE AXIS DOESN'T START AT ZERO. A line shows change, and a queue of 80,000
 * that moved by 1,500 is a flat line on a zero axis. The scale runs from just
 * under the lowest day to just over the highest, and its labels say so; the
 * newest point, when it's today's live count, is drawn lime (lime marks now).
 */

const W = 720;
const H = 240;
const PAD_L = 72;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
/** Space above and below the line, as a share of its range. */
const HEADROOM = 0.12;

export interface LinePoint {
  date: string;
  value: number;
}

export function LineChart({
  points,
  label,
  noun,
  nowLabel,
  className,
}: {
  points: readonly LinePoint[];
  /** What the chart shows: the summary, the slider's name and the table caption. */
  label: string;
  /** The value's noun for the readout, "cases". */
  noun: string;
  /** When the newest point is a live reading rather than a day's end, what to call it ("Now"). */
  nowLabel?: string;
  className?: string;
}) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(1, (hi - lo) * HEADROOM);
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i * plotW) / (points.length - 1);
  const y = (v: number) => PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = evenTickIndices(points.length, 6);
  const yTicks = [lo, (lo + hi) / 2, hi];
  const last = points.length - 1;
  const dayName = (p: LinePoint, i: number) => (i === last && nowLabel ? nowLabel : shortDate(p.date) ?? p.date);
  const hover: HoverPoint[] = points.map((p, i) => ({
    x: x(i),
    y: y(p.value),
    label: dayName(p, i),
    value: `${formatInt(p.value)} ${noun}`,
  }));

  return (
    <div className={className}>
      <OpenAtEnd className="-mx-1 px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[36rem]"
          role="group"
          aria-label={`${label}: ${formatInt(points[0]!.value)} on ${shortDate(points[0]!.date) ?? points[0]!.date}, ${formatInt(points[last]!.value)} ${nowLabel ? nowLabel.toLowerCase() : `on ${shortDate(points[last]!.date) ?? points[last]!.date}`}.`}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} opacity={0.35} />
              <text x={PAD_L - 8} y={y(v) + 5} textAnchor="end" fontSize="15" fill="var(--muted-foreground)" className="font-mono">
                {`${formatInt(Math.round(v))} `}
              </text>
            </g>
          ))}
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--input)" strokeWidth={2} />
          <polyline points={line} fill="none" stroke="var(--data-warn-ink)" strokeWidth="2.5" strokeLinejoin="round" />
          {nowLabel ? (
            <circle cx={x(last)} cy={y(points[last]!.value)} r="6" fill="var(--primary)" stroke="var(--foreground)" strokeWidth="2" />
          ) : null}
          {ticks.map((i, n) => (
            <text key={i} x={x(i)} y={H - 10} textAnchor={tickAnchor(n, ticks.length)} fontSize="15" fill="var(--muted-foreground)" className="font-mono">
              {`${i === last && nowLabel ? nowLabel : monthDay(points[i]!.date) ?? points[i]!.date} `}
            </text>
          ))}
          <ChartHoverLayer
            points={hover}
            plot={{ x: PAD_L, y: PAD_T, width: plotW, height: plotH }}
            viewBox={{ width: W, height: H }}
            label={`${label}. Use the arrow keys to step through the days.`}
          />
        </svg>
      </OpenAtEnd>
      {/* sr-only on a <table> can't shrink it below its content; a div can. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Day{" "}</th>
              <th scope="col">{`${noun[0]!.toUpperCase()}${noun.slice(1)} `}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.date}>
                <td>{`${dayName(p, i)} `}</td>
                <td>{`${formatInt(p.value)} `}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
