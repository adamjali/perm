import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { Tile } from "@/components/numbers/Tile";
import { WaitTrendChart } from "@/components/numbers/WaitTrendChart";
import { CatchingUp } from "@/components/pwd/CatchingUp";
import { PwdDateEstimate } from "@/components/pwd/PwdDateEstimate";
import { formatInt } from "@/lib/format";
import type { PwdDayData } from "@/lib/pwdDay";
import type { PwdLine } from "@/lib/pwdLine";
import { catchingUp, outcomeMix, yearOnYear, type PwdQueueDoc, type WaitTrend } from "@/lib/pwdNow";
import { longDate, monthDay, monthYear } from "@convex/lib/months";

/**
 * The wage-request page's board: the answers first, each a compact tile with
 * its picture (owner, Oct 31 2026: "visual first ... big important what they
 * want first, the rest there if they want it"). When might mine be decided,
 * is DOL keeping up, how long requests take month by month, how they end,
 * what DOL did each day, and the other wage queues DOL publishes. Every figure
 * names its source and day; a tile whose data didn't load is left out.
 */

const pct = (x: number | null) => (x === null ? null : `${(Math.round(x * 1000) / 10).toFixed(1).replace(/\.0$/, "")}%`);

export interface OtherQueue {
  program: string;
  month: string | null;
}

