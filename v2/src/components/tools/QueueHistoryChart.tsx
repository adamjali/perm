import { formatMonthShort } from "@/lib/dolFormat";
import { cn } from "@/lib/utils";

/**
 * DOL's published queue position, drawn over our record of its snapshots.
 *
 * This is the processing-times page's own question — how fast is the line
 * actually moving — answered from the page's own data: every FLAG snapshot we
 * have stored, plotted as a step (a queue position is a step function; a
 * sloped line between readings would claim movement nobody observed).
 *
 * Server-renderable SVG, no client JS. The drawing gets a min-width and
 * scrolls in its own container: SVG text scales with the viewBox, and 12px
 * labels in a 306px phone column render at 5.5px — measured, not guessed.
 */

export interface QueueSnapshotPoint {
  /** When DOL published the reading, ISO date. */
  asOf: string;
  /** The analyst-review queue month at that reading, "YYYY-MM". */
  frontierMonth: string;
}

export interface QueueHistoryChartProps {
  points: readonly QueueSnapshotPoint[];
  className?: string;
}

const W = 720;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 40, left: 64 };

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function dayIndex(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
}

export function QueueHistoryChart({ points, className }: QueueHistoryChartProps) {
  // Oldest first, de-duplicated on the frontier so a run of identical
  // readings draws one step rather than a stack of points.
  const sorted = [...points].sort((a, b) => a.asOf.localeCompare(b.asOf));
  if (sorted.length < 2) return null;

  const x0 = dayIndex(sorted[0]!.asOf);
  const x1 = dayIndex(sorted[sorted.length - 1]!.asOf);
  const months = sorted.map((p) => monthIndex(p.frontierMonth));
  const yMin = Math.min(...months);
  const yMax = Math.max(...months);
  if (x1 === x0 || yMax === yMin) return null;

  const px = (iso: string) =>
    PAD.left + ((dayIndex(iso) - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const py = (month: string) =>
    H - PAD.bottom -
    ((monthIndex(month) - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Step path: hold the old level until the reading that moved it.
  let d = `M ${px(sorted[0]!.asOf).toFixed(1)} ${py(sorted[0]!.frontierMonth).toFixed(1)}`;
  for (let i = 1; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    d += ` H ${px(p.asOf).toFixed(1)} V ${py(p.frontierMonth).toFixed(1)}`;
  }

  // Y ticks: every distinct frontier month observed (they are few).
  const yTicks = [...new Set(sorted.map((p) => p.frontierMonth))];
  // X ticks: first, middle, last snapshot dates.
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  const xTicks = [sorted[0]!, mid, sorted[sorted.length - 1]!];

  return (
    <figure className={cn("m-0", className)}>
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[560px] border-2 border-border bg-card shadow-hard-sm"
          role="img"
          aria-label="DOL's analyst review queue month at each published snapshot"
        >
          {/* Grid + y labels */}
          {yTicks.map((m) => (
            <g key={m}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={py(m)}
                y2={py(m)}
                stroke="var(--border)"
                strokeOpacity="0.25"
              />
              <text
                x={PAD.left - 8}
                y={py(m) + 4}
                textAnchor="end"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                fill="var(--foreground)"
                fillOpacity="0.7"
              >
                {formatMonthShort(m) ?? m}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xTicks.map((p, i) => (
            <text
              key={p.asOf}
              x={i === 0 ? PAD.left : i === 2 ? W - PAD.right : px(p.asOf)}
              y={H - PAD.bottom + 24}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fontSize="12"
              fontFamily="var(--font-mono)"
              fontWeight="700"
              fill="var(--foreground)"
              fillOpacity="0.7"
            >
              {p.asOf}
            </text>
          ))}

          {/* The step line, primary over an ink underlay for weight. */}
          <path d={d} fill="none" stroke="var(--border)" strokeWidth="6" />
          <path d={d} fill="none" stroke="var(--primary)" strokeWidth="3.5" />

          {/* Reading dots at each step change only. */}
          {sorted
            .filter((p, i) => i === 0 || p.frontierMonth !== sorted[i - 1]!.frontierMonth)
            .map((p) => (
              <circle
                key={p.asOf}
                cx={px(p.asOf)}
                cy={py(p.frontierMonth)}
                r="5"
                fill="var(--primary)"
                stroke="var(--border)"
                strokeWidth="2"
              />
            ))}
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-foreground/70">
        Each step is a published DOL reading. Flat stretches are weeks where the
        queue month did not move.
      </figcaption>
    </figure>
  );
}
