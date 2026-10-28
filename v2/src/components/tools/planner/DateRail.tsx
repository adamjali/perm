import { MILESTONE_ORDER, type Milestone, type Plan } from "@/lib/perm";
import { cn } from "@/lib/utils";

import { dayLabel, rangeLabel } from "./format";

/** The milestones the plan leads with, in order; the green card ends the line. */
const STOPS: readonly { key: Milestone; label: string }[] = [
  { key: "permFiled", label: "Priority date" },
  { key: "permCertified", label: "PERM certified" },
  { key: "i140Approved", label: "I-140 approved" },
  { key: "i485Filed", label: "I-485 filed" },
  { key: "greenCard", label: "Green card" },
];

/**
 * Your dates on one line: each milestone's typical day with its quick-to-slow range under it,
 * or your own date. A filled dot has happened or is yours; a hollow one is ahead; a dashed one
 * has no date.
 */
export function DateRail({ plan, today, noDateWhy }: { plan: Plan; today: string; noDateWhy: string }) {
  const start = MILESTONE_ORDER.findIndex((m) => plan.milestones[m]);
  return (
    <ol
      aria-label="Your dates"
      className="relative mt-10 grid grid-cols-1 gap-y-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border md:grid-cols-5 md:gap-x-4 md:before:top-[7px] md:before:right-0 md:before:bottom-auto md:before:left-0 md:before:h-0.5 md:before:w-auto [&>*]:min-w-0"
    >
      {STOPS.map((t, i) => {
        const r = plan.milestones[t.key];
        const known = plan.knownMilestones.has(t.key);
        const before = !r && MILESTONE_ORDER.indexOf(t.key) < start;
        const last = i === STOPS.length - 1;
        const passed = known || before || (!!r && r.mid <= today);
        return (
          <li key={t.key} className="relative pl-8 md:pt-8 md:pl-0">
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 left-0 size-4 md:top-0",
                last
                  ? "border-2 border-foreground bg-primary"
                  : !r && !before
                    ? "border-2 border-dashed border-input bg-background"
                    : passed
                      ? "bg-foreground"
                      : "border-2 border-foreground bg-background",
              )}
            />{" "}
            <p className="text-sm text-soft">{t.label}</p>{" "}
            <p className={cn("font-heading font-bold leading-tight tabular-nums", last ? "text-2xl" : "text-xl")}>
              {r ? dayLabel(r.mid, today, known) : before ? "Done" : "No date yet"}
            </p>{" "}
            <p className="text-sm leading-snug text-soft">
              {r ? (known ? "Your date" : r.low === r.high ? "" : rangeLabel(r, today)) : before ? "Before this plan starts" : noDateWhy}
            </p>{" "}
          </li>
        );
      })}
    </ol>
  );
}
