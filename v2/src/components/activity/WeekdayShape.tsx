import { Fragment } from "react";

import type { WeekdayProfile } from "@/lib/activityStats";
import { cn } from "@/lib/utils";

/**
 * How much DOL decides on each day of the week.
 *
 * THIS DRAWING EXISTS TO CORRECT AN ASSUMPTION. "DOL does not decide cases at
 * weekends" is the natural thing to believe and it is what this codebase says
 * in prose on two live pages. Measured over the disclosure series: 254
 * recorded weekend days, not one of them zero, carrying 5.18% of every
 * decision in the corpus. Saturday averages 91 and Sunday 82, against a
 * weekday mean near 520. Small, steady, and never nothing.
 *
 * ONE COLOUR, NOT TWO. The weekend bars measure the same thing as the weekday
 * bars, so colouring them differently would imply a second kind of quantity.
 * The split is marked structurally instead, with a rule and a label, and the
 * bars carry the difference in the only way that cannot mislead: their length.
 */

export function WeekdayShape({
  profile,
  className,
}: {
  profile: WeekdayProfile[];
  className?: string;
}) {
  const max = Math.max(1, ...profile.map((p) => p.mean));
  const weekend = profile.filter((p) => p.weekday >= 5);
  const weekdays = profile.filter((p) => p.weekday < 5);
  const meanOf = (xs: WeekdayProfile[]) =>
    xs.length === 0
      ? 0
      : Math.round(xs.reduce((a, b) => a + b.mean, 0) / xs.length);
  const zeroWeekend = weekend.reduce((a, b) => a + b.zeroDays, 0);
  const weekendDays = weekend.reduce((a, b) => a + b.days, 0);

  return (
    <div className={className}>
      <ol className="m-0 list-none p-0">
        {profile.map((p) => (
          // Keyed Fragment with a trailing space: array items render with
          // NOTHING between them, so each row's figures glue to the next.
          <Fragment key={p.weekday}>
          <li
            className={cn(
              "py-2",
              // The rule sits between Friday and Saturday and says what it
              // separates. Structure carrying the meaning, not colour.
              p.weekday === 5 && "mt-2 border-t-2 border-border pt-4",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-sm font-bold uppercase tracking-wider">
                {p.label}
              </span>{" "}
              <span className="font-mono text-xs font-bold tabular-nums text-foreground/70">
                {p.mean.toLocaleString("en-US")} a day · {p.days} days ·{" "}
                {p.zeroDays === 0 ? "never zero" : `${p.zeroDays} at zero`}
              </span>
            </div>
            <div className="mt-1 h-4 w-full border-2 border-border bg-background">
              <div
                // See WageLadderRow: --primary fails the 3:1 graphic floor
                // in light mode, the -ink variant passes and is identical in dark.
                className="h-full bg-data-good-ink"
                style={{ width: `${(p.mean / max) * 100}%` }}
                aria-hidden="true"
              />
            </div>
          </li>{" "}
          </Fragment>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-foreground/70">
        A weekday clears about {meanOf(weekdays).toLocaleString("en-US")}{" "}
        decisions and a weekend day about{" "}
        {meanOf(weekend).toLocaleString("en-US")}.{" "}
        {weekendDays > 0 ? (
          <>
            Weekend work is small but routine:{" "}
            {(weekendDays - zeroWeekend).toLocaleString("en-US")} of{" "}
            {weekendDays.toLocaleString("en-US")} Saturdays and Sundays carry at
            least one determination.
          </>
        ) : null}
      </p>
    </div>
  );
}
