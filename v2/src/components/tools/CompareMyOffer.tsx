"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";

import type { WageOption } from "@/lib/turso/publicData";
import { MIN_FOR_MEDIAN, placeOffer, type OfferPayload as Payload, type PlacedOffer as Placed } from "@/lib/wageStats";

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
  v === null ? "n/a" : `$${Math.round(v).toLocaleString("en-US")}`;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const field =
  "min-h-11 w-full border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const label = "block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground";

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
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <form onSubmit={run} className="grid grid-cols-1 gap-5 [&>*]:min-w-0 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={ids.soc} className={label}>Occupation </label>{" "}
          <select id={ids.soc} value={soc} onChange={(e) => setSoc(e.target.value)} className={`${field} mt-1.5`} required>
            <option value="">Choose the occupation on the filing</option>
            {occupations.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
            className="flex min-h-11 items-center border-2 border-border bg-primary px-5 font-heading text-sm font-black text-black shadow-hard-sm transition-transform hover:-translate-y-[1px] disabled:opacity-60 motion-reduce:transition-none"
          >
            {busy ? "Placing it…" : "Place my offer"}
          </button>{" "}
          <p className="text-sm text-muted-foreground">
            Your number stays in your browser. The site only fetches the distribution for the occupation and state.
          </p>
        </div>
      </form>{" "}

      {error ? (
        <p role="alert" className="mt-5 border-2 border-border bg-background p-3 text-sm font-bold">{error}</p>
      ) : null}{" "}

      {results && annual !== null ? (
        <div className="mt-8 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-2" aria-live="polite">
          {(Object.keys(PROGRAM) as Program[]).map((p) => {
            const r = results[p];
            const meta = PROGRAM[p];
            return (
              <div key={p} className="border-2 border-border bg-background p-5">
                <p className={label}>{meta.name} </p>{" "}
                {r === "thin" || r === null ? (
                  <p className="mt-3 text-base leading-relaxed">
                    Too few {meta.noun} for {occupationLabel}{state ? ` in ${state}` : ""} to place an offer against: below {MIN_FOR_MEDIAN} filings a percentile would move with a single case.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 font-heading text-4xl font-black tracking-tight">
                      {ordinal(r.percentile)} <span className="text-lg font-bold text-muted-foreground">percentile</span>
                    </p>{" "}
                    <p className="mt-2 text-base leading-relaxed">
                      {usd(annual)} a year sits at about the {ordinal(r.percentile)} percentile of{" "}
                      {r.n.toLocaleString("en-US")} {meta.noun} for {occupationLabel}
                      {state ? ` in ${state}` : ""}. Median {usd(r.p50)}; the middle half runs {usd(r.p25)} to {usd(r.p75)}.
                    </p>{" "}
                    <Link
                      href={`${meta.explorer}?soc=${encodeURIComponent(soc)}${state ? `&state=${encodeURIComponent(state)}` : ""}`}
                      className="mt-3 inline-block font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
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
