"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "../../../convex/_generated/api";
import { HORIZONS, type Cell, type Summary } from "@/lib/scorecard/score";

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
    </tr>
  );
}

export function ScorecardPanel() {
  const load = useAction(api.adminScorecard.get);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "empty" } | { kind: "error"; message: string } | { kind: "ready"; perm: Summary; computedAt: number }
  >({ kind: "loading" });

  useEffect(() => {
    let live = true;
    load({})
      .then((r) => {
        if (!live) return;
        if (!r) return setState({ kind: "empty" });
        const doc = JSON.parse(r.json) as { perm: Summary };
        setState({ kind: "ready", perm: doc.perm, computedAt: r.computedAt });
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
          PERM, since {state.perm.since ?? "-"}. Summarised {new Date(state.computedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET.
          Bias is decided minus predicted: positive means DOL was later. Settled: dates more than 30 days past, pending counted as a miss.
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
