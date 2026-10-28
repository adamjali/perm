import Link from "next/link";
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
      <div aria-hidden="true" className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[17rem_minmax(0,1fr)] [&>*]:min-w-0">
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
        {steps.map((s) => (
          <li key={s.key} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b border-border py-3 md:grid-cols-[17rem_minmax(0,1fr)] [&>*]:min-w-0">
            <StepLabel s={s} today={today} sides={s.key === "i485" ? sideSteps : []} />{" "}
            <div className="space-y-1">
              <Bar s={s} />
              {s.key === "i485" ? sideSteps.map((side) => <Bar key={side.key} s={side} thin />) : null}
            </div>{" "}
          </li>
        ))}
      </ol>{" "}
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
        <Key className="bg-data-good-ink">Done</Key> <Key className="border-2 border-data-warn bg-chart-yellow">Typical</Key>{" "}
        <Key className="border-2 border-data-warn bg-chart-yellow opacity-40">Quick to slow</Key>{" "}
        <Key className="border-2 border-data-info-ink bg-chart-blue">Waiting for the bulletin</Key>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-4 w-1 bg-foreground" /> Your date
        </span>
      </p>
    </section>
  );
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Pin({ left }: { left: number }) {
  return <span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-foreground" style={{ left: `${left}%` }} />;
}

function StepLabel({ s, today, sides }: { s: PlanStep; today: string; sides: PlanStep[] }) {
  return (
    <div className="leading-snug">
      <Link href={STEP_HREF[s.key]} className="link inline-flex min-h-11 items-center font-semibold">
        {s.name}
      </Link>{" "}
      {s.end ? (
        <p className="text-lg font-bold tabular-nums">
          {s.known.end ? "Took " : ""}
          {s.known.end ? lengthLabel(s.start, s.end) : capitalize(lengthLabel(s.start, s.end))}
        </p>
      ) : null}{" "}
      <p className="text-sm tabular-nums text-soft">
        {s.end
          ? s.known.end
            ? `Done ${dayLabel(s.end.mid, today, true)}`
            : `${dayLabel(s.start.mid, today, s.known.start)} to ${dayLabel(s.end.mid, today)}`
          : `From ${dayLabel(s.start.mid, today, s.known.start)}, no date yet`}
      </p>{" "}
      {sides.map((side) => (
        <p key={side.key} className="text-sm tabular-nums text-soft">
          {side.name}: {side.end ? dayLabel(side.end.mid, today) : "no measured wait"}{" "}
        </p>
      ))}
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
