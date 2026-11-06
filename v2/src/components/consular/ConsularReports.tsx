import { ChatsCircleIcon, ClockCountdownIcon, HourglassMediumIcon } from "@phosphor-icons/react/ssr";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { NoteBanner } from "@/components/ui/note";
import { MIN_REPORTS, REPORT_WEEKS, SELF_REPORTED, type ReportCategoryCell, type ReportCount, type ReportView } from "@/lib/consularReport";
import { formatInt, formatShareOf } from "@/lib/format";
import { shortDate } from "@convex/lib/months";

import { ConsularReportForm } from "./ConsularReportForm";

/**
 * "What people report": interviews at one consulate, as the people who went report them
 * (convex/consularReports.ts), with the form to add one.
 *
 * SELF-REPORTED, AND SAID SO AT EVERY FIGURE. State publishes its scheduling month and, months late, its
 * issuances; nothing about last week's interviews. These figures fill that gap from visitors, so every one
 * is labelled as theirs and never set as State's.
 *
 * THE FLOOR IS THE QUERY'S. `forPost` returns every figure under three reports already empty or null, so this
 * component only says "too few reports yet" where the query sent nothing; it can't print a cell by mistake.
 */

const TOO_FEW = "Too few reports yet";

const OUTCOME_TONE: Record<string, BarRow["tone"]> = {
  approved: "green",
  issued: "green",
  "passport-returned": "green",
  waiting: "yellow",
  "221g": "yellow",
  rescheduled: "yellow",
  refused: "blue",
  cancelled: "blue",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}

/** Each outcome as it reads inside a sentence. */
const OUTCOME_SHORT: Record<string, string> = {
  waiting: "with no result yet",
  approved: "approved",
  issued: "issued",
  "passport-returned": "with the passport back",
  "221g": "in 221(g)",
  refused: "refused",
  cancelled: "cancelled",
  rescheduled: "rescheduled",
};

/** "2 EB-2, 1 EB-3": the exact categories people gave, in one line. */
function countLine(counts: readonly ReportCount[]): string {
  return counts.map((c) => `${formatInt(c.count)} ${c.label}`).join(", ");
}

/** "2 issued, 1 in 221(g)": a cell's outcomes in one line. */
function outcomeLine(counts: readonly ReportCount[]): string {
  return counts.map((c) => `${formatInt(c.count)} ${OUTCOME_SHORT[c.id] ?? c.label.toLowerCase()}`).join(", ");
}

function outcomeRows(counts: readonly ReportCount[], total: number): BarRow[] {
  return counts.map((c) => ({
    key: c.id,
    label: c.label,
    value: c.count,
    text: formatInt(c.count),
    tone: OUTCOME_TONE[c.id] ?? "blue",
    tip: `${c.label}\n${plural(c.count, "report")} of ${formatInt(total)}\n${SELF_REPORTED}`,
  }));
}

function weekColumns(view: ReportView): Column[] {
  const last = view.weeks.length - 1;
  return view.weeks.map((w, i) => ({
    key: w.start,
    value: w.count ?? 0,
    gap: w.count === null,
    now: i === last,
    partial: w.partial,
    label: `Week of ${shortDate(w.start) ?? w.start}`,
    tip:
      w.count === null
        ? `Week of ${shortDate(w.start)}\n${TOO_FEW}`
        : `Week of ${shortDate(w.start)}\n${plural(w.count, "interview")} reported held${w.partial ? ", the week still filling" : ""}\n${SELF_REPORTED}`,
  }));
}

/**
 * One kind of visa after its appointments: the median days to the approval or the visa, and the count still
 * waiting beside it. The query sends the median only with the waiting count, never alone.
 */
function afterRow(c: ReportCategoryCell): BarRow {
  const a = c.after;
  if (a.finished === null || a.waiting === null) {
    return { key: c.id, label: c.label, value: null, nullText: TOO_FEW, text: TOO_FEW, tone: "green" };
  }
  const counts = `${formatInt(a.finished)} finished, ${formatInt(a.waiting)} still waiting`;
  return {
    key: c.id,
    label: c.label,
    sub: counts,
    value: a.median,
    nullText: "Too few finished yet",
    text: a.median !== null ? plural(a.median, "day") : "Too few finished yet",
    tone: "green",
    tip: `${c.label}\n${a.median !== null ? `Median ${plural(a.median, "day")} to the approval or the visa` : "Too few finished yet"}\n${counts}\n${SELF_REPORTED}`,
  };
}

/** The 221(g) share, as a figure. */
function shareValue(r: ReportView["results"]): string | null {
  return r.n !== null && r.g221 !== null ? formatShareOf(r.g221, r.n) : null;
}

