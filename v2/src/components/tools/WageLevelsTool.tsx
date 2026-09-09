"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { Label } from "@/components/ui";
import { US_STATE_NAMES } from "@/lib/usStateNames";
import { seriesYearFor, SOC_RE, type AreaOption, type WageLevel } from "@/lib/wageLevels";

/**
 * The four prevailing wage levels for one occupation in one area, read live
 * from DOL's wage search through this site's cached route. Three inputs
 * (state, area, SOC code) and a series year; the answer is DOL's four
 * figures with the series they belong to and a link to DOL's own page.
 * Nothing is computed here.
 */

const SELECT = "mt-1.5 min-h-11 w-full min-w-0 border-2 border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const usd = (n: number, digits = 0) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "levels"; levels: WageLevel[]; seriesYear: number; soc: string; areaLabel: string; source: string }
  | { kind: "none"; message: string }
  | { kind: "error"; message: string };

const STATES = Object.entries(US_STATE_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function WageLevelsTool({ initialSoc = "" }: { initialSoc?: string }) {
  const stateId = useId();
  const areaId = useId();
  const socId = useId();
  const yearId = useId();
  const currentSeries = useMemo(() => seriesYearFor(new Date().toISOString().slice(0, 10)), []);
  const [state, setState] = useState("");
  const [seriesYear, setSeriesYear] = useState(currentSeries);
  const [areas, setAreas] = useState<AreaOption[] | null>(null);
  const [area, setArea] = useState("");
  const [soc, setSoc] = useState(initialSoc);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const stateName = STATES.find((s) => s.code === state)?.name ?? "";

  useEffect(() => {
    if (!stateName) {
      setAreas(null);
      setArea("");
      return;
    }
    let live = true;
    setAreas(null);
    fetch(`/api/wage-areas?state=${encodeURIComponent(stateName.toUpperCase())}&year=${seriesYear}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { areas?: AreaOption[] } | null) => {
        if (!live) return;
        const list = j?.areas ?? [];
        setAreas(list);
        setArea(list[0] ? String(list[0].value) : "");
      })
      .catch(() => {
        if (live) setAreas([]);
      });
    return () => {
      live = false;
    };
  }, [stateName, seriesYear]);

  const ready = SOC_RE.test(soc.trim()) && area !== "" && result.kind !== "loading";

  async function lookUp(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) return;
    setResult({ kind: "loading" });
    try {
      const res = await fetch(`/api/wage-levels?soc=${encodeURIComponent(soc.trim())}&area=${area}&year=${seriesYear}`);
      const j = (await res.json().catch(() => null)) as { ok?: boolean; levels?: WageLevel[] | null; message?: string; soc?: string; seriesYear?: number; source?: string } | null;
      if (!res.ok || !j?.ok) {
        setResult({ kind: "error", message: j?.message ?? "DOL could not be reached. Try again in a moment." });
        return;
      }
      if (!j.levels) {
        setResult({ kind: "none", message: j.message ?? "DOL publishes no wage for that occupation in that area." });
        return;
      }
      setResult({ kind: "levels", levels: j.levels, seriesYear: j.seriesYear ?? seriesYear, soc: j.soc ?? soc, areaLabel: areas?.find((a) => String(a.value) === area)?.label ?? area, source: j.source ?? "https://flag.dol.gov/wage-data/wage-search" });
    } catch {
      setResult({ kind: "error", message: "That did not go through, which usually means the connection dropped." });
    }
  }

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <form onSubmit={lookUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <div>
          <Label htmlFor={socId}>SOC code</Label>{" "}
          <input
            id={socId}
            value={soc}
            onChange={(e) => setSoc(e.target.value)}
            placeholder="15-1252"
            inputMode="numeric"
            pattern="\d{2}-\d{4}(\.\d{2})?"
            className={SELECT}
          />{" "}
          <p className="mt-1 text-xs text-muted-foreground">The occupation code on the wage request or the PERM; every occupation page prints its own.</p>
        </div>{" "}
        <div>
          <Label htmlFor={stateId}>State</Label>{" "}
          <select id={stateId} value={state} onChange={(e) => setState(e.target.value)} className={SELECT}>
            <option value="">Choose a state</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={areaId}>Area</Label>{" "}
          <select id={areaId} value={area} onChange={(e) => setArea(e.target.value)} className={SELECT} disabled={!areas || areas.length === 0}>
            {!stateName ? <option value="">Choose a state first</option> : null}
            {stateName && areas === null ? <option value="">Loading DOL&apos;s areas</option> : null}
            {areas && areas.length === 0 && stateName ? <option value="">DOL lists no areas</option> : null}
            {(areas ?? []).map((a) => (
              <option key={a.value} value={String(a.value)}>
                {a.label}
              </option>
            ))}
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={yearId}>Wage series</Label>{" "}
          <select id={yearId} value={seriesYear} onChange={(e) => setSeriesYear(Number(e.target.value))} className={SELECT}>
            {[currentSeries, currentSeries - 1, currentSeries - 2].map((y) => (
              <option key={y} value={y}>
                July {y} to June {y + 1}
              </option>
            ))}
          </select>
        </div>{" "}
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={!ready}
            className="min-h-11 border-2 border-border bg-primary px-6 font-bold text-primary-foreground shadow-hard transition-transform hover:-translate-y-[1px] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {result.kind === "loading" ? "Asking DOL" : "Look up the four levels"}
          </button>
        </div>
      </form>

      {result.kind === "error" || result.kind === "none" ? (
        <p className="mt-5 flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {result.message}
        </p>
      ) : null}

      {result.kind === "levels" ? (
        <div className="mt-6">
          <p className="text-sm text-foreground/70">
            SOC {result.soc}, {result.areaLabel}, the July {result.seriesYear} to June {result.seriesYear + 1} series. DOL&apos;s figures, read just now.
          </p>{" "}
          <dl className="mt-3 border-t-2 border-border">
            {result.levels.map((l) => (
              <div key={l.level} className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-baseline sm:gap-x-6">
                <dt className="text-base">Level {l.level}</dt>{" "}
                <dd className="font-mono text-sm tabular-nums text-foreground/70">{usd(l.hourly, 2)} an hour</dd>{" "}
                <dd className="font-heading text-xl font-black tabular-nums">{usd(l.yearly)} a year</dd>
              </div>
            ))}
          </dl>{" "}
          <p className="mt-3 text-xs text-muted-foreground">
            Source:{" "}
            <a href={result.source} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">
              OFLC wage search
            </a>
            , all-industries OEWS. The level a case is set at depends on the job&apos;s requirements, which DOL decides on the ETA-9141.
          </p>
        </div>
      ) : null}
    </div>
  );
}
