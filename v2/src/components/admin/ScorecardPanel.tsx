"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";

import { EASTERN_TIMEZONE } from "@/lib/time";

import { api } from "@convex/_generated/api";
import { HORIZONS, type Cell, type HeadToHead, type Summary } from "@/lib/scorecard/score";

/**
 * The private competitor scorecard: our daily sample against the same cases
 * as the rivals predicted them, graded the same way. Rivals are letters here
 * and everywhere in this repository. Rival C is never called: its published
 * method is re-run on our own data, and the row says so.
 */

const LABEL: Record<string, string> = {
  ours: "Ours",
  "rival-a": "Rival A",
  "rival-b": "Rival B",
  "rival-c": "Rival C (its method, our data)",
};

const days = (x: number | null) => (x === null ? "-" : `${Math.round(x)}d`);
const pct = (x: number | null) => (x === null ? "-" : `${Math.round(x * 100)}%`);

function Row({ name, c }: { name: string; c: Cell }) {
  return (
    <tr className="border-t-2 border-border">
      <th scope="row" className="px-3 py-2 text-left font-bold">{`${LABEL[name] ?? name} `}</th>
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
}

export function ScorecardPanel() {
  const load = useAction(api.adminScorecard.get);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "empty" }
    | { kind: "error"; message: string }
    | { kind: "ready"; perm: Summary; h2h: Record<string, HeadToHead>; computedAt: number }
  >({ kind: "loading" });

  useEffect(() => {
    let live = true;
    load({})
      .then((r) => {
        if (!live) return;
        if (!r) return setState({ kind: "empty" });
        // headToHead arrived Oct 3 2026; an older doc has none.
        const doc = JSON.parse(r.json) as { perm: Summary; headToHead?: Record<string, HeadToHead> };
        setState({ kind: "ready", perm: doc.perm, h2h: doc.headToHead ?? {}, computedAt: r.computedAt });
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
  const sources = Object.keys(state.perm.bySource).sort((a, b) => (a === "ours" ? -1 : b === "ours" ? 1 : a < b ? -1 : 1));

  return (
    <div className="space-y-8">
      <section aria-labelledby="sc-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="sc-h" className="font-heading text-xl font-black">Everyone on the same cases</h2>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          PERM, since {state.perm.since ?? "-"}. Summarised {new Date(state.computedAt).toLocaleString("en-US", { timeZone: EASTERN_TIMEZONE, dateStyle: "medium", timeStyle: "short" })} ET.
          Bias is decided minus predicted: positive means DOL was later. Settled: dates more than 30 days past, pending counted as a miss. Counting them: a case still waiting past its date counted at the days it is already late, a floor.
        </p>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">{"Source "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Recorded "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Graded "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Typical miss "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Bias "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Within 14d "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"In their range "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Settled hit "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Late, still waiting "}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{"Miss, counting them "}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <Row key={s} name={s} c={state.perm.bySource[s]!.all} />
              ))}
            </tbody>
          </table>
        </div>
      </section>{" "}

      <section aria-labelledby="sc-h3" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="sc-h3" className="font-heading text-xl font-black">Head to head, case by case</h2>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Only the cases both sides predicted the same day. Closer: decided cases, plus cases still waiting past both
          dates, where the later prediction is already the closer one.
        </p>{" "}
        {Object.keys(state.h2h).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No shared cases yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto border-2 border-border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-bold">{"Rival "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"Shared "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"Decided "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"Our miss "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"Their miss "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"We were closer "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"They were closer "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">{"Tied "}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(state.h2h).map(([src, h]) => (
                  <tr key={src} className="border-t-2 border-border">
                    <th scope="row" className="px-3 py-2 text-left font-bold">{`${LABEL[src] ?? src} `}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{`${h.shared} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${h.decided} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${days(h.oursTypicalDays)} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${days(h.rivalTypicalDays)} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${h.oursCloser} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${h.rivalCloser} `}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${h.ties} `}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>{" "}

      <section aria-labelledby="sc-h2" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="sc-h2" className="font-heading text-xl font-black">Typical miss by how far ahead</h2>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border">
          <table className="w-full min-w-[560px] text-sm">
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
                  <th scope="row" className="px-3 py-2 text-left font-bold">{`${LABEL[s] ?? s} `}</th>
                  {HORIZONS.map((h) => {
                    const c = state.perm.bySource[s]!.byHorizon[h];
                    return (
                      <td key={h} className="px-3 py-2 text-right tabular-nums">{`${days(c.typicalMissDays)} (${c.graded}) `}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
