import {
  assignBarLanes,
  assignLanes,
  DOL_TYPE,
  OFLC_TYPE,
  PM_TYPE,
  PRESIDENTIAL_TYPE,
  STRIP_PAD,
  STRIP_W,
  USCIS_TYPE,
  type Strip,
} from "@/lib/policyFeed";

import { ChartTips } from "@/components/data/ChartTips";

import { dayLabel } from "./format";

/**
 * Twelve months of documents on one rail.
 *
 * Every mark is a document on the day it was published: a lime square is a
 * final rule, a yellow square a proposed rule, a blue one a notice, an orange
 * one a presidential document. The bar under a proposed rule is its comment
 * window, lime while it is open and sage once it has closed. The agencies' own
 * announcements (USCIS, its Policy Manual, DOL and OFLC) are the short ticks
 * on the lower rail. Marks that share a day stack. The marks are not links: at a
 * phone's width a mark is an 11px square, far under the 44px a tap target
 * needs, and a hit area big enough would overlap its neighbours; the list
 * below is the navigation, and each mark names its document on hover, tap
 * or arrow key (`ChartTips`).
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
const RAIL_POSTS = 140;
const AXIS = 170;
const MARK = 13;
const LANE = 17;

/** The legend's word for a document type. */
function typeWord(type: string): string {
  if (type === "Rule") return "Final rule";
  if (type === "Proposed Rule") return "Proposed rule";
  if (type === PRESIDENTIAL_TYPE) return "Presidential document";
  return "Notice";
}

/** Whose announcement a tick is. */
function postWord(type: string): string {
  if (type === USCIS_TYPE) return "USCIS announcement";
  if (type === PM_TYPE) return "USCIS Policy Manual update";
  if (type === DOL_TYPE) return "DOL news release";
  if (type === OFLC_TYPE) return "OFLC announcement";
  return "Announcement";
}

function markClass(type: string): string {
  if (type === "Rule") return "fill-primary stroke-foreground";
  // Colour, not black and grey (round 3, Oct 15 2026): a proposal is
  // pending, so yellow; a notice is blue.
  if (type === "Proposed Rule") return "fill-chart-yellow stroke-foreground";
  if (type === PRESIDENTIAL_TYPE) return "fill-chart-orange stroke-foreground";
  return "fill-chart-blue stroke-foreground";
}

export function PolicyStrip({ strip }: { strip: Strip }) {
  const register = assignBarLanes(assignLanes(strip.register, MARK + 3));
  const posts = assignLanes(strip.announcements, 4);
  const counts = {
    rules: strip.register.filter((m) => m.type === "Rule").length,
    proposed: strip.register.filter((m) => m.type === "Proposed Rule").length,
    presidential: strip.register.filter((m) => m.type === PRESIDENTIAL_TYPE).length,
    notices: strip.register.filter((m) => !["Rule", "Proposed Rule", PRESIDENTIAL_TYPE].includes(m.type)).length,
  };
  const label =
    `Documents from ${dayLabel(strip.start)} to ${dayLabel(strip.end)}: ${counts.rules} final rules, ` +
    `${counts.proposed} proposed rules, ${counts.notices} notices, ${counts.presidential} presidential documents ` +
    `and ${strip.announcements.length} agency announcements, each placed on its publication day, with today marked.`;
  const todayAnchor = strip.todayX > STRIP_W - 90 ? "end" : "middle";
  const inner = STRIP_W - 2 * STRIP_PAD;
  const monthW = inner / Math.max(1, strip.months.length);

  return (
    <ChartTips label="Twelve months of policy documents" className="mt-6" scroll="border border-border bg-card">
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
        <line x1={STRIP_PAD} x2={STRIP_W - STRIP_PAD} y1={RAIL_POSTS} y2={RAIL_POSTS} className="stroke-border" strokeWidth={2} />

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
              className={m.bar.open ? "fill-primary" : "fill-chart-sage stroke-foreground/40"}
              data-tip={`Comment window ${m.bar.open ? "open" : "closed"}\n${m.title}\nProposed ${dayLabel(m.publicationDate)}`}
            />
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
            data-tip={`${dayLabel(m.publicationDate)}\n${typeWord(m.type)}\n${m.title}`}
          />
        ))}

        {/* the agencies' own announcements */}
        {posts.map((m) => (
          <rect
            key={m.documentNumber}
            x={m.x - 1.5}
            y={RAIL_POSTS - 7 - m.lane * 4}
            width={3}
            height={14}
            className="fill-chart-green stroke-foreground"
            strokeWidth={0.75}
            data-tip={`${dayLabel(m.publicationDate)}\n${postWord(m.type)}\n${m.title}`}
          />
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
    </ChartTips>
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
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-soft">
      {item("inline-block size-3 border-foreground bg-primary border", "final rule")}{" "}
      {item("inline-block size-3 border-foreground bg-chart-yellow border", "proposed rule")}{" "}
      {item("inline-block size-3 border-foreground bg-chart-blue border", "notice")}{" "}
      {item("inline-block size-3 border-foreground bg-chart-orange border", "presidential document")}{" "}
      {item("inline-block h-1.5 w-6 bg-primary", "comment window, open")}{" "}
      {item("inline-block h-1.5 w-6 border border-foreground/40 bg-chart-sage", "comment window, closed")}{" "}
      {item("inline-block h-3.5 w-[4px] border border-foreground bg-chart-green", "agency announcement")}
    </ul>
  );
}
