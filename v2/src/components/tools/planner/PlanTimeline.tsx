import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Fragment, type ReactNode } from "react";

import type { PlanStep } from "@/lib/perm";
import { cn } from "@/lib/utils";
import { MS_PER_DAY } from "@convex/lib/time";

import { axisTicks } from "./axis";
import { dayLabel, lengthLabel } from "./format";

/** Where each step's own page is. */
export const STEP_HREF: Record<PlanStep["key"], string> = {
  pwd: "/pwd-cases",
  recruitment: "/perm-recruitment",
  perm: "/perm-queue",
  i140Prep: "/tools/i140-calculator",
  i140: "/uscis-processing-times#green-card-forms",
  visa: "/visa-bulletin",
  i485: "/i485-by-field-office",
  consular: "/visa-issuances",
  ead: "/uscis-processing-times#green-card-forms",
  ap: "/uscis-processing-times#green-card-forms",
};

/** Done is the colour code's green, every step still to come its yellow, the bulletin wait blue. */
const fillOf = (s: PlanStep) =>
  !s.end
    ? "bg-background bg-hatch border-2 border-input"
    : s.state === "done"
      ? "bg-data-good-ink"
      : s.key === "visa"
        ? "bg-chart-blue border-2 border-data-info-ink"
        : "bg-chart-yellow border-2 border-data-warn";

/** The step's own colour for its number and its length, the same family as its bar. */
const tileOf = (s: PlanStep) =>
  s.state === "done"
    ? "bg-data-good-ink text-background border-2 border-data-good-ink"
    : s.key === "visa"
      ? "bg-chart-blue text-black border-2 border-data-info-ink"
      : "bg-chart-yellow text-black border-2 border-data-warn";
const inkOf = (s: PlanStep) => (s.state === "done" ? "text-data-good-ink" : s.key === "visa" ? "text-data-info-ink" : "text-data-warn-ink");

/** Room past the last date for a step with no end, drawn hatched to the edge. */
const OPEN_END_DAYS = 120;
/** The thinnest a bar is drawn, in percent of the axis, so a one-day step still shows. */
const MIN_BAR_PCT = 0.8;
/** A month label this close to "Today", in percent of the axis, gives way to it. */
const TODAY_CLEARANCE_PCT = 6;
/** The most month labels a phone's narrow axis carries before every other one is left out. */
const TICKS_PHONE_MAX = 6;
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

/**
 * Every step as a bar on one time axis: the typical part solid, its quick-to-slow range faint
 * around it, your own dates and today as marks. Words stay in the left column, one line a step.
 */
