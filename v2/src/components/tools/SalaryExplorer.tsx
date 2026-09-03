"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WarningIcon } from "@phosphor-icons/react";

import { Label } from "@/components/ui";
import {
  MIN_FOR_MEDIAN,
  reportability,
  type WagePercentiles,
} from "@/lib/wageStats";
import { cn } from "@/lib/utils";

/**
 * Offered wages in DOL's disclosure files, filtered.
 *
 * TWO THINGS THIS GETS RIGHT ON PURPOSE.
 *
 * Percentiles are computed over the SELECTED subset, in SQL, not sliced out of
 * a corpus-wide figure. A median that silently describes 373,162 cases while
 * the reader has filtered to one occupation in one state is the failure this
 * whole page exists to avoid.
 *
 * And a thin selection reports nothing rather than something. Below thirty
 * cases no figure appears at all; between thirty and a hundred the middle
 * appears and the 5th and 95th are withheld, because at that size each tail
 * rests on fewer than five filings. The reason is stated ABOVE the numbers, so
 * a figure computed from a thin population can never read as more
 * authoritative than the doubt about it.
 *
 * Certified-only is the default because a denied case's offered wage was
 * never agreed to by anyone, and a benchmark should be of wages that stood.
 */

export interface WageOption {
  value: string;
  label: string;
  n: number;
}

export interface StateWageRow extends WagePercentiles {
  state: string;
}

export interface SalaryExplorerProps {
  occupations: readonly WageOption[];
  states: readonly WageOption[];
  fiscalYears: readonly string[];
  /** Rendered before any fetch, so the default view needs no JavaScript. */
  initial: ExplorerPayload;
}

export interface ExplorerPayload {
  stats: WagePercentiles;
  bins: { from: number; count: number }[];
  binWidth: number;
  below: number;
  above: number;
  byState: StateWageRow[];
}

const STATUSES = [
  { value: "certified", label: "Certified only" },
  { value: "all", label: "Every outcome" },
  { value: "denied", label: "Denied only" },
  { value: "withdrawn", label: "Withdrawn only" },
];

const usd = (n: number | null) =>
  n === null ? "n/a" : `$${Math.round(n).toLocaleString("en-US")}`;
const int = (n: number) => n.toLocaleString("en-US");

