"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { BarRows } from "@/components/data/BarRows";
import { ChartTips } from "@/components/data/ChartTips";
import { Label } from "@/components/ui/label";
import { levelName, levelReached, type LevelReached } from "@/lib/wageLevels";
import { cn } from "@/lib/utils";

/**
 * Where one yearly wage reaches each of DOL's four levels, in every wage area of a state: how many areas at each
 * level, then each area on one shared scale, its four level bands and a line at the wage. Read from our copy of
 * DOL's tables (/api/wage-levels/areas). It shows where a wage sits, never a case's level: DOL sets that from
 * the job's requirements on the ETA-9141.
 */

interface AreaRow {
  area: string;
  name: string;
  yearly: (number | null)[];
  label: string | null;
}

type Load = { kind: "loading" } | { kind: "ready"; wageYear: number | null; areas: AreaRow[] } | { kind: "error"; message: string };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ROMAN = ["I", "II", "III", "IV"] as const;
/** The four bands, lightest first: Level I's band runs from its wage to Level II's. */
const BAND_OPACITY = ["opacity-15", "opacity-30", "opacity-50", "opacity-70"] as const;
/** Areas drawn before the rest fold. */
const SHOWN = 10;
/** A yearly wage the picture can place: under it is an hourly figure, over it a typo. */
const WAGE_MIN = 10_000;
const WAGE_MAX = 2_000_000;

export function readWage(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= WAGE_MIN && n <= WAGE_MAX ? Math.round(n) : null;
}

/** Highest level first; within a level, the area whose Level II costs least first. */
export function orderAreas(areas: readonly AreaRow[], wage: number): (AreaRow & { reached: LevelReached })[] {
  return areas
    .filter((a) => a.yearly[0] != null)
    .map((a) => ({ ...a, reached: levelReached(a.yearly, wage) }))
    .sort((a, b) => b.reached - a.reached || (a.yearly[1] ?? Infinity) - (b.yearly[1] ?? Infinity) || a.name.localeCompare(b.name));
}

function Strip({ row, wage, pct }: { row: AreaRow & { reached: LevelReached }; wage: number; pct: (v: number) => number }) {
  const known = row.yearly.map((v) => (v == null ? null : pct(v)));
  const tip = [
    row.name,
    ...row.yearly.map((v, i) => `Level ${ROMAN[i]}: ${v == null ? "not published" : usd(v)}`),
    `${usd(wage)}: ${levelName(row.reached)}`,
  ].join("\n");
  return (
    <div data-tip={tip} tabIndex={-1} className="relative h-7 border-2 border-input bg-background">
      {known.map((left, i) => {
        if (left == null) return null;
        const next = known.slice(i + 1).find((v) => v != null);
        return (
          <span
            key={ROMAN[i]}
            aria-hidden="true"
            className={cn("absolute inset-y-0 bg-primary", BAND_OPACITY[i])}
            style={{ left: `${left}%`, width: `${(next ?? 100) - left}%` }}
          />
        );
      })}
      <span aria-hidden="true" className="absolute -inset-y-1 w-[3px] -translate-x-1/2 bg-foreground" style={{ left: `${pct(wage)}%` }} />
    </div>
  );
}

