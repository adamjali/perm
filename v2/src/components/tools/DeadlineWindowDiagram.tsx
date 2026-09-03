import { formatAsOf } from "@/lib/dolFormat";
import { cn } from "@/lib/utils";

/**
 * The deadline calculator's own drawing: the case's windows on one date axis.
 *
 * The regulations define spans, and spans want to be drawn — the 180-day
 * filing window, the 30-day quiet period after recruitment, the prevailing
 * wage validity that caps everything. Reading four dates as four rows of text
 * hides the one thing that matters: how the spans sit against each other.
 *
 * Doctrine notes: labels live in a fixed left column, never inside the
 * data-driven bars (a short window would swallow its label); the drawing has
 * a min-width and scrolls in its own container so axis text stays legible on
 * phones; geometry derives from the real dates through one scale.
 */

export interface DeadlineWindowDiagramProps {
  /** All ISO YYYY-MM-DD. */
  pwdDate: string;
  pwdExpiration: string;
  firstRecruitment?: string;
  lastRecruitment?: string;
  windowOpens?: string;
  windowCloses?: string;
  isPwdLimited?: boolean;
  className?: string;
}

const W = 720;
const ROW_H = 44;
const PAD = { top: 26, right: 16, bottom: 34, left: 148 };

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

export function DeadlineWindowDiagram({
  pwdDate,
  pwdExpiration,
  firstRecruitment,
  lastRecruitment,
  windowOpens,
  windowCloses,
  isPwdLimited,
  className,
}: DeadlineWindowDiagramProps) {
  const rows: {
    label: string;
    from: string;
    to: string;
    tone: "muted" | "primary" | "ink";
  }[] = [
    { label: "Wage validity", from: pwdDate, to: pwdExpiration, tone: "muted" },
  ];
  if (firstRecruitment) {
    rows.push({
      label: "Recruitment",
      from: firstRecruitment,
      to: lastRecruitment ?? firstRecruitment,
      tone: "ink",
    });
  }
  if (lastRecruitment && windowOpens) {
    rows.push({
      label: "Quiet period",
      from: lastRecruitment,
      to: windowOpens,
      tone: "muted",
    });
  }
  if (windowOpens && windowCloses && windowOpens <= windowCloses) {
    rows.push({
      label: "Filing window",
      from: windowOpens,
      to: windowCloses,
      tone: "primary",
    });
  } else if (!windowOpens && windowCloses && firstRecruitment) {
    rows.push({
      label: "Filing closes",
      from: firstRecruitment,
      to: windowCloses,
      tone: "primary",
    });
  }
  if (rows.length < 2) return null;

  const d0 = Math.min(...rows.map((r) => day(r.from)));
  const d1 = Math.max(...rows.map((r) => day(r.to)));
  if (d1 <= d0) return null;
  const H = PAD.top + rows.length * ROW_H + PAD.bottom;
  const px = (iso: string) =>
    PAD.left + ((day(iso) - d0) / (d1 - d0)) * (W - PAD.left - PAD.right);

  const FILL = {
    muted: "var(--muted-foreground)",
    primary: "var(--primary)",
    ink: "var(--foreground)",
  } as const;

  return (
    <figure className={cn("m-0", className)}>
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="The case's regulatory windows drawn on one date axis"
          className="block h-auto w-full min-w-[560px] border-2 border-border bg-card shadow-hard-sm"
        >
          {/* Date rails at the domain's ends. */}
          {/* The rails mark the domain's two ends, so the label must sit at
              the date's own x. An earlier version drew the LINE at px(iso)
              and the LABEL at a fixed page edge, which put "February 28" 204
              units away, directly under June 30 — a date the axis never
              labelled at all. They are one thing and share one coordinate. */}
          {[
            { iso: rows[0]!.from, anchor: "start" as const },
            { iso: rows[rows.length - 1]!.to, anchor: "end" as const },
          ].map((t) => (
            <g key={t.iso + t.anchor}>
              <line
                x1={px(t.iso)}
                x2={px(t.iso)}
                y1={PAD.top - 8}
                y2={H - PAD.bottom + 6}
                stroke="var(--border)"
                strokeOpacity="0.3"
              />
              <text
                x={px(t.iso)}
                y={H - PAD.bottom + 24}
                textAnchor={t.anchor}
                fontSize="12"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                fill="var(--foreground)"
                fillOpacity="0.7"
              >
                {formatAsOf(t.iso)}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const y = PAD.top + i * ROW_H;
            const x0 = px(r.from);
            const x1 = Math.max(px(r.to), x0 + 3);
            return (
              <g key={r.label}>
                <text
                  x={PAD.left - 12}
                  y={y + 20}
                  textAnchor="end"
                  fontSize="13"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  fill="var(--foreground)"
                >
                  {r.label}
                </text>
                {/* EACH SPAN CARRIES ITS OWN DATES. The axis prints a handful
                    of ticks, so a reader could see that the filing window ends
                    "somewhere after August" and had no way to ask when. The
                    band is focusable with an aria-label, so the dates are
                    reachable by keyboard and read by a screen reader, and
                    <title> gives the same text on hover. A pointer-only
                    tooltip would hide it from the keyboard and from every
                    phone. */}
                <rect
                  x={x0}
                  y={y + 6}
                  width={x1 - x0}
                  height={22}
                  fill={FILL[r.tone]}
                  fillOpacity={r.tone === "muted" ? 0.28 : 1}
                  stroke="var(--border)"
                  strokeWidth="2"
                  tabIndex={0}
                  role="img"
                  aria-label={`${r.label}: ${formatAsOf(r.from)} to ${formatAsOf(r.to)}`}
                  style={{ outlineOffset: "2px" }}
                >
                  <title>{`${r.label}: ${formatAsOf(r.from)} to ${formatAsOf(r.to)}`}</title>
                </rect>
                {r.label === "Filing window" && isPwdLimited ? (
                  <text
                    x={x1}
                    y={y - 2}
                    textAnchor="end"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                    fill="var(--foreground)"
                    fillOpacity="0.7"
                  >
                    capped by wage expiration
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-foreground/70">
        Every span from the dates entered, drawn to one scale.
      </figcaption>
    </figure>
  );
}