export function PwdNowBoard({
  line,
  dayData,
  queue,
  trend,
  dol,
  others,
}: {
  line: PwdLine | null;
  dayData: PwdDayData | null;
  queue: PwdQueueDoc | null;
  trend: WaitTrend | null;
  /** DOL's own table: the month and its date. */
  dol: { frontier: string | null; asOf: string | null };
  /** DOL's other wage queues (H-1B, H-2B, CW-1), the month each is on. */
  others: OtherQueue[];
}) {
  const flow = queue ? catchingUp(queue) : null;
  const mix = queue ? outcomeMix(queue) : null;
  const yoy = trend ? yearOnYear(trend) : null;
  const newest = trend ? [...trend.months].reverse().find((m) => !m.partial) : undefined;

  const dayCols: Column[] = (queue?.days ?? []).map((d) => {
    const split = d.issued !== undefined && d.withdrawn !== undefined;
    return {
      key: d.date,
      value: d.n,
      label: longDate(d.date) ?? d.date,
      tip: split
        ? `${monthDay(d.date)}\n${formatInt(d.issued ?? 0)} issued\n${formatInt(d.withdrawn ?? 0)} withdrawn${d.other ? `\n${formatInt(d.other)} other` : ""}${d.rfi ? `\n${formatInt(d.rfi)} RFIs asked` : ""}`
        : `${monthDay(d.date)}\n${formatInt(d.n)} left the line`,
      ...(split
        ? {
            parts: [
              { value: d.issued ?? 0, fill: "bg-chart-green border-data-good-ink" },
              { value: d.withdrawn ?? 0, fill: "bg-chart-purple border-data-purple-ink" },
              { value: d.other ?? 0, fill: "bg-muted-foreground/40 border-foreground" },
            ],
          }
        : {}),
    };
  });
  const rfis = (queue?.days ?? []).reduce((a, d) => a + (d.rfi ?? 0), 0);
  const hasRfis = (queue?.days ?? []).some((d) => d.rfi !== undefined);

  const mixRows = mix
    ? [
        { label: "Determination issued", n: mix.issued, fill: "bg-chart-green" },
        { label: "Withdrawn by the employer", n: mix.withdrawn, fill: "bg-chart-purple" },
        { label: "Returned or ended another way", n: mix.other, fill: "bg-muted-foreground/40" },
      ]
    : [];

  return (
    <section aria-labelledby="pwd-now-h" className="mt-10">
      <h2 id="pwd-now-h" className="font-heading text-2xl font-bold">
        Wage requests at DOL right now
      </h2>{" "}
      <div className="mt-5 grid grid-cols-1 gap-2 lg:grid-cols-12 [&>*]:min-w-0">
        {dayData ? (
          <Tile
            id="pwd-when"
            object
            className="lg:col-span-7"
            claim="When might mine be decided?"
            sub="Put in the day it was filed. No number needed."
          >
            <PwdDateEstimate data={dayData} lineDay={line?.day ?? null} filedByDay={queue?.filedByDay ?? []} />
          </Tile>
        ) : null}{" "}

        {flow ? (
          <Tile
            id="pwd-flow"
            className="lg:col-span-5"
            claim="Is DOL keeping up?"
            sub="Requests that left DOL's line against new ones filed."
            foot={`Our daily check of DOL's case status, ${longDate(queue!.asOf)}.`}
          >
            <CatchingUp day={flow.day} week={flow.week} noun="requests" />
          </Tile>
        ) : null}{" "}

        {trend && newest ? (
          <Tile
            id="pwd-wait"
            className="lg:col-span-7"
            figure={`${formatInt(newest.p50)} days`}
            claim={`How long requests DOL decided in ${monthYear(newest.m)} waited`}
            sub={
              yoy
                ? `The median, filing to determination. A year before, in ${monthYear(yoy.then.m)}: ${formatInt(yoy.then.p50)} days.`
                : "The median, filing to determination."
            }
            foot={`DOL's published wage-request files, through ${longDate(trend.filesThrough)}.${
              line ? ` Since then, by our check: requests filed ${longDate(line.day)} are being decided now.` : ""
            }`}
          >
            <WaitTrendChart
              trend={trend}
              noun="requests"
              label="Median days from filing to determination, by the month DOL decided"
            />
          </Tile>
        ) : null}{" "}

        {mix ? (
          <Tile
            id="pwd-end"
            className="lg:col-span-5"
            figure={pct(mix.issuedShare) ?? formatInt(mix.issued)}
            claim="of the requests that ended got a wage"
            sub={`Every PERM wage request filed since ${longDate(mix.filedSince)}: ${formatInt(mix.closed)} ended, ${formatInt(mix.waiting)} still waiting, ${formatInt(mix.rfi)} waiting on the employer's answer to an RFI.`}
            foot={`Our daily check of DOL's case status, ${longDate(queue!.asOf)}.`}
          >
            <div className="flex h-4 w-full overflow-hidden border-2 border-foreground" aria-hidden="true">
              {mixRows.map((r) =>
                r.n > 0 ? <div key={r.label} className={r.fill} style={{ width: `${(r.n / Math.max(1, mix.closed)) * 100}%` }} /> : null,
              )}
            </div>{" "}
            <dl className="mt-4 space-y-2">
              {mixRows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 text-base">
                  <dt className="flex items-center gap-2">
                    <span className={`inline-block size-3 border border-foreground ${r.fill}`} aria-hidden="true" />{" "}
                    {r.label}
                  </dt>{" "}
                  <dd className="tabular-nums">
                    {formatInt(r.n)}
                    {mix.closed > 0 ? <span className="text-muted-foreground"> · {pct(r.n / mix.closed)}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </Tile>
        ) : null}{" "}

        {dayCols.length > 1 ? (
          <Tile
            id="pwd-days"
            className="lg:col-span-7"
            claim="What DOL did each day"
            sub={`Requests that left the line each day, by what happened${hasRfis ? `; DOL also asked ${formatInt(rfis)} employers for more information` : ""}.`}
            foot={`Dated by the day DOL worked. Our daily check of DOL's case status, ${longDate(queue!.asOf)}.`}
          >
            <ColumnChart
              columns={dayCols}
              label="Wage requests that left DOL's line each day"
              first={monthDay(queue!.days[0]!.date) ?? ""}
              last={monthDay(queue!.days[queue!.days.length - 1]!.date) ?? ""}
              unit="requests"
            />
          </Tile>
        ) : null}{" "}

        {others.length > 0 || dol.frontier ? (
          <Tile
            id="pwd-queues"
            className="lg:col-span-5"
            claim="The month each of DOL's wage queues is on"
            sub="DOL's own table, by the visa the wage is for."
            foot={dol.asOf ? `DOL's processing-times page, as of ${dol.asOf}.` : "DOL's processing-times page."}
          >
            <dl className="space-y-2">
              {dol.frontier ? (
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <dt>PERM</dt>{" "}
                  <dd className="font-semibold">{dol.frontier}</dd>
                </div>
              ) : null}
              {others.map((q) => (
                <div key={q.program} className="flex items-baseline justify-between gap-3 text-base">
                  <dt>{q.program}</dt>{" "}
                  <dd className="font-semibold">{q.month ? monthYear(q.month) : "Not published"}</dd>
                </div>
              ))}
            </dl>
          </Tile>
        ) : null}
      </div>
    </section>
  );
}
