"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";

import type { WageOption } from "@/lib/db/publicData";
import { SelectedInFull } from "@/components/tools/SelectedInFull";
import { MIN_FOR_MEDIAN, placeOffer, type OfferPayload as Payload, type PlacedOffer as Placed } from "@/lib/wageStats";
import { formatDollars } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";

/**
 * Compare my offer: where a salary sits among what employers actually filed.
 *
 * THE OFFER NEVER LEAVES THE BROWSER. The two data routes take an occupation,
 * a state and a status and return a distribution: the five-point ladder, a
 * histogram and the counts clipped off either end. The reader's number is
 * placed in that histogram here, on the client, so the site holds no record
 * of what anyone was offered. That is also why the result is "about the Nth
 * percentile": a histogram bin is a range, and the position inside it is
 * interpolated.
 *
 * Two populations, both certified filings, both first-party: H-1B LCAs
 * (the wage attested for the H-1B role) and PERM cases (the wage offered on
 * the ETA-9089 for the permanent job). They differ, and the page says so
 * rather than blending them.
 */

const usd = (v: number | null) =>
  v === null ? "n/a" : formatDollars(v);

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const field =
  "min-h-11 w-full border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const label = "block text-sm font-bold text-muted-foreground";

/**
 * One population as a strip: the middle half as a block, the median as a
 * rule, the offer as a marker above. Hatched before an offer is placed, so
 * the frame shows the shape of the answer.
 */
function OfferStrip({ placed, offer }: { placed: Placed | null; offer: number | null }) {
  const ok = placed && placed.p25 !== null && placed.p50 !== null && placed.p75 !== null && offer !== null;
  if (!ok) {
    return (
      <div aria-hidden="true" className="relative mt-3 h-12">
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-foreground/20" />
        <span className="absolute inset-y-1 left-[30%] w-[38%] border border-dashed border-foreground/30 text-muted-foreground bg-hatch" />
        <span className="absolute inset-y-0 left-[48%] w-0.5 bg-foreground/30" />
      </div>
    );
  }
  const { p25, p50, p75 } = placed as { p25: number; p50: number; p75: number };
  const spread = Math.max(1, p75 - p25);
  const lo = Math.min(offer, p25 - spread);
  const hi = Math.max(offer, p75 + spread);
  const at = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const mark = at(offer);
  return (
    <div className="mt-3">
      <div aria-hidden="true" className="relative h-12">
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-foreground/30" />
        <span className="absolute inset-y-1 border border-border bg-primary/70" style={{ left: `${at(p25)}%`, width: `${at(p75) - at(p25)}%` }} />
        <span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-foreground" style={{ left: `${at(p50)}%` }} />
        <span className="absolute -top-1 bottom-[-4px] w-1.5 -translate-x-1/2 bg-data-warn-ink" style={{ left: `${mark}%` }} />
      </div>{" "}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 bg-data-warn-ink align-middle" />Your offer <b className="tabular-nums">{usd(offer)}</b>{" "}</li>{" "}
        <li><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 bg-foreground align-middle" />Median <b className="tabular-nums">{usd(p50)}</b>{" "}</li>{" "}
        <li><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 border border-input bg-primary/70 align-middle" />Middle half <b className="tabular-nums">{usd(p25)} to {usd(p75)}</b>{" "}</li>
      </ul>
    </div>
  );
}

interface Props {
  occupations: readonly WageOption[];
  states: readonly WageOption[];
}

type Program = "lca" | "perm";
const PROGRAM: Record<Program, { api: string; name: string; noun: string; explorer: string }> = {
  lca: { api: "/api/lca-wages", name: "H-1B LCAs", noun: "certified LCAs", explorer: "/lca-wages" },
  perm: { api: "/api/perm-wages", name: "PERM offers", noun: "certified PERM cases", explorer: "/tools/salary-explorer" },
};