export function ConsularReports({
  name,
  post,
  view,
  all,
  className,
}: {
  name: string;
  /** The consulate page's slug: what the form saves under. */
  post: string;
  /** This consulate's figures; null when they couldn't be read. */
  view: ReportView | null;
  /** Every consulate's figures together, for comparison; null when they couldn't be read. */
  all: ReportView | null;
  className?: string;
}) {
  const w30 = view?.windows.find((w) => w.days === 30);
  const w90 = view?.windows.find((w) => w.days === 90);
  const share = view ? shareValue(view.results) : null;
  const allShare = all ? shareValue(all.results) : null;
  const weeks = view ? weekColumns(view) : [];
  const anyWeek = view?.weeks.some((w) => w.count !== null) ?? false;
  // A breakdown lists the kinds of visa past the floor, and says in one line that the rest have too few.
  const openKinds = view?.categories.filter((c) => c.open) ?? [];
  const afterKinds = view?.categories.filter((c) => c.after.finished !== null) ?? [];

  return (
    <section id="reports" aria-labelledby="reports-h" className={className}>
      <h2 id="reports-h" className="flex items-center gap-2 font-heading text-2xl font-bold sm:text-3xl">
        <ChatsCircleIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" /> What people report
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        What people who had an appointment in {name} report, for any visa. {SELF_REPORTED}; a figure shows once{" "}
        {MIN_REPORTS} people have reported.
      </p>

      {view && w30 && w90 ? (
        <>
          <FigureRow className="mt-6">
            <Figure
              icon={<ChatsCircleIcon weight="bold" />}
              label="Reports, last 30 days"
              value={formatInt(w30.total)}
              note={`${formatInt(w90.total)} in the last 90 days, every kind of visa. ${SELF_REPORTED}.`}
            />{" "}
            <Figure
              icon={<HourglassMediumIcon weight="bold" />}
              label="Ended in 221(g)"
              value={share ?? "Not yet"}
              note={
                share !== null
                  ? `${formatInt(view.results.g221!)} of ${plural(view.results.n!, "interview")} with a result, last ${view.results.days} days${allShare ? `. Every consulate: ${allShare}` : ""}. ${SELF_REPORTED}.`
                  : `${TOO_FEW}: it shows once ${MIN_REPORTS} people report a result. ${SELF_REPORTED}.`
              }
            />{" "}
            <Figure
              icon={<ClockCountdownIcon weight="bold" />}
              label="NVC complete to interview"
              value={view.wait.median !== null ? `${formatInt(view.wait.median)} days` : "Not yet"}
              note={
                view.wait.median !== null
                  ? `Median of ${plural(view.wait.n!, "immigrant visa interview")} in the last six months, from the middle of NVC's month${all && all.wait.median !== null ? `. Every consulate: ${formatInt(all.wait.median)} days` : ""}. ${SELF_REPORTED}.`
                  : `${TOO_FEW}: it shows once ${MIN_REPORTS} people give both dates. ${SELF_REPORTED}.`
              }
            />
          </FigureRow>

          <FigurePlate
            title="Interviews held, week by week"
            subject={`The last ${REPORT_WEEKS} weeks, every kind of visa`}
            caption={`Each column is a week of interviews people reported held; cancelled and moved interviews and drop boxes are left out. The newest is lime and hatched while it's still filling. A dashed outline is a week with fewer than ${MIN_REPORTS} reports.`}
            source={`${SELF_REPORTED}.`}
            className="mt-10"
          >
            {anyWeek ? (
              <ColumnChart
                columns={weeks}
                label={`Interviews people reported held in ${name}, week by week`}
                first={shortDate(view.weeks[0]!.start) ?? ""}
                last={shortDate(view.weeks.at(-1)!.start) ?? ""}
                unit="interviews"
                gapKey={TOO_FEW}
              />
            ) : (
              <p className="text-base text-muted-foreground">
                {TOO_FEW}: no week in the last {REPORT_WEEKS} has {MIN_REPORTS} interviews reported.
              </p>
            )}
          </FigurePlate>

          <FigurePlate
            title="How reports ended"
            subject="The last 30 and 90 days, every kind of visa"
            caption="Each report counts on the day of its newest step: the visa, the approval, the interview or the letter. A 221(g) that later cleared still counts as a 221(g)."
            source={`${SELF_REPORTED}.`}
            className="mt-10"
          >
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 [&>*]:min-w-0">
              {[w30, w90].map((w) => (
                <div key={w.days}>
                  {" "}
                  <p className="font-heading text-lg font-bold">Last {w.days} days</p>{" "}
                  {w.open ? (
                    <BarRows
                      className="mt-3"
                      rows={outcomeRows(w.byOutcome, w.total)}
                      label={`How reports from ${name} ended in the last ${w.days} days`}
                    />
                  ) : (
                    <p className="mt-3 text-base text-muted-foreground">
                      {TOO_FEW}: {plural(w.total, "report")} so far. This shows once {MIN_REPORTS} people have reported.
                    </p>
                  )}
                </div>
              ))}
            </div>
            {view.moved.n !== null && view.moved.byWho.length ? (
              <p className="mt-6 text-base">
                Of {plural(view.moved.n, "interview")} cancelled or moved in the last {view.moved.days} days,{" "}
                {view.moved.byWho.map((c) => `${formatInt(c.count)} by ${c.id === "me" ? "the applicant" : "the consulate"}`).join(" and ")}
                {view.moved.byWho.reduce((t, c) => t + c.count, 0) < view.moved.n ? "; the rest didn't say" : ""}.
              </p>
            ) : null}
          </FigurePlate>

          {view.results.holdReasons.length ? (
            <FigurePlate
              title="Why the 221(g)"
              subject={`Interviews that ended in 221(g), last ${view.results.days} days`}
              caption={`What the officer said, as the people who got a 221(g) report it. It shows once ${MIN_REPORTS} people report a 221(g); a report that didn't say isn't counted.`}
              source={`${SELF_REPORTED}.`}
              className="mt-10"
            >
              <BarRows
                inline
                rows={view.results.holdReasons.map((c) => ({
                  key: c.id,
                  label: c.label,
                  value: c.count,
                  text: plural(c.count, "report"),
                  tone: c.id === "public-charge" ? "blue" : "yellow",
                  tip: `${c.label}\n${plural(c.count, "report")} of ${formatInt(view.results.g221!)} 221(g)\n${SELF_REPORTED}`,
                }))}
                label={`Why interviews in ${name} ended in 221(g), last ${view.results.days} days`}
              />
            </FigurePlate>
          ) : null}

          <FigurePlate
            title="By kind of visa"
            subject="The last 90 days"
            caption={`Employment and the work visas first. A kind of visa shows once ${MIN_REPORTS} people have reported one, so no row is one person's outcome.`}
            source={`${SELF_REPORTED}.`}
            className="mt-10"
          >
            {openKinds.length ? (
              <BarRows
                inline
                rows={openKinds.map((c) => ({
                  key: c.id,
                  label: c.label,
                  value: c.count,
                  text: plural(c.count ?? 0, "report"),
                  sub: [
                    outcomeLine(c.byOutcome),
                    c.byLine.length ? `By category: ${countLine(c.byLine)}` : null,
                    c.waitMedian !== null ? `NVC to interview: ${formatInt(c.waitMedian)} days` : null,
                  ]
                    .filter(Boolean)
                    .join(". "),
                  tone: "primary",
                }))}
                label={`Reports from ${name} by kind of visa, last 90 days`}
              />
            ) : null}
            {openKinds.length < view.categories.length ? (
              <p className={openKinds.length ? "mt-4 text-base text-muted-foreground" : "text-base text-muted-foreground"}>
                {openKinds.length
                  ? `${TOO_FEW} for every other kind of visa.`
                  : `${TOO_FEW} for any kind of visa: each shows once ${MIN_REPORTS} people have reported one.`}
              </p>
            ) : null}
          </FigurePlate>

          <FigurePlate
            title="From the interview to the visa"
            subject="Appointments in the last six months"
            caption={`Days from the interview or the drop box to the approval or the visa, the median of the reports that finished, always beside the count still waiting: a median of the finished alone looks quicker than the wait is. A row shows once ${MIN_REPORTS} people have reported an appointment, and its median once ${MIN_REPORTS} have finished.`}
            source={`${SELF_REPORTED}.`}
            className="mt-10"
          >
            {afterKinds.length ? (
              <BarRows
                inline
                rows={afterKinds.map((c) => afterRow(c))}
                label={`Days from the interview to the visa in ${name}, by kind of visa`}
              />
            ) : null}
            {afterKinds.length < view.categories.length ? (
              <p className={afterKinds.length ? "mt-4 text-base text-muted-foreground" : "text-base text-muted-foreground"}>
                {afterKinds.length
                  ? `${TOO_FEW} for every other kind of visa.`
                  : `${TOO_FEW} for any kind of visa: each shows once ${MIN_REPORTS} people have reported an appointment.`}
              </p>
            ) : null}
          </FigurePlate>
        </>
      ) : (
        <NoteBanner alert className="mt-6 max-w-2xl">
          <p>The reports can&apos;t be read right now. Try again in a few minutes.</p>
        </NoteBanner>
      )}

      <ConsularReportForm post={post} name={name} className="mt-10" />

      <FinePrint summary="What these reports can't tell you" className="mt-8">
        <div className="max-w-3xl space-y-3 text-base leading-relaxed">
          <p>
            <b>They aren&apos;t a sample of everyone.</b> People with a 221(g) or a refusal are likelier to say so than
            people whose visa came the next week. A share here is what the people who reported saw. It isn&apos;t the
            post&apos;s rate.
          </p>{" "}
          <p>
            <b>Nobody can check them.</b> There&apos;s no case number, by design, so a report can&apos;t be tied to a
            case. State&apos;s own figures for this consulate are above this section.
          </p>
        </div>
      </FinePrint>
    </section>
  );
}
