import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt } from "@/lib/format";
import { MONTH_ABBR, shortDate } from "@convex/lib/months";
import { settlementMoney, shortName, type EnforcementAction, type EnforcementProgram } from "@/lib/enforcement/actions";
import { dodge, reach } from "@/lib/enforcement/dodge";

/**
 * Every settlement on one time line, a lane per visa program, each a square as big as the money it moved
 * (civil penalty plus back pay, by area). Hover or tap a square for its company, day and amounts. The lanes
 * say at a glance what changed: H-1B job ads first, then PERM recruitment from August 2026.
 */

export const PROGRAM_LANES: readonly { program: EnforcementProgram; label: string; fill: string }[] = [
  { program: "PERM", label: "PERM recruitment", fill: "bg-chart-green" },
  { program: "H-1B", label: "H-1B-only job ads", fill: "bg-chart-blue" },
  { program: "temporary visas", label: "Other visa-only ads", fill: "bg-chart-purple" },
  { program: "H-2A", label: "H-2A job orders", fill: "bg-chart-orange" },
];

const MIN = 14;
const MAX = 44;

const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
};
const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

const money = (n: number) => `$${formatInt(n)}`;

export function EnforcementTimeline({ actions, today }: { actions: readonly EnforcementAction[]; today: string }) {
  const settled = actions.filter((a) => a.kind === "settlement");
  if (!settled.length) return null;
  // From the first of the first settlement's month to the end of today's month.
  const start = `${settled[0]!.date.slice(0, 7)}-01`;
  const endMonth = today.slice(0, 7);
  const months = monthsBetween(start.slice(0, 7), endMonth) + 1;
  const [ey, em] = endMonth.split("-").map(Number) as [number, number];
  const end = new Date(Date.UTC(ey, em, 1)).toISOString().slice(0, 10);
  const span = dayNumber(end) - dayNumber(start);
  const x = (iso: string) => ((dayNumber(iso) - dayNumber(start)) / span) * 100;
  const biggest = Math.max(1, ...settled.map(settlementMoney));
  const size = (a: EnforcementAction) => MIN + (MAX - MIN) * Math.sqrt(settlementMoney(a) / biggest);
  const lanes = PROGRAM_LANES.filter((l) => settled.some((a) => a.program === l.program));
  // The PERM settlements are few and the story: each is named beside its square.
  const named = (program: EnforcementProgram) => program === "PERM";

  return (
    <figure className="mt-6">
      <ChartTips label="Settlements by day and program, sized by money" scroll="overflow-x-auto pb-2" startAtEnd>
        <div className="min-w-[680px]" role="group" aria-label={`${settled.length} settlements from ${shortDate(settled[0]!.date)} to ${shortDate(settled[settled.length - 1]!.date)}, by program`}>
          {lanes.map((lane) => (
            <div key={lane.program} className="grid grid-cols-[9.5rem_1fr] items-center border-b border-border/60">
              <p className="pr-3 text-sm font-bold leading-tight">
                <span className={`mr-2 inline-block size-3 align-middle ${lane.fill}`} aria-hidden="true" />
                {lane.label}
              </p>{" "}
              <LaneMarks
                marks={settled.filter((a) => a.program === lane.program)}
                fill={lane.fill}
                named={named(lane.program)}
                x={x}
                size={size}
              />
            </div>
          ))}
          <div className="grid grid-cols-[9.5rem_1fr]" aria-hidden="true">
            <span />
            <div className="relative mx-6 h-12">
              {Array.from({ length: months }, (_, i) => {
                const d = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 + i, 1));
                const iso = d.toISOString().slice(0, 10);
                const m = d.getUTCMonth();
                return (
                  <Fragment key={iso}>
                    {i % 2 === 0 ? (
                      <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-sm tabular-nums text-muted-foreground" style={{ left: `${x(iso)}%` }}>
                        {MONTH_ABBR[m]}{" "}
                      </span>
                    ) : null}
                    {m === 0 || i === 0 ? (
                      <span className="absolute top-6 whitespace-nowrap border-l-2 border-input pl-1 text-sm font-semibold tabular-nums" style={{ left: `${x(iso)}%` }}>
                        {d.getUTCFullYear()}{" "}
                      </span>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </ChartTips>{" "}
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Each square is one settlement, as large as its civil penalty and back pay together. The ringed square
        is Cloudera, the one that agreed to stop filing PERM.
      </figcaption>
    </figure>
  );
}

/**
 * One lane's squares. Squares that would touch are pulled apart above and below the line (`dodge`), the
 * biggest drawn first so a smaller one stays in view, and a named lane prints each company beside its square,
 * on the side away from the line. The lane is as tall as its squares and labels need.
 */
function LaneMarks({
  marks,
  fill,
  named,
  x,
  size,
}: {
  marks: readonly EnforcementAction[];
  fill: string;
  named: boolean;
  x: (iso: string) => number;
  size: (a: EnforcementAction) => number;
}) {
  const geometry = marks.map((a) => ({ id: a.id, x: x(a.date), size: size(a) }));
  const offsets = dodge(geometry);
  const label = named ? 28 : 0;
  const height = Math.max(64, Math.ceil(2 * (reach(geometry, offsets) + 6 + label)));
  let alternate = 0;
  return (
    <div className="relative mx-6" style={{ height }}>
      {[...marks]
        .sort((p, q) => settlementMoney(q) - settlementMoney(p))
        .map((a) => {
          const s = size(a);
          const dy = offsets.get(a.id) ?? 0;
          const side = dy < 0 ? "above" : dy > 0 ? "below" : alternate++ % 2 === 0 ? "above" : "below";
          const tip = [
            a.company,
            shortDate(a.date),
            a.civilPenalty ? `Civil penalty ${money(a.civilPenalty)}` : null,
            a.backPay ? `${a.backPayIsFund ? "Fund" : "Back pay"} ${money(a.backPay)}` : null,
            a.bar?.months ? `Agreed to file no PERM for ${a.bar.months} months` : null,
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <Fragment key={a.id}>
              <span
                data-tip={tip}
                className={`absolute -translate-x-1/2 -translate-y-1/2 border-2 border-foreground ${fill} ${a.bar ? "outline outline-2 outline-offset-2 outline-foreground" : ""}`}
                style={{ left: `${x(a.date)}%`, top: `calc(50% + ${dy}px)`, width: s, height: s }}
              />
              {named ? (
                <span
                  aria-hidden="true"
                  className="absolute -translate-x-1/2 whitespace-nowrap text-sm font-semibold"
                  style={{
                    left: `${x(a.date)}%`,
                    ...(side === "above"
                      ? { bottom: `calc(50% - ${dy}px + ${s / 2 + 6}px)` }
                      : { top: `calc(50% + ${dy}px + ${s / 2 + 6}px)` }),
                  }}
                >
                  {shortName(a.company)}{" "}
                </span>
              ) : null}
            </Fragment>
          );
        })}
    </div>
  );
}