export function CompareMyOffer({ occupations, states }: Props) {
  const ids = { soc: useId(), state: useId(), offer: useId(), unit: useId() };
  const [soc, setSoc] = useState("");
  const [state, setState] = useState("");
  const [offer, setOffer] = useState("");
  const [unit, setUnit] = useState<"year" | "hour">("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<Program, Placed | null | "thin"> | null>(null);

  const annual = useMemo(() => {
    const v = Number(offer.replace(/[^0-9.]/g, ""));
    if (!(v > 0)) return null;
    return unit === "hour" ? v * 2080 : v;
  }, [offer, unit]);

  const occupationLabel = occupations.find((o) => o.value === soc)?.label ?? "this occupation";

  async function run(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!soc || annual === null) {
      setError("Pick an occupation and enter the offer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ soc, status: "certified" });
      if (state) qs.set("state", state);
      const out = {} as Record<Program, Placed | null | "thin">;
      await Promise.all(
        (Object.keys(PROGRAM) as Program[]).map(async (p) => {
          const r = await fetch(`${PROGRAM[p].api}?${qs.toString()}`);
          if (!r.ok) throw new Error(`${r.status}`);
          const payload = (await r.json()) as Payload;
          const placed = placeOffer(payload, annual);
          out[p] = placed ?? (payload.stats.n < MIN_FOR_MEDIAN ? "thin" : null);
        }),
      );
      setResults(out);
    } catch {
      setError("The wage data did not load. Try again in a moment.");
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="object p-5 sm:p-8">
      <form onSubmit={run} className="grid grid-cols-1 gap-5 [&>*]:min-w-0 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={ids.soc} className={label}>Occupation </label>{" "}
          <select id={ids.soc} value={soc} onChange={(e) => setSoc(e.target.value)} className={`${field} mt-1.5`} required>
            <option value="">Choose the occupation</option>
            {occupations.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>{" "}
          <SelectedInFull label={occupations.find((o) => o.value === soc)?.label} />
        </div>{" "}
        <div>
          <label htmlFor={ids.state} className={label}>Worksite state </label>{" "}
          <select id={ids.state} value={state} onChange={(e) => setState(e.target.value)} className={`${field} mt-1.5`}>
            <option value="">Every state</option>
            {states.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>{" "}
        <div>
          <label htmlFor={ids.offer} className={label}>Your offer </label>{" "}
          <div className="mt-1.5 flex gap-2">
            <input
              id={ids.offer}
              inputMode="decimal"
              autoComplete="off"
              placeholder="145000"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className={field}
              required
            />{" "}
            <select id={ids.unit} aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as "year" | "hour")} className={`${field} w-auto`}>
              <option value="year">per year</option>
              <option value="hour">per hour</option>
            </select>
          </div>
        </div>{" "}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            {busy ? "Placing it…" : "Place my offer"}
          </button>{" "}
          <p className="text-sm text-muted-foreground">
            Your number stays in your browser. The site only fetches the distribution for the occupation and state.
          </p>
        </div>
      </form>{" "}

      {error ? (
        <p role="alert" className="mt-5 bg-tint p-3 text-sm font-bold">{error}</p>
      ) : null}{" "}

      {!results ? (
        <div className="mt-8 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-2" aria-hidden="true">
          {(Object.keys(PROGRAM) as Program[]).map((p) => (
            <div key={p} className="border border-dashed border-foreground/30 bg-background p-5">
              <p className={label}>{PROGRAM[p].name} </p>{" "}
              <OfferStrip placed={null} offer={null} />{" "}
              <p className="mt-2 text-sm text-muted-foreground">Where the offer falls among {PROGRAM[p].noun} for the job.</p>
            </div>
          ))}
        </div>
      ) : null}{" "}

      {results && annual !== null ? (
        <div className="mt-8 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-2" aria-live="polite">
          {(Object.keys(PROGRAM) as Program[]).map((p) => {
            const r = results[p];
            const meta = PROGRAM[p];
            return (
              <div key={p} className="bg-tint p-5">
                <p className={label}>{meta.name} </p>{" "}
                {r === "thin" || r === null ? (
                  <p className="mt-3 text-base leading-relaxed">
                    Too few {meta.noun} for {occupationLabel}{state ? ` in ${state}` : ""} to place an offer against: below {MIN_FOR_MEDIAN} filings a percentile would move with a single case.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 font-heading text-4xl font-bold tracking-tight">
                      {ordinal(r.percentile)} <span className="text-lg font-bold text-muted-foreground">percentile</span>
                    </p>{" "}
                    <OfferStrip placed={r} offer={annual} />{" "}
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Against {r.n.toLocaleString("en-US")} {meta.noun} for {occupationLabel}
                      {state ? ` in ${state}` : ""}, each as a yearly wage.
                    </p>{" "}
                    <Link
                      href={`${meta.explorer}?soc=${encodeURIComponent(soc)}${state ? `&state=${encodeURIComponent(state)}` : ""}`}
                      className="link mt-3 inline-block"
                    >
                      See the whole distribution
                    </Link>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
