import { Fragment } from "react";
import Link from "next/link";

import type { DayTally } from "@/lib/filingDay";
import { formatCompact, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES, longDate } from "@convex/lib/months";

/**
 * A filing month as a calendar (owner, Oct 27 2026: open a month by filing day): each day
 * shows how many of its cases DOL hasn't decided, shaded by that count, and opens the
 * day's cases. Weeks start on Monday, as DOL's working week does. A day with nothing
 * filed, or one still to come, isn't a link.
 */

/**
 * Three shades of the site's waiting colour, lightest first, each with the ink it carries
 * (text on the two strong fills is black in both themes, as on every status fill). A day
 * with none waiting stays on the tint.
 */
const SHADES = [
  { fill: "bg-soft-wait", ink: "" },
  { fill: "bg-chart-yellow", ink: "text-black" },
  { fill: "bg-chart-orange", ink: "text-black" },
] as const;

const MONDAY_FIRST = [...WEEKDAY_NAMES.slice(1), WEEKDAY_NAMES[0]];

const CELL = "flex min-h-14 flex-col justify-between p-1 sm:p-1.5";

export function MonthDays({ month, days, today }: { month: string; days: Readonly<Record<string, DayTally>>; today: string }) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Blank cells before the 1st, so it lands under its weekday.
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const max = Math.max(1, ...Object.values(days).map((d) => d.waiting));
  const shade = (n: number) => {
    if (n <= 0) return "bg-tint";
    const s = SHADES[Math.min(SHADES.length - 1, Math.floor((n / max) * SHADES.length))] ?? SHADES[0];
    return `${s.fill} ${s.ink}`;
  };

  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-0.5 text-center text-sm text-soft sm:gap-1">
        {MONDAY_FIRST.map((d) => (
          <Fragment key={d}>
            <span>{d.slice(0, 3)}</span>{" "}
          </Fragment>
        ))}
      </div>{" "}
      <ol className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length }, (_, i) => {
          const dd = String(i + 1).padStart(2, "0");
          const iso = `${month}-${dd}`;
          const t = days[iso] ?? { filed: 0, waiting: 0 };
          const inner = (
            <>
              <span className="text-sm font-semibold tabular-nums">{i + 1}</span>{" "}
              {/* A phone's cell is too narrow for "1,094"; the link's label says it in full. */}
              {t.waiting > 0 ? (
                <span className="whitespace-nowrap font-mono text-sm tabular-nums">
                  <span className="sm:hidden">{formatCompact(t.waiting)}</span>{" "}
                  <span className="hidden sm:inline">{formatInt(t.waiting)}</span>
                </span>
              ) : null}
            </>
          );
          return (
            <li key={iso}>
              {t.filed > 0 && iso <= today ? (
                <Link
                  href={`/perm-queue/${month}/${dd}`}
                  aria-label={`${longDate(iso)}: ${formatInt(t.filed)} filed, ${formatInt(t.waiting)} still waiting at DOL. Open the day's cases`}
                  className={cn(
                    CELL,
                    "hover:outline-2 hover:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                    shade(t.waiting),
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <span className={cn(CELL, "text-soft")}>{inner}</span>
              )}{" "}
            </li>
          );
        })}
      </ol>{" "}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-soft">
        <span>Fewer waiting</span>{" "}
        {SHADES.map((s) => (
          <Fragment key={s.fill}>
            <span aria-hidden="true" className={cn("size-4 border border-input", s.fill)} />{" "}
          </Fragment>
        ))}
        <span>More waiting</span>
      </p>
    </div>
  );
}
