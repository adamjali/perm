import { assignBarLanes, assignLanes, STRIP_PAD, STRIP_W, type Strip } from "@/lib/policyFeed";

import { dayLabel } from "./format";

/**
 * Twelve months of documents on one rail.
 *
 * Every mark is a document on the day it was published: a lime square is a
 * final rule, an ink square a proposed rule, an outlined square a notice. The
 * bar under a proposed rule is its comment window, lime while it is open and
 * grey once it has closed. OFLC's announcements are the short ticks on the
 * lower rail. Marks that share a day stack. The marks are not links: at a
 * phone's width a mark is an 11px square, far under the 44px a tap target
 * needs, and a hit area big enough would overlap its neighbours; the list
 * below is the navigation, and each mark names its document on hover.
 *
 * Plain SVG in a server component: no client bundle, and it paints with the
 * HTML. The drawing keeps a minimum width so its labels never scale below
 * the 14px floor; on a phone it scrolls inside its own box.
 */

const H = 182;
const TOP = 26;
const RAIL_REG = 82;
const RAIL_BAR = 104;
const BAR_LANE = 9;
const RAIL_OFLC = 140;
const AXIS = 170;
const MARK = 13;
const LANE = 17;

function markClass(type: string): string {
  if (type === "Rule") return "fill-primary stroke-foreground";
  if (type === "Proposed Rule") return "fill-foreground stroke-foreground";
  return "fill-background stroke-foreground";
}

export function PolicyStrip({ strip }: { strip: Strip }) {
  const register = assignBarLanes(assignLanes(strip.register, MARK + 3));
  const oflc = assignLanes(strip.oflc, 4);
  const counts = {
    rules: strip.register.filter((m) => m.type === "Rule").length,
    proposed: strip.register.filter((m) => m.type === "Proposed Rule").length,
    notices: strip.register.filter((m) => m.type !== "Rule" && m.type !== "Proposed Rule").length,
  };
  const label =
    `Documents from ${dayLabel(strip.start)} to ${dayLabel(strip.end)}: ${counts.rules} final rules, ` +
    `${counts.proposed} proposed rules, ${counts.notices} notices and ${strip.oflc.length} OFLC announcements, ` +
    `each placed on its publication day, with today marked.`;
  const todayAnchor = strip.todayX > STRIP_W - 90 ? "end" : "middle";
  const inner = STRIP_W - 2 * STRIP_PAD;
  const monthW = inner / Math.max(1, strip.months.length);

  return (
    <div className="mt-6 overflow-x-auto border-2 border-border bg-card shadow-hard">
      <svg
        viewBox={`0 0 ${STRIP_W} ${H}`}
        className="block h-auto min-w-[880px] w-full"
        role="img"
        aria-label={label}
      >
        {/* month grid, labels at each month's middle so the end labels stay inside the box */}
        {strip.months.map((m, i) => (
          <g key={m.label + i}>
            <line x1={m.x} x2={m.x} y1={TOP - 6} y2={AXIS - 16} className="stroke-border" strokeWidth={1} />
            <text
              x={m.x + monthW / 2}
              y={AXIS}
              textAnchor="middle"
              fontSize={16}
              className="fill-muted-foreground font-mono"
            >
              {m.label}{" "}
            </text>
          </g>
        ))}
        <line x1={STRIP_W - STRIP_PAD} x2={STRIP_W - STRIP_PAD} y1={TOP - 6} y2={AXIS - 16} className="stroke-border" strokeWidth={1} />

        {/* rails */}
        <line x1={STRIP_PAD} x2={STRIP_W - STRIP_PAD} y1={RAIL_REG} y2={RAIL_REG} className="stroke-foreground" strokeWidth={2} />
        <line x1={STRIP_PAD} x2={STRIP_W - STRIP_PAD} y1={RAIL_OFLC} y2={RAIL_OFLC} className="stroke-border" strokeWidth={2} />

        {/* comment windows */}
        {register.map((m) =>
          m.bar ? (
            <rect
              key={`bar-${m.documentNumber}`}
              x={m.bar.x0}
              y={RAIL_BAR - 3 + m.barLane * BAR_LANE}
              width={Math.max(2, m.bar.x1 - m.bar.x0)}
              height={6}
              // Not `fill-border`: the border token is ink in light mode, so a
              // closed window drew as black as a proposed rule's mark.
              className={m.bar.open ? "fill-primary" : "fill-foreground/35"}
            >
              <title>{`Comments ${m.bar.open ? "open" : "closed"}: ${m.title} `}</title>
            </rect>
          ) : null,
        )}

        {/* Federal Register documents */}
        {register.map((m) => (
          <rect
            key={m.documentNumber}
            x={m.x - MARK / 2}
            y={RAIL_REG - MARK / 2 - m.lane * LANE}
            width={MARK}
            height={MARK}
            strokeWidth={2}
            className={markClass(m.type)}
          >
            <title>{`${m.type}, ${dayLabel(m.publicationDate)}: ${m.title} `}</title>
          </rect>
        ))}

        {/* OFLC announcements */}
        {oflc.map((m) => (
          <rect
            key={m.documentNumber}
            x={m.x - 1.5}
            y={RAIL_OFLC - 7 - m.lane * 4}
            width={3}
            height={14}
            className="fill-foreground"
          >
            <title>{`OFLC, ${dayLabel(m.publicationDate)}: ${m.title} `}</title>
          </rect>
        ))}

        {/* today */}
        <line
          x1={strip.todayX}
          x2={strip.todayX}
          y1={TOP}
          y2={AXIS - 16}
          className="stroke-foreground"
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        <text x={strip.todayX} y={TOP - 9} textAnchor={todayAnchor} fontSize={16} className="fill-foreground font-mono font-bold">
          today{" "}
        </text>
      </svg>
    </div>
  );
}

/** The marks, in words, under the strip. */
export function StripLegend() {
  const item = (glyph: string, text: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={glyph} />{" "}
      <span>{text}</span>
    </li>
  );
  return (
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-foreground/80">
      {item("inline-block size-3 border-2 border-foreground bg-primary", "final rule")}{" "}
      {item("inline-block size-3 border-2 border-foreground bg-foreground", "proposed rule")}{" "}
      {item("inline-block size-3 border-2 border-foreground bg-background", "notice")}{" "}
      {item("inline-block h-1.5 w-6 bg-primary", "comment window, open")}{" "}
      {item("inline-block h-1.5 w-6 bg-foreground/35", "comment window, closed")}{" "}
      {item("inline-block h-3.5 w-[3px] bg-foreground", "OFLC announcement")}
    </ul>
  );
}
