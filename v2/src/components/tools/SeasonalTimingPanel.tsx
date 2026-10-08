import type { TimingView } from "@/lib/seasonalTiming";

/**
 * When DOL usually decides a case like this one: a range bar drawn from DOL's
 * own certifications (scripts/build_seasonal_timing.py), the middle half
 * solid, the typical day marked, today placed on it, and for H-2A the day
 * 20 CFR 655.160 sets. Rendered only for a pending application with a
 * measured basis; the caller passes null otherwise and nothing is drawn.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function day(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Where a date falls on the early-to-late span, as a CSS percentage, clamped. */
function at(v: TimingView, iso: string): string {
  const n = (s: string) => Date.parse(`${s}T12:00:00Z`);
  const span = n(v.late) - n(v.early);
  const f = span > 0 ? (n(iso) - n(v.early)) / span : 0;
  return `${(Math.min(1, Math.max(0, f)) * 100).toFixed(2)}%`;
}

export function SeasonalTimingPanel({
  view,
  firstDay,
  filingDate,
  checked = null,
}: {
  view: TimingView;
  firstDay: string | null;
  filingDate: string | null;
  /** How this visa's method did on past seasons, from the weekly backtest. */
  checked?: { share: number; cases: number } | null;
}) {
  const start = view.basis === "start";
  const share = view.onTimeShare === null ? null : Math.round(view.onTimeShare * 100);
  return (
    <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6" aria-labelledby="seasonal-timing">
      <h3 id="seasonal-timing" className="font-heading text-xl font-black">
        When DOL usually decides
      </h3>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/85">
        {start
          ? `Half of the H-2A applications DOL certified were decided ${view.days.to} to ${view.days.from} days before the work began. For this job, starting ${firstDay ? day(firstDay) : "on its first day"}, that's `
          : `Half of the ${view.visa} applications DOL certified${view.season ? ` that were filed ${view.season}` : ""} were decided ${view.days.from} to ${view.days.to} days after filing. For this case${filingDate ? `, filed ${day(filingDate)}` : ""}, that's `}
        <span className="font-bold">
          {day(view.from)} to {day(view.to)}
        </span>
        , most often around {day(view.typical)}.
      </p>{" "}
      <div className="mt-5" aria-hidden="true">
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-3 h-2 border-2 border-border bg-muted" />{" "}
          <div
            className="absolute top-2 h-4 border-2 border-border bg-primary"
            style={{ left: at(view, view.from), width: `calc(${at(view, view.to)} - ${at(view, view.from)})` }}
          />{" "}
          <div className="absolute top-0 h-8 w-1 -translate-x-1/2 bg-foreground" style={{ left: at(view, view.typical) }} />{" "}
          {view.ruleDay ? (
            <div
              className="absolute top-0 h-8 w-0 -translate-x-1/2 border-l-2 border-dashed border-foreground"
              style={{ left: at(view, view.ruleDay) }}
            />
          ) : null}
        </div>{" "}
        <div className="relative mt-1 h-5 text-sm font-bold">
          <span className="absolute left-0">{shortDay(view.early)}</span>{" "}
          <span className="absolute right-0">{shortDay(view.late)}</span>
        </div>{" "}
        <div className="relative h-6 text-sm">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap border-2 border-border bg-background px-1 font-bold"
            style={{ left: `clamp(3.5rem, ${(view.todayAt * 100).toFixed(2)}%, calc(100% - 3.5rem))` }}
          >
            {/* Dated, because off either end of the bar the label is held at the edge. */}
            Today, {shortDay(view.today)}
          </span>
        </div>
      </div>{" "}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground/80">
        <li>
          <span className="mr-1 inline-block h-3 w-5 border-2 border-border bg-primary align-middle" /> Middle half
        </li>{" "}
        <li>
          <span className="mr-1 inline-block h-3 w-1 bg-foreground align-middle" /> Most often
        </li>{" "}
        {view.ruleDay ? (
          <li>
            <span className="mr-1 inline-block h-3 w-0 border-l-2 border-dashed border-foreground align-middle" /> 30 days
            before the work, the rule&apos;s deadline
          </li>
        ) : null}{" "}
        <li>Bar runs from 1 in 10 to 9 in 10 decided.</li>
      </ul>{" "}
      {view.pastMost ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/85">
          Three in four certified cases were decided by {day(view.to)}, so this one is taking longer than most.
        </p>
      ) : null}{" "}
      {share !== null && view.ruleDay ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/85">
          The rule has DOL decide by {day(view.ruleDay)}, 30 days before the work (
          <a href="https://www.ecfr.gov/current/title-20/chapter-V/part-655/section-655.160" className={LINK} rel="noopener">
            20 CFR 655.160
          </a>
          ), unless the application was modified; {share}% of the certifications met it.
        </p>
      ) : null}{" "}
      {checked ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/85">
          Tested on {checked.cases.toLocaleString("en-US")} later {view.visa} decisions,{" "}
          {Math.round(checked.share * 100)}% landed inside the middle half drawn this way. A perfect estimate puts half there.
        </p>
      ) : null}{" "}
      <p className="mt-4 text-sm text-foreground/70">
        From {view.n.toLocaleString("en-US")} certifications in DOL&apos;s published {view.visa} files
        {view.season
          ? `, filed ${view.season}. That's the same months a year before this case, because ${view.visa} decisions run on a seasonal clock`
          : view.decidedFrom && view.decidedTo
            ? `, decided ${day(view.decidedFrom)} to ${day(view.decidedTo)}`
            : ""}
        . An estimate from past cases, not a promise.
      </p>
    </section>
  );
}
