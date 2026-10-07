"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";

import { EASTERN_TIMEZONE } from "@/lib/time";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { api } from "@convex/_generated/api";
import { HORIZONS, type Cell, type HeadToHead, type Summary } from "@/lib/scorecard/score";
import {
  GRADE_SCALE,
  gradedMiss,
  letterFor,
  readMethods,
  readOurs,
  readRival,
  sourceName,
  type RivalReading,
} from "@/lib/scorecard/verdict";

/**
 * The private competitor scorecard: our daily sample against the same cases
 * as the rivals predicted them, graded the same way. Rivals are letters here
 * and everywhere in this repository. Rival C is never called: its published
 * method is re-run on our own data, and the panel says so.
 *
 * VERDICTS FIRST, FIGURES FOLDED (Oct 7 2026). Ten columns of figures read as
 * "Rival A beats us 8 to 4" with nothing to say whether that was a real lead
 * or luck. The panel now opens with the sentences `scorecard/verdict.ts`
 * writes, a strip of one square per judged case, and a letter per source;
 * every figure is still here, under "Every figure".
 */

interface Doc {
  perm: Summary;
  headToHead?: Record<string, HeadToHead>;
  readings?: { ours: string[]; rivals: RivalReading[] };
}

const days = (x: number | null | undefined) => (x == null ? "-" : `${formatInt(Math.round(x))}d`);
const pct = (x: number | null) => (x === null ? "-" : `${Math.round(x * 100)}%`);

/** "6 days late", "1 day early", "on time": which way a source's dates lean. */
function leans(bias: number | null): string {
  if (bias === null) return "-";
  const n = Math.round(Math.abs(bias));
  if (n < 2) return "on time";
  return `${n} days ${bias < 0 ? "late" : "early"}`;
}

/** One square per judged case: who was closer, at a glance. */
function CaseStrip({ name, won, lost, ties }: { name: string; won: number; lost: number; ties: number }) {
  const total = won + lost + ties;
  if (total === 0) return null;
  const label = `We were closer on ${won}, ${name} on ${lost}${ties ? `, ${ties} tied` : ""}.`;
  // Past 80 cases a square each stops being readable; draw shares instead.
  if (total > 80) {
    return (
      <div role="img" aria-label={label} className="mt-3 flex h-6 w-full max-w-md border-2 border-border">
        <span className="bg-primary" style={{ width: `${(won / total) * 100}%` }} />
        <span className="bg-muted" style={{ width: `${(ties / total) * 100}%` }} />
        <span className="bg-data-bad-ink" style={{ width: `${(lost / total) * 100}%` }} />
      </div>
    );
  }
  const squares = [
    ...Array.from({ length: won }, () => "bg-primary"),
    ...Array.from({ length: ties }, () => "bg-muted"),
    ...Array.from({ length: lost }, () => "bg-data-bad-ink"),
  ];
  return (
    <div role="img" aria-label={label} className="mt-3 flex max-w-md flex-wrap gap-1">
      {squares.map((c, i) => (
        <span key={i} className={cn("size-4 border-2 border-border", c)} />
      ))}
    </div>
  );
}

const MARK: Record<RivalReading["leader"], string> = {
  ours: "bg-primary",
  rival: "bg-data-bad-ink",
  even: "bg-muted",
  none: "bg-muted",
};

function RivalCard({ r, h }: { r: RivalReading; h: HeadToHead | undefined }) {
  return (
    <article className="border-2 border-border bg-background p-4 sm:p-5">
      <h3 className="flex items-start gap-2 font-heading text-lg font-black leading-snug">
        <span aria-hidden="true" className={cn("mt-1.5 size-3 shrink-0 border-2 border-border", MARK[r.leader])} />
        <span>{r.headline}</span>
      </h3>{" "}
      {h ? <CaseStrip name={r.name} won={h.oursCloser} lost={h.rivalCloser} ties={h.ties} /> : null}{" "}
      <ul className="mt-3 space-y-1.5 text-base leading-relaxed text-foreground/85">
        {r.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {r.source === "rival-c" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Rival C is never asked: its published method is run on our own data.
        </p>
      ) : null}
    </article>
  );
}

