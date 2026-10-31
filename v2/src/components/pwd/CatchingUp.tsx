"use client";

import { Fragment, useState } from "react";

import { choiceVariants } from "@/components/ui/choice";
import { formatInt } from "@/lib/format";
import { flowVerdict, type FlowSpan } from "@/lib/pwdNow";
import { cn } from "@/lib/utils";
import { monthDay, weekdayName } from "@convex/lib/months";

/**
 * Is DOL keeping up? The requests that left the line (decided, or withdrawn
 * by the employer) against the new ones filed, for the newest day DOL worked
 * or the newest seven days. Two bars on one scale, and the verdict in words.
 */
export function CatchingUp({ day, week, noun }: { day: FlowSpan; week: FlowSpan; noun: string }) {
  // The week leads: DOL decides about half as many on a Friday (277 to 484 against 688 to 988 on
  // its other days, Sep 16 to Oct 13 2026), so a single day can read backwards.
  const [view, setView] = useState<"day" | "week">("week");
  const f = view === "day" ? day : week;
  const top = Math.max(1, f.out, f.filed);
  const v = flowVerdict(f);
  const when = view === "day" ? `${weekdayName(f.to)}, ${monthDay(f.to)}` : `${monthDay(f.from)} to ${monthDay(f.to)}`;
  const bars = [
    { label: "Left the line", value: f.out, fill: "bg-chart-green border-data-good-ink" },
    { label: `New ${noun}`, value: f.filed, fill: "bg-chart-blue border-data-info-ink" },
  ];
  return (
    <div>
      <div role="group" aria-label="Show one day or one week" className="flex gap-2">
        {(["week", "day"] as const).map((k) => (
          <Fragment key={k}>
            {" "}
            <button type="button" aria-pressed={view === k} onClick={() => setView(k)} className={choiceVariants({ on: view === k })}>
              {k === "day" ? "Day" : "Week"}
            </button>
          </Fragment>
        ))}
      </div>{" "}
      <p className="mt-4 text-sm text-muted-foreground">{when}</p>{" "}
      <dl className="mt-2 space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-base">{b.label}</dt>{" "}
              <dd className="font-heading text-2xl font-bold tabular-nums">{formatInt(b.value)}</dd>
            </div>{" "}
            <div className="mt-1 h-3 w-full bg-muted" aria-hidden="true">
              <div className={cn("h-full border-r-2", b.fill)} style={{ width: `${(b.value / top) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>{" "}
      <p
        className={cn(
          "mt-4 text-base font-semibold",
          v.tone === "good" ? "text-data-good-ink" : v.tone === "bad" ? "text-data-bad-ink" : "text-foreground",
        )}
      >
        {v.text}
      </p>{" "}
      {view === "day" && weekdayName(f.to) === "Friday" ? (
        <p className="mt-1 text-sm text-muted-foreground">DOL decides about half as many on a Friday as on its other days.</p>
      ) : null}{" "}
      {f.issued !== null && f.withdrawn !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          DOL issued {formatInt(f.issued)}; employers withdrew {formatInt(f.withdrawn)}.
        </p>
      ) : null}
    </div>
  );
}