export function SalaryExplorer({
  occupations,
  states,
  fiscalYears,
  initial,
}: SalaryExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ids = { soc: useId(), state: useId(), fy: useId(), status: useId() };

  const soc = params.get("soc") ?? "";
  const state = params.get("state") ?? "";
  const fy = params.get("fy") ?? "";
  const status = params.get("status") ?? "certified";
  const isDefault = !soc && !state && !fy && status === "certified";

  const [data, setData] = useState<ExplorerPayload>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    // The server already rendered the default view, so refetching it on mount
    // would be a round trip that changes nothing on screen.
    if (isDefault) {
      setData(initial);
      setError(null);
      return;
    }
    const ctl = new AbortController();
    const qs = new URLSearchParams();
    if (soc) qs.set("soc", soc);
    if (state) qs.set("state", state);
    if (fy) qs.set("fy", fy);
    qs.set("status", status);
    setLoading(true);
    fetch(`/api/perm-wages?${qs.toString()}`, { signal: ctl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((j: ExplorerPayload) => {
        setData(j);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Say what the reader can do, in the interface's voice. The previous
        // figures stay on screen behind this rather than blanking.
        setError("Those figures could not be loaded. Change a filter to try again.");
      })
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [soc, state, fy, status, isDefault, initial]);

  const report = useMemo(() => reportability(data.stats.n), [data.stats.n]);
  const subject = useMemo(() => {
    const occ = occupations.find((o) => o.value === soc)?.label;
    const parts = [occ ?? "All occupations", state || "every state", fy ? `FY${fy}` : "all years"];
    return parts.join(" · ");
  }, [occupations, soc, state, fy]);

  const maxBin = Math.max(1, ...data.bins.map((b) => b.count));

  return (
    <div className="border-2 border-border bg-card shadow-hard">
      {/* Filters. grid-cols-1 unprefixed and min-w-0 on the items are both
          required: without a mobile column track the items land in an implicit
          content-sized column, which on WebKit sizes a form control from its
          own UA stylesheet and runs it off the card. */}
      <div className="border-b-2 border-border p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-black leading-tight">
          What does this job pay on a PERM?
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Every offered wage in DOL&apos;s disclosure files, filtered. The
          figures describe the cases you select, not the whole corpus.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor={ids.soc} className="text-sm font-bold">
              Occupation
            </Label>
            <select
              id={ids.soc}
              value={soc}
              onChange={(e) => setParam("soc", e.target.value)}
              className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <option value="">All occupations</option>
              {occupations.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({int(o.n)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={ids.state} className="text-sm font-bold">
              Worksite state
            </Label>
            <select
              id={ids.state}
              value={state}
              onChange={(e) => setParam("state", e.target.value)}
              className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <option value="">Every state</option>
              {states.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({int(s.n)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={ids.fy} className="text-sm font-bold">
              Fiscal year
            </Label>
            <select
              id={ids.fy}
              value={fy}
              onChange={(e) => setParam("fy", e.target.value)}
              className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <option value="">All years</option>
              {fiscalYears.map((y) => (
                <option key={y} value={y}>
                  FY{y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={ids.status} className="text-sm font-bold">
              Outcome
            </Label>
            <select
              id={ids.status}
              value={status}
              onChange={(e) => setParam("status", e.target.value)}
              className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 font-mono text-sm text-muted-foreground">{subject}</p>
      </div>

      {/* Warnings ABOVE the figures, always. A number computed from a suspect
          population must not read as more authoritative than the doubt. */}
      {error ? (
        <p className="flex items-start gap-2 border-b-2 border-border bg-data-warn/8 px-6 py-4 text-base text-foreground/80 sm:px-8">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>{error}</span>
        </p>
      ) : null}
      {report.note ? (
        <p className="flex items-start gap-2 border-b-2 border-border bg-data-warn/8 px-6 py-4 text-base text-foreground/80 sm:px-8">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>{report.note}</span>
        </p>
      ) : null}

      <div className={cn("p-6 sm:p-8", loading && "opacity-60")} aria-busy={loading}>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {int(data.stats.n)} {data.stats.n === 1 ? "case" : "cases"} with a usable wage
        </p>

        {report.showMiddle ? (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: "5th percentile", v: data.stats.p5, gated: true },
                { label: "Median", v: data.stats.p50, gated: false },
                { label: "Average", v: data.stats.avg, gated: false },
                { label: "95th percentile", v: data.stats.p95, gated: true },
              ]
                .filter((c) => (c.gated ? report.showTails : true))
                .map((c) => (
                  <div
                    key={c.label}
                    className="min-w-0 flex-1 basis-52 border-2 border-border bg-background p-4"
                  >
                    <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {c.label}
                    </p>{" "}
                    <p className="mt-1 font-heading text-2xl font-black leading-none tabular-nums">
                      {usd(c.v)}
                    </p>
                  </div>
                ))}
            </div>
            <p className="mt-3 text-base text-foreground/70">
              Half of these cases fall between{" "}
              <b className="font-bold text-foreground tabular-nums">{usd(data.stats.p25)}</b> and{" "}
              <b className="font-bold text-foreground tabular-nums">{usd(data.stats.p75)}</b>, the
              25th and 75th percentiles.
            </p>

            {data.bins.length > 0 ? (
              <div className="mt-8">
                <h3 className="font-heading text-xl font-black">Where the wages land</h3>{" "}
                <p className="mt-2 text-base text-foreground/70">
                  Each bar is a {usd(data.binWidth)} band.
                  {data.below > 0 || data.above > 0 ? (
                    <>
                      {" "}
                      {int(data.below + data.above)} cases sit outside this range and are counted
                      but not drawn, so the axis is not stretched by a handful of outliers.
                    </>
                  ) : null}
                </p>
                <ol className="mt-4 space-y-1">
                  {data.bins.map((b) => (
                    // Fragment with an explicit space: mapped siblings arrive
                    // with nothing between them and would read as one run.
                    <Fragment key={b.from}>
                      {" "}
                      <li
                        className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 [&>*]:min-w-0 sm:grid-cols-[8rem_1fr_5rem] sm:gap-3"
                        aria-label={`${usd(b.from)} to ${usd(b.from + data.binWidth)}: ${int(b.count)} cases`}
                      >
                        <span className="text-sm tabular-nums text-foreground/70">{usd(b.from)}</span>{" "}
                        <span className="block h-5 w-full border-2 border-border bg-muted">
                          <span
                            className="block h-full bg-primary"
                            style={{ width: `${Math.max((b.count / maxBin) * 100, 1)}%` }}
                          />
                        </span>{" "}
                        <span className="text-right text-sm tabular-nums text-foreground/70">
                          {int(b.count)}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ol>
              </div>
            ) : null}

            {data.byState.length > 0 ? (
              <div className="mt-10">
                <h3 className="font-heading text-xl font-black">By worksite state</h3>{" "}
                <p className="mt-2 text-base text-foreground/70">
                  States with at least {MIN_FOR_MEDIAN} matching cases, most first.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[36rem] border-2 border-border text-left text-sm">
                    <thead className="bg-foreground text-background">
                      <tr>
                        {["State", "Cases", "5th", "Median", "Average", "95th"].map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={cn(
                              "px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider",
                              i > 0 && "text-right",
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.byState.map((r, i) => (
                        <tr
                          key={r.state}
                          className={cn("border-t-2 border-border", i % 2 === 1 && "bg-muted")}
                        >
                          <th scope="row" className="px-3 py-2 font-bold">
                            {r.state}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums">{int(r.n)}{" "}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.n >= 100 ? usd(r.p5) : "n/a"}
                          {" "}</td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">{usd(r.p50)}{" "}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{usd(r.avg)}{" "}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.n >= 100 ? usd(r.p95) : "n/a"}
                          {" "}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