function GradeRow({ name, c }: { name: string; c: Cell }) {
  const grade = letterFor(gradedMiss(c));
  return (
    <tr className="border-t-2 border-border">
      <th scope="row" className="px-3 py-2 text-left font-bold">{`${sourceName(name)} `}</th>
      <td className="px-3 py-2 text-center">
        {grade ? (
          <span className="inline-flex size-8 items-center justify-center border-2 border-border bg-card font-heading text-lg font-black">
            {grade}
          </span>
        ) : (
          "-"
        )}{" "}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{`${days(gradedMiss(c))} `}</td>
      <td className="px-3 py-2 text-right tabular-nums">{`${leans(c.biasAtLeastDays ?? c.biasDays)} `}</td>
      <td className="px-3 py-2 text-right tabular-nums">{`${pct(c.within14Share)} `}</td>
      <td className="px-3 py-2 text-right tabular-nums">{`${formatInt(c.overdue ?? 0)} `}</td>
      <td className="px-3 py-2 text-right tabular-nums">{`${formatInt(c.graded)} of ${formatInt(c.recorded)} `}</td>
    </tr>
  );
}

export function ScorecardPanel() {
  const load = useAction(api.adminScorecard.get);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "empty" }
    | { kind: "error"; message: string }
    | { kind: "ready"; doc: Doc; computedAt: number }
  >({ kind: "loading" });

  useEffect(() => {
    let live = true;
    load({})
      .then((r) => {
        if (!live) return;
        if (!r) return setState({ kind: "empty" });
        setState({ kind: "ready", doc: JSON.parse(r.json) as Doc, computedAt: r.computedAt });
      })
      .catch((e: unknown) => live && setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [load]);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">Loading the scorecard...</p>;
  if (state.kind === "error") return <p className="text-sm text-destructive">{state.message}</p>;
  if (state.kind === "empty") {
    return (
      <p className="text-base text-muted-foreground">
        Nothing recorded yet. The first run is the morning after the deploy (8 AM Eastern).
      </p>
    );
  }
  const { doc, computedAt } = state;
  const perm = doc.perm;
  // headToHead arrived Oct 3 2026 and readings Oct 7; an older doc has neither.
  const h2h = doc.headToHead ?? {};
  const mine = perm.bySource.ours;
  const rivals = doc.readings?.rivals ?? Object.entries(h2h).map(([s, h]) => readRival(s, h));
  const ours =
    doc.readings?.ours ??
    (mine ? [...readOurs(mine.all, mine.byHorizon, perm.since, null), ...readMethods(mine.byModel)] : []);
  const sources = Object.keys(perm.bySource).sort((a, b) => (a === "ours" ? -1 : b === "ours" ? 1 : a < b ? -1 : 1));
  const when = new Date(computedAt).toLocaleString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        PERM, recorded daily since {perm.since ?? "-"}. Updated {when} ET.
      </p>

      <section aria-labelledby="sc-who" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="sc-who" className="font-heading text-xl font-black">Who&apos;s closer, on the same cases</h2>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Each square is one case we both dated: green, we were closer; red, they were; grey, tied.
        </p>{" "}
        {rivals.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">No shared cases yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            {rivals.map((r) => (
              <RivalCard key={r.source} r={r} h={h2h[r.source]} />
            ))}
          </div>
        )}
      </section>{" "}

      {ours.length > 0 ? (
        <section aria-labelledby="sc-ours" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
          <h2 id="sc-ours" className="font-heading text-xl font-black">What our own numbers say</h2>{" "}
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/85">
            {ours.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}{" "}

      <section aria-labelledby="sc-grades" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="sc-grades" className="font-heading text-xl font-black">Grades so far</h2>{" "}
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every source on its own sample. The grade is the typical miss, counting a case still waiting past its date at
          the days it&apos;s already late: {GRADE_SCALE}. &ldquo;Late&rdquo; means DOL decided before the date given.
        </p>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">{"Who "}</th>
                <th scope="col" className="px-3 py-2 text-center font-bold">{"Grade "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Typical miss "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Dates run "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Within 2 weeks "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Late, still waiting "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Graded "}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <GradeRow key={s} name={s} c={perm.bySource[s]!.all} />
              ))}
            </tbody>
          </table>
        </div>
      </section>{" "}

      <details className="border-2 border-border bg-card">
        <summary className="flex min-h-[44px] cursor-pointer items-center px-5 font-bold">Every figure</summary>
        <div className="space-y-6 border-t-2 border-border p-5">
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="p-2 text-left text-sm text-muted-foreground">
                All sources. Bias is decided minus predicted (negative: DOL was earlier). Settled: dates more than 30
                days past, a case still pending counted as a miss.
              </caption>
              <thead className="bg-muted">
                <tr>
                  {["Source", "Recorded", "Graded", "Typical miss", "Bias", "Within 14d", "In their range", "Settled hit", "Late, waiting", "Miss, counting them"].map((h, i) => (
                    <th key={h} scope="col" className={cn("px-3 py-2 font-bold", i === 0 ? "text-left" : "text-right")}>{`${h} `}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const c = perm.bySource[s]!.all;
                  return (
                    <tr key={s} className="border-t-2 border-border">
                      <th scope="row" className="px-3 py-2 text-left font-bold">{`${sourceName(s)} `}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{`${c.recorded} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${c.graded} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${days(c.typicalMissDays)} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${c.biasDays === null ? "-" : `${c.biasDays > 0 ? "+" : ""}${Math.round(c.biasDays)}d`} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${pct(c.within14Share)} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${pct(c.inBandShare)} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${pct(c.settledHitShare)} (${c.settled}) `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${c.overdue ?? 0} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${c.missAtLeastDays == null ? "-" : `≥${days(c.missAtLeastDays)}`} `}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>{" "}
          {Object.keys(h2h).length > 0 ? (
            <div className="overflow-x-auto border-2 border-border">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="p-2 text-left text-sm text-muted-foreground">
                  Head to head: only cases both sides dated the same day.
                </caption>
                <thead className="bg-muted">
                  <tr>
                    {["Rival", "Shared", "Decided", "Our miss", "Their miss", "We were closer", "They were closer", "Tied", "Our late, waiting", "Their late, waiting"].map((h, i) => (
                      <th key={h} scope="col" className={cn("px-3 py-2 font-bold", i === 0 ? "text-left" : "text-right")}>{`${h} `}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(h2h).map(([src, h]) => (
                    <tr key={src} className="border-t-2 border-border">
                      <th scope="row" className="px-3 py-2 text-left font-bold">{`${sourceName(src)} `}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.shared} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.decided} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${days(h.oursTypicalDays)} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${days(h.rivalTypicalDays)} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.oursCloser} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.rivalCloser} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.ties} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.oursLateWaiting ?? "-"} `}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{`${h.rivalLateWaiting ?? "-"} `}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}{" "}
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="p-2 text-left text-sm text-muted-foreground">
                Typical miss by how far ahead the date was, with how many were graded.
              </caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-bold">{"Source "}</th>
                  {HORIZONS.map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-right font-bold">{`${h} days `}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s} className="border-t-2 border-border">
                    <th scope="row" className="px-3 py-2 text-left font-bold">{`${sourceName(s)} `}</th>
                    {HORIZONS.map((h) => {
                      const c = perm.bySource[s]!.byHorizon[h];
                      return (
                        <td key={h} className="px-3 py-2 text-right tabular-nums">{`${days(c.typicalMissDays)} (${c.graded}) `}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
