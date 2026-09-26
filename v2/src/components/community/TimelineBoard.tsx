import { Fragment } from "react";

import {
  CATEGORIES,
  COUNTRIES,
  DATE_FIELDS,
  METRIC_MIN_N,
  ROUTES,
  type BoardRow,
  type MetricResult,
  type RfeSummary,
} from "@/lib/communityTimeline";
import { cn } from "@/lib/utils";

/**
 * The visual half of the green card timelines page, server-rendered, no
 * client code. Three pieces: the stage medians (a bar per stage, the middle
 * half drawn and the median marked), the board (one row per shared timeline,
 * each a track of dots placed by days since PERM filing), and the RFE counts.
 *
 * EVERY NUMBER CARRIES ITS COUNT, and a stage below the minimum says so in
 * words instead of drawing a bar. A median over three self-reported dates is
 * an anecdote with a decimal point.
 */

const label = <T extends { id: string; label: string }>(list: readonly T[], id: string | null) =>
  id ? (list.find((x) => x.id === id)?.label ?? id) : null;

const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });

const days = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;

export function StageMedians({ metrics }: { metrics: readonly MetricResult[] }) {
  const measured = metrics.filter((m) => m.median !== null);
  // One scale for every bar, so two stages can be compared by eye. Rounded up
  // to a whole 60 days so the axis reads as chosen.
  const top = Math.max(120, ...measured.map((m) => m.p75 ?? 0));
  const span = Math.ceil(top / 60) * 60;
  const pct = (d: number) => `${Math.min(100, (d / span) * 100)}%`;

  return (
    <ul className="grid grid-cols-1 gap-3">
      {metrics.map((m) => (
        <Fragment key={m.id}>
          {" "}
          <li className="border-2 border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-heading text-base font-black">{m.label}</p>{" "}
              <p className="text-sm text-foreground/70">
                {m.verified ? "DOL's record" : "self-reported"}, {m.n.toLocaleString("en-US")}{" "}
                {m.n === 1 ? "timeline" : "timelines"}
              </p>
            </div>{" "}
            {m.median !== null && m.p25 !== null && m.p75 !== null ? (
              <>
                <div className="relative mt-3 h-6 border-2 border-border bg-background" aria-hidden="true">
                  <span
                    className={cn("absolute inset-y-0 border-x-2 border-border", m.verified ? "bg-primary/60" : "bg-primary/30")}
                    style={{ left: pct(m.p25), width: `calc(${pct(m.p75)} - ${pct(m.p25)})` }}
                  />{" "}
                  <span className="absolute inset-y-[-4px] w-1 bg-foreground" style={{ left: pct(m.median) }} />
                </div>{" "}
                <p className="mt-2 text-base">
                  <b>Median {days(m.median)}</b>,{" "}
                  <span className="text-foreground/70">
                    the middle half {m.p25.toLocaleString("en-US")} to {days(m.p75)}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-base text-foreground/70">
                Not enough timelines yet: a median needs {METRIC_MIN_N}, and this stage has {m.n}.
              </p>
            )}
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/** The stops a board row can show, in order, with a short name for the key. */
const STOPS = [
  { id: "permCertifiedOn", short: "PERM certified" },
  ...DATE_FIELDS.map((f) => ({ id: f.id as string, short: f.short as string })),
] as const;

/** Tones by stage family, drawn from the house palette only. */
const DOT: Record<string, string> = {
  permCertifiedOn: "bg-foreground",
  i140FiledOn: "bg-background",
  i140ApprovedOn: "bg-primary",
  i485FiledOn: "bg-background",
  eadOn: "bg-muted-foreground",
  apOn: "bg-muted-foreground",
  interviewOn: "bg-background",
  greenCardOn: "bg-primary",
};

export function BoardKey() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="What each mark means">
      {STOPS.map((s) => (
        <Fragment key={s.id}>
          {" "}
          <li className="inline-flex items-center gap-2">
            <span
              className={cn(
                "inline-block size-3 border-2 border-border",
                DOT[s.id],
                s.id === "greenCardOn" ? "rotate-45" : "rounded-full",
              )}
              aria-hidden="true"
            />{" "}
            {s.short}
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

export function BoardTable({ rows }: { rows: readonly BoardRow[] }) {
  const far = Math.max(365, ...rows.flatMap((r) => r.stops.map((s) => s.day ?? 0)));
  const span = Math.ceil(far / 90) * 90;
  const at = (d: number) => `${Math.max(0, Math.min(100, (d / span) * 100))}%`;
  return (
    <div className="overflow-x-auto border-2 border-border">
      <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-bold">PERM filed{" "}</th>
            <th scope="col" className="px-3 py-2 font-bold">Category{" "}</th>
            <th scope="col" className="px-3 py-2 font-bold">Country{" "}</th>
            <th scope="col" className="px-3 py-2 font-bold">Route{" "}</th>
            <th scope="col" className="w-[45%] px-3 py-2 font-bold">
              Days from PERM filing, 0 to {span.toLocaleString("en-US")}{" "}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const shown = r.stops.filter((s) => s.day !== null && s.day >= 0);
            const words = shown.map((s) => `${STOPS.find((x) => x.id === s.id)?.short ?? s.id} day ${s.day}`).join(", ");
            return (
              <tr key={`${r.filedMonth}-${i}`} className="border-t-2 border-border/40 align-middle">
                <td className="px-3 py-3 tabular-nums">
                  {r.filedMonth ? monthName(r.filedMonth) : "Not found at DOL"}
                  {r.permVerified ? null : (
                    <span className="block text-foreground/70">PERM dates not checked yet</span>
                  )}{" "}
                </td>
                <td className="px-3 py-3">{label(CATEGORIES, r.category) ?? ""}{" "}</td>
                <td className="px-3 py-3">{label(COUNTRIES, r.country) ?? ""}{" "}</td>
                <td className="px-3 py-3">
                  {r.route ? (label(ROUTES, r.route) ?? "").replace(/ \(.*\)$/, "") : ""}
                  {r.premium ? <span className="block text-foreground/70">premium I-140</span> : null}{" "}
                </td>
                <td className="px-3 py-3">
                  <div className="relative h-5" role="img" aria-label={words || "No dated steps yet"}>
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border/50" aria-hidden="true" />
                    {shown.map((s) => (
                      <span
                        key={s.id}
                        title={`${STOPS.find((x) => x.id === s.id)?.short ?? s.id}: day ${s.day}${s.month ? `, ${monthName(s.month)}` : ""}`}
                        className={cn(
                          "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 border-2 border-border",
                          DOT[s.id],
                          s.id === "greenCardOn" ? "rotate-45" : "rounded-full",
                        )}
                        style={{ left: at(s.day as number) }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {r.rfe ? (
                    <span className="mt-1 block text-foreground/70">
                      RFE on the {r.rfe.form === "i140" ? "I-140" : "I-485"}
                      {r.rfe.outcome === "approved" ? ", approved after it" : r.rfe.outcome === "denied" ? ", denied" : ""}{" "}
                    </span>
                  ) : null}{" "}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RfeBars({ rfe }: { rfe: RfeSummary }) {
  if (rfe.total === 0) {
    return <p className="text-base text-foreground/70">Nobody has reported an RFE yet.</p>;
  }
  const most = Math.max(...rfe.byReason.map((r) => r.count), 1);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
      <ul className="grid grid-cols-1 gap-2">
        {rfe.byReason.map((r) => (
          <Fragment key={r.id}>
            {" "}
            <li className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="font-bold">{r.label}</span>{" "}
              <span className="h-4 border-2 border-border bg-background" aria-hidden="true">
                <span className="block h-full bg-primary/50" style={{ width: `${(r.count / most) * 100}%` }} />
              </span>{" "}
              <span className="tabular-nums">{r.count}</span>
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <dl className="grid grid-cols-1 gap-2 self-start border-2 border-border bg-card p-4 text-sm">
        {rfe.byForm.map((f) => (
          <Fragment key={f.id}>
            {" "}
            <div className="flex justify-between gap-4">
              <dt>RFEs on the {f.label}</dt>{" "}
              <dd className="font-bold tabular-nums">{f.count}</dd>
            </div>
          </Fragment>
        ))}{" "}
        {rfe.byOutcome.map((o) => (
          <Fragment key={o.id}>
            {" "}
            <div className="flex justify-between gap-4 border-t border-border/40 pt-2">
              <dt>{o.label}</dt>{" "}
              <dd className="font-bold tabular-nums">{o.count}</dd>
            </div>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