export function PlanTimeline({ steps, sideSteps, today }: { steps: PlanStep[]; sideSteps: PlanStep[]; today: string }) {
  const all = [...steps, ...sideSteps];
  const dates = all.flatMap((s) => [s.start.low, s.start.high, ...(s.end ? [s.end.low, s.end.high] : [])]).concat(today);
  const lo = Math.min(...dates.map(at));
  const hiKnown = Math.max(...dates.map(at));
  const hi = all.some((s) => !s.end) ? hiKnown + OPEN_END_DAYS * MS_PER_DAY : hiKnown;
  const pct = (iso: string) => ((at(iso) - lo) / Math.max(hi - lo, MS_PER_DAY)) * 100;
  const ticks = axisTicks(new Date(lo).toISOString().slice(0, 10), new Date(hi).toISOString().slice(0, 10));
  // On a phone every other month label is left out; the marks stay.
  const thin = ticks.length > TICKS_PHONE_MAX;

  const Bar = ({ s, thin }: { s: PlanStep; thin?: boolean }) => {
    const end = s.end;
    const from = pct(s.start.mid);
    const to = end ? pct(end.mid) : 100;
    const bandFrom = pct(s.start.low);
    const bandTo = end ? pct(end.high) : 100;
    const inset = thin ? "inset-y-0.5" : "inset-y-1.5";
    return (
      <div aria-hidden="true" className={cn("relative", thin ? "h-4" : "h-9")}>
        {ticks.map((t) => (
          <span key={t.iso} className={cn("absolute inset-y-0 w-px", t.year ? "bg-foreground/20" : "bg-foreground/[0.07]")} style={{ left: `${pct(t.iso)}%` }} />
        ))}
        <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${pct(today)}%` }} />
        {end && bandTo - bandFrom > to - from ? (
          <span className={cn("absolute opacity-40", inset, fillOf(s))} style={{ left: `${bandFrom}%`, width: `${Math.max(bandTo - bandFrom, MIN_BAR_PCT)}%` }} />
        ) : null}
        <span className={cn("absolute", inset, fillOf(s))} style={{ left: `${from}%`, width: `${Math.max(to - from, MIN_BAR_PCT)}%` }} />
        {s.known.start ? <Pin left={pct(s.start.mid)} /> : null}
        {s.known.end && end ? <Pin left={pct(end.mid)} /> : null}
      </div>
    );
  };

  return (
    <section aria-labelledby="plan-steps" className="mt-14">
      <h2 id="plan-steps" className="font-heading text-2xl font-bold">
        How long each step takes
      </h2>{" "}
      <div aria-hidden="true" className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[19rem_minmax(0,1fr)] [&>*]:min-w-0">
        <span className="hidden md:block" />{" "}
        <div className="relative h-6 text-sm tabular-nums text-soft">
          {ticks.map((t, i) =>
            Math.abs(pct(t.iso) - pct(today)) > TODAY_CLEARANCE_PCT ? (
              <Fragment key={t.iso}>
                <span
                  className={cn("absolute -translate-x-1/2 whitespace-nowrap", t.year && "font-semibold text-foreground", thin && i % 2 === 1 && !t.year && "max-md:hidden")}
                  style={{ left: `${pct(t.iso)}%` }}
                >
                  {t.label}
                </span>{" "}
              </Fragment>
            ) : null,
          )}
          <span className="absolute font-semibold text-foreground" style={{ left: `${pct(today)}%`, transform: `translateX(${pct(today) > 85 ? "-100%" : "-50%"})` }}>
            Today
          </span>
        </div>
      </div>{" "}
      <ol className="border-t-2 border-border">
        {steps.map((s, i) => (
          <li key={s.key} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b border-border py-3 md:grid-cols-[19rem_minmax(0,1fr)] [&>*]:min-w-0">
            <StepLabel s={s} n={i + 1} today={today} sides={s.key === "i485" ? sideSteps : []} />{" "}
            <div className="space-y-1">
              <Bar s={s} />
              {s.key === "i485" ? sideSteps.map((side) => <Bar key={side.key} s={side} thin />) : null}
            </div>{" "}
          </li>
        ))}
      </ol>{" "}
      <Legend steps={all} />
    </section>
  );
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The key: only what the chart above actually draws. */
function Legend({ steps }: { steps: PlanStep[] }) {
  const dated = steps.filter((s) => s.end);
  const items: { key: string; show: boolean; node: ReactNode }[] = [
    { key: "done", show: dated.some((s) => s.state === "done"), node: <Key className="bg-data-good-ink">Done</Key> },
    {
      key: "ahead",
      show: dated.some((s) => s.state !== "done" && s.key !== "visa"),
      node: <Key className="border-2 border-data-warn bg-chart-yellow">Still to come</Key>,
    },
    {
      key: "visa",
      show: dated.some((s) => s.state !== "done" && s.key === "visa"),
      node: <Key className="border-2 border-data-info-ink bg-chart-blue">Waiting for your date to be current</Key>,
    },
    {
      key: "range",
      show: dated.some((s) => s.start.low !== s.start.high || s.end!.low !== s.end!.high),
      node: <Key className="border-2 border-data-warn bg-chart-yellow opacity-40">Faint: as quick or as slow as it can run</Key>,
    },
    { key: "open", show: steps.some((s) => !s.end), node: <Key className="border-2 border-input bg-hatch">No date yet</Key> },
    {
      key: "pin",
      show: steps.some((s) => s.known.start || s.known.end),
      node: (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-4 w-1 bg-foreground" /> Your date
        </span>
      ),
    },
  ];
  return (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
      {items
        .filter((i) => i.show)
        .map((i) => (
          <Fragment key={i.key}>
            {i.node}{" "}
          </Fragment>
        ))}
    </p>
  );
}

/** The bold line under a step's name: how long it takes, or for the bulletin, when your date is current. */
function headline(s: PlanStep, today: string): string | null {
  if (!s.end) return null;
  if (s.key === "visa") return s.start.mid === s.end.mid ? "No wait" : `Current around ${dayLabel(s.end.mid, today)}`;
  const length = lengthLabel(s.start, s.end);
  return s.known.start && s.known.end ? `Took ${length}` : capitalize(length);
}

/** The quiet line under it: when the step runs. */
function when(s: PlanStep, today: string): string {
  if (!s.end) return `From ${dayLabel(s.start.mid, today, s.known.start)}, no date yet`;
  if (s.key === "visa") {
    return s.start.mid === s.end.mid ? "Your date is already current" : `${capitalize(lengthLabel(s.start, s.end))} after the I-140 is approved`;
  }
  if (s.state === "done") {
    return s.known.end
      ? `Done ${dayLabel(s.end.mid, today, true)}`
      : `Done, about ${dayLabel(s.start.mid, today, s.known.start)} to ${dayLabel(s.end.mid, today)}`;
  }
  return `${dayLabel(s.start.mid, today, s.known.start)} to ${dayLabel(s.end.mid, today)}`;
}

function Pin({ left }: { left: number }) {
  return <span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-foreground" style={{ left: `${left}%` }} />;
}

function StepLabel({ s, n, today, sides }: { s: PlanStep; n: number; today: string; sides: PlanStep[] }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className={cn("mt-2 grid size-8 shrink-0 place-items-center font-heading text-base font-bold", tileOf(s))}>
        {n}
      </span>{" "}
      <div className="min-w-0 leading-snug">
        <Link
          href={STEP_HREF[s.key]}
          className="group inline-flex min-h-11 items-center gap-1.5 font-heading text-xl font-bold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {s.name}{" "}
          <ArrowRightIcon aria-hidden="true" weight="bold" className="size-4 text-soft transition-transform motion-safe:group-hover:translate-x-0.5" />
        </Link>{" "}
        {headline(s, today) ? <p className={cn("text-lg font-bold tabular-nums", inkOf(s))}>{headline(s, today)}</p> : null}{" "}
        <p className="text-sm tabular-nums text-soft">{when(s, today)}</p>{" "}
        {sides.map((side) => (
          <p key={side.key} className="text-sm tabular-nums text-soft">
            {side.name}: {side.end ? dayLabel(side.end.mid, today) : "no measured wait"}{" "}
          </p>
        ))}
      </div>
    </div>
  );
}

function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-3", className)} /> {children}
    </span>
  );
}