export function WageAcrossAreas({
  soc,
  state,
  stateName,
  startWage,
  currentArea,
}: {
  soc: string;
  /** Two letters, "TX". */
  state: string;
  stateName: string;
  /** The looked-up area's Level II, so the picture draws before anything is typed. */
  startWage: number | null;
  /** The area the reader looked up, marked in the list. */
  currentArea: string;
}) {
  const wageId = useId();
  const [wageText, setWageText] = useState(startWage ? String(Math.round(startWage)) : "");
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    fetch(`/api/wage-levels/areas?soc=${encodeURIComponent(soc)}&state=${encodeURIComponent(state)}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; wageYear?: number | null; areas?: AreaRow[]; message?: string } | null;
        if (!live) return;
        setLoad(r.ok && j?.ok ? { kind: "ready", wageYear: j.wageYear ?? null, areas: j.areas ?? [] } : { kind: "error", message: j?.message ?? "DOL's stored tables couldn't be read just now." });
      })
      .catch(() => {
        if (live) setLoad({ kind: "error", message: "That didn't go through, which usually means the connection dropped." });
      });
    return () => {
      live = false;
    };
  }, [soc, state]);

  const wage = readWage(wageText);
  const rows = useMemo(() => (load.kind === "ready" && wage != null ? orderAreas(load.areas, wage) : []), [load, wage]);

  const scale = useMemo(() => {
    if (!rows.length || wage == null) return null;
    const lows = rows.map((r) => r.yearly[0] as number);
    const highs = rows.flatMap((r) => r.yearly.filter((v): v is number => v != null));
    const lo = Math.min(...lows, wage) * 0.94;
    const hi = Math.max(...highs, wage) * 1.04;
    return (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  }, [rows, wage]);

  const counts = ([4, 3, 2, 1, 0] as const).map((n) => ({ n, areas: rows.filter((r) => r.reached === n).length }));
  const mine = rows.find((r) => r.area === currentArea)?.reached;

  const list = (part: typeof rows) => (
    <ol className="divide-y divide-border/70">
      {part.map((r) => (
        <li
          key={r.area}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem] [&>*]:min-w-0",
            r.area === currentArea && "bg-sage px-2",
          )}
        >
          <span className="text-base leading-snug">
            {r.name}
            {r.area === currentArea ? <span className="font-bold"> (the area you looked up)</span> : null}{" "}
          </span>{" "}
          <span className="text-right font-heading text-base font-bold sm:order-last">{levelName(r.reached)}</span>{" "}
          {scale && wage != null ? (
            <div className="col-span-2 sm:col-span-1">
              <Strip row={r} wage={wage} pct={scale} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );

  return (
    <section aria-labelledby={`${wageId}-h`} className="mt-10 border-t-2 border-border pt-6">
      <h3 id={`${wageId}-h`} className="font-heading text-xl font-bold">
        Where a wage reaches each level in {stateName}
      </h3>{" "}
      <div className="mt-4 max-w-xs">
        <Label htmlFor={wageId}>A yearly wage</Label>{" "}
        <input
          id={wageId}
          name="wage"
          value={wageText}
          onChange={(e) => setWageText(e.target.value)}
          inputMode="numeric"
          placeholder="120000"
          className="mt-1.5 min-h-11 w-full border-2 border-input bg-background px-3 font-mono text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          {wageText.trim() && wage == null ? "Type a yearly figure, such as 120000." : "It starts at your area's Level II. Type an offer to move it."}
        </p>
      </div>{" "}

      {load.kind === "loading" ? (
        <p className="mt-5 text-sm text-muted-foreground" role="status">
          Reading DOL&apos;s tables for every area in {stateName}.
        </p>
      ) : null}
      {load.kind === "error" ? (
        <p className="mt-5 text-sm" role="status">
          {load.message}
        </p>
      ) : null}
      {load.kind === "ready" && load.areas.length === 0 ? (
        <p className="mt-5 text-sm" role="status">
          DOL&apos;s tables hold no figure for this job in {stateName}.
        </p>
      ) : null}

      {rows.length > 0 && wage != null ? (
        <>
          <BarRows
            label={`Areas of ${stateName} where ${usd(wage)} reaches each level`}
            className="mt-6 max-w-2xl"
            rows={counts.map(({ n, areas }) => ({
              key: `l${n}`,
              label: levelName(n),
              value: areas,
              text: `${areas} area${areas === 1 ? "" : "s"}`,
              tone: n === mine ? "primary" : "blue",
            }))}
          />{" "}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-hidden="true">
            {ROMAN.map((l, i) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={cn("inline-block size-3.5 border border-input bg-primary", BAND_OPACITY[i])} /> From Level {l}{" "}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-4 w-[3px] bg-foreground" /> {usd(wage)}{" "}
            </span>
          </div>{" "}
          <ChartTips label={`Each area of ${stateName}: its four levels and where ${usd(wage)} sits`} className="mt-3">
            {list(rows.slice(0, SHOWN))}
            {rows.length > SHOWN ? (
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2.5 font-bold">All {rows.length} areas</summary>{" "}
                {list(rows.slice(SHOWN))}
              </details>
            ) : null}
          </ChartTips>{" "}
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            DOL&apos;s tables for July {load.kind === "ready" && load.wageYear ? `${load.wageYear} to June ${load.wageYear + 1}` : "this year"}, all
            industries, at 2,080 hours a year. DOL sets a case&apos;s level from the job&apos;s requirements; this shows where a wage would
            sit against each area&apos;s four figures.
          </p>
        </>
      ) : null}
    </section>
  );
}
