"use client";

import { FinePrint } from "@/components/data/FinePrint";
import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { PlusIcon, WarningIcon, XIcon } from "@phosphor-icons/react";

import { ChartTips } from "@/components/data/ChartTips";
import { Label } from "@/components/ui/label";
import { SelectedInFull } from "@/components/tools/SelectedInFull";
import { WEIGHTED_ESTIMATE } from "@/lib/h1bLottery";
import {
  LOTTERY_RULE,
  levelAtSite,
  lotteryLevel,
  oddsAt,
  parseOffer,
  timesWord,
  type LotteryLevel,
  type PayUnit,
  type SiteLevel,
} from "@/lib/h1bLotteryCalc";
import { US_STATE_NAMES } from "@/lib/usStateNames";
import { seriesYearFor, WAGE_SEARCH_PAGE, type AreaOption, type WageLevel } from "@/lib/wageLevels";
import { SOC_CODE_RE, socGroup } from "@/lib/socCode";
import { buttonVariants } from "@/components/ui/button";
import { ScrollBox } from "@/components/ui/scroll-box";
import { SocPicker } from "@/components/soc/SocPicker";

/**
 * The weighted H-1B lottery for one job: the OEWS level an offer meets in
 * each work area, read live from DOL's wage search through this site's
 * cached route, the level the rule assigns, and DHS's estimate of the odds
 * at that level. The arithmetic is `lib/h1bLotteryCalc.ts`; this file only
 * asks DOL and lays the answer out.
 */

const FIELD =
  "mt-1.5 min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const MAX_SITES = 3;

const STATES = Object.entries(US_STATE_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const usd = (n: number, unit: PayUnit) =>
  `${n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: unit === "hour" ? 2 : 0, minimumFractionDigits: unit === "hour" ? 2 : 0 })}${unit === "hour" ? " an hour" : " a year"}`;

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

interface Site {
  key: number;
  state: string;
  area: string;
  areaLabel: string;
}

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "done";
      unit: PayUnit;
      offer: number;
      seriesYear: number;
      soc: string;
      sites: { label: string; levels: WageLevel[] | null; at: SiteLevel | null }[];
    };

function Worksite({
  index,
  site,
  seriesYear,
  onChange,
  onRemove,
}: {
  index: number;
  site: Site;
  seriesYear: number;
  onChange: (s: Site) => void;
  onRemove: (() => void) | null;
}) {
  const stateId = useId();
  const areaId = useId();
  const [areas, setAreas] = useState<AreaOption[] | null>(null);
  const stateName = STATES.find((s) => s.code === site.state)?.name ?? "";

  useEffect(() => {
    if (!stateName) {
      setAreas(null);
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
        const first = list[0];
        onChange({ ...site, area: first ? String(first.value) : "", areaLabel: first?.label ?? "" });
      })
      .catch(() => {
        if (live) setAreas([]);
      });
    return () => {
      live = false;
    };
    // `site` and `onChange` change on every keystroke elsewhere; the areas depend on the state and series only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateName, seriesYear]);

  return (
    <div className="grid grid-cols-1 gap-3 bg-sage p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end [&>*]:min-w-0 border-2 border-border">
      <div>
        <Label htmlFor={stateId}>{index === 0 ? "Work state" : `Work state ${index + 1}`}</Label>{" "}
        <select
          id={stateId}
          value={site.state}
          onChange={(e) => onChange({ ...site, state: e.target.value, area: "", areaLabel: "" })}
          className={FIELD}
        >
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
        <select
          id={areaId}
          value={site.area}
          onChange={(e) =>
            onChange({ ...site, area: e.target.value, areaLabel: areas?.find((a) => String(a.value) === e.target.value)?.label ?? "" })
          }
          className={FIELD}
          disabled={!areas || areas.length === 0}
        >
          {!stateName ? <option value="">Choose a state first</option> : null}
          {stateName && areas === null ? <option value="">Loading DOL&apos;s areas</option> : null}
          {areas && areas.length === 0 && stateName ? <option value="">DOL lists no areas</option> : null}
          {(areas ?? []).map((a) => (
            <option key={a.value} value={String(a.value)}>
              {a.label}
            </option>
          ))}
        </select>{" "}
        <SelectedInFull label={site.areaLabel || undefined} />
      </div>{" "}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className={buttonVariants({ variant: "outline", size: "default", className: "justify-center" })}
          aria-label={`Remove worksite ${index + 1}`}
        >
          <XIcon size={16} weight="bold" aria-hidden="true" /> Remove
        </button>
      ) : null}
    </div>
  );
}

export function H1bLotteryCalculator() {
  const socId = useId();
  const offerId = useId();
  const unitId = useId();
  const yearId = useId();
  const currentSeries = useMemo(() => seriesYearFor(new Date().toISOString().slice(0, 10)), []);
  const [soc, setSoc] = useState("");
  const [offerRaw, setOfferRaw] = useState("");
  const [unit, setUnit] = useState<PayUnit>("year");
  const [seriesYear, setSeriesYear] = useState(currentSeries);
  const [sites, setSites] = useState<Site[]>([{ key: 0, state: "", area: "", areaLabel: "" }]);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const offer = parseOffer(offerRaw);
  const ready =
    SOC_CODE_RE.test(soc.trim()) && offer !== null && sites.every((s) => s.area !== "") && result.kind !== "loading";

  async function calculate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || offer === null) return;
    setResult({ kind: "loading" });
    try {
      const answers = await Promise.all(
        sites.map(async (s) => {
          const res = await fetch(`/api/wage-levels?soc=${encodeURIComponent(soc.trim())}&area=${s.area}&year=${seriesYear}`);
          const j = (await res.json().catch(() => null)) as { ok?: boolean; levels?: WageLevel[] | null; message?: string } | null;
          if (!res.ok || !j?.ok) throw new Error(j?.message ?? "DOL could not be reached. Try again in a moment.");
          return { label: s.areaLabel || s.area, levels: j.levels ?? null };
        }),
      );
      setResult({
        kind: "done",
        unit,
        offer,
        seriesYear,
        soc: socGroup(soc) ?? "",
        sites: answers.map((a) => ({ ...a, at: a.levels ? levelAtSite(offer, unit, a.levels) : null })),
      });
    } catch (err) {
      setResult({ kind: "error", message: err instanceof Error ? err.message : "That did not go through." });
    }
  }

  const done = result.kind === "done" ? result : null;
  const missing = done ? done.sites.filter((s) => !s.at) : [];
  const assigned = done && missing.length === 0 ? lotteryLevel(done.sites.map((s) => s.at!)) : null;
  const odds = assigned ? oddsAt(assigned.level) : null;
  const limitingSite = done && assigned ? done.sites[assigned.limiting]! : null;

  return (
    <div className="object p-5 sm:p-8">
      <form onSubmit={calculate} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <div>
            <Label htmlFor={socId}>Job title or SOC code</Label>{" "}
            <SocPicker id={socId} value={soc} onChange={setSoc} className={FIELD} />{" "}
            <p className="mt-1 text-sm text-muted-foreground">Type a job title and pick its code, or the code on the LCA.</p>
          </div>{" "}
          <div>
            <Label htmlFor={offerId}>Offered wage</Label>{" "}
            <input
              id={offerId}
              value={offerRaw}
              onChange={(e) => setOfferRaw(e.target.value)}
              placeholder={unit === "hour" ? "52.50" : "120000"}
              inputMode="decimal"
              className={FIELD}
            />{" "}
            <p className="mt-1 text-sm text-muted-foreground">A range counts by its lowest wage.</p>
          </div>{" "}
          <div>
            <Label htmlFor={unitId}>Paid</Label>{" "}
            <select id={unitId} value={unit} onChange={(e) => setUnit(e.target.value as PayUnit)} className={FIELD}>
              <option value="year">per year</option>
              <option value="hour">per hour</option>
            </select>
          </div>{" "}
          <div>
            <Label htmlFor={yearId}>Wage series</Label>{" "}
            <select id={yearId} value={seriesYear} onChange={(e) => setSeriesYear(Number(e.target.value))} className={FIELD}>
              {[currentSeries, currentSeries - 1].map((y) => (
                <option key={y} value={y}>
                  July {y} to June {y + 1}
                </option>
              ))}
            </select>{" "}
            <p className="mt-1 text-sm text-muted-foreground">The one current when the registration is filed.</p>
          </div>
        </div>{" "}
        <div className="space-y-3">
          {sites.map((s, i) => (
            <Fragment key={s.key}>
              {" "}
              <Worksite
                index={i}
                site={s}
                seriesYear={seriesYear}
                onChange={(next) => setSites((all) => all.map((x) => (x.key === s.key ? next : x)))}
                onRemove={i > 0 ? () => setSites((all) => all.filter((x) => x.key !== s.key)) : null}
              />
            </Fragment>
          ))}
        </div>{" "}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!ready}
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            {result.kind === "loading" ? "Asking DOL" : "Work out the level and the odds"}
          </button>{" "}
          {sites.length < MAX_SITES ? (
            <button
              type="button"
              onClick={() => setSites((all) => [...all, { key: Math.max(...all.map((x) => x.key)) + 1, state: "", area: "", areaLabel: "" }])}
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              <PlusIcon size={16} weight="bold" aria-hidden="true" /> Add another worksite
            </button>
          ) : null}
        </div>
      </form>

      {result.kind === "error" ? (
        <p className="mt-5 flex items-start gap-2 border-2 border-data-bad bg-soft-bad p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {result.message}
        </p>
      ) : null}

      {done && missing.length > 0 ? (
        <p className="mt-5 flex items-start gap-2 border-2 border-data-warn bg-soft-wait p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> DOL publishes no OEWS wage
          for SOC {done.soc} in {missing.map((m) => m.label).join(" or ")} for this series. The rule then has the registrant
          pick the level from the job&apos;s requirements under DOL&apos;s prevailing wage guidance, which this page can&apos;t
          judge.
        </p>
      ) : null}

      {!done ? (
        <div className="mt-6 border-t-2 border-border pt-5">
          <p className="mb-3 text-sm font-bold text-muted-foreground">
            DHS&apos;s estimated chance at each wage level, against {WEIGHTED_ESTIMATE.randomPercent}% for everyone under
            the old random draw (the dashed line). The lookup marks the level your job lands on.
          </p>{" "}
          <LevelOdds />
        </div>
      ) : null}{" "}

      {done && assigned && odds && limitingSite ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="bg-sage p-5 border-2 border-border">
              <p className="text-sm font-bold text-muted-foreground">The level the rule assigns</p>{" "}
              <p className="mt-1 font-heading text-4xl font-bold">Level {assigned.level}</p>{" "}
              <p className="mt-1 text-base">Entered in the draw {timesWord(odds.entries)}.</p>
            </div>{" "}
            <div className="bg-sage p-5 border-2 border-border">
              <p className="text-sm font-bold text-muted-foreground">DHS&apos;s estimated chance at that level</p>{" "}
              <p className="mt-1 font-heading text-4xl font-bold tabular-nums">{odds.percent.toFixed(1)}%</p>{" "}
              <p className="mt-1 text-base">Against {WEIGHTED_ESTIMATE.randomPercent}% for everyone under the old random draw (the dashed line).</p>
            </div>
          </div>{" "}
          <LevelOdds assigned={assigned.level} />{" "}
          <ScrollBox label="The level met at each worksite" className="border-t-2 border-[var(--object-border)]">
            <table className="w-full min-w-[560px] text-left text-base">
              <thead className="border-b-2 border-border bg-sage">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Worksite{" "}</th>
                  <th scope="col" className="px-3 py-2 font-bold">Level met{" "}</th>
                  <th scope="col" className="px-3 py-2 font-bold">Next level starts at{" "}</th>
                </tr>
              </thead>
              <tbody>
                {done.sites.map((s, i) => (
                  <tr key={`${s.label}-${i}`} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-3 py-2 font-bold">
                      {s.label}
                      {done.sites.length > 1 && i === assigned.limiting ? " (sets the level)" : ""}{" "}
                    </th>
                    <td className="px-3 py-2">
                      {s.at ? `Level ${s.at.level}${s.at.belowLevelI ? " (under level I, counted as I)" : ""}` : "No OEWS wage"}{" "}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {s.at?.next ? `Level ${s.at.next.level}: ${usd(s.at.next.amount, done.unit)}` : s.at ? "Top level" : ""}{" "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>{" "}
          <p className="text-sm leading-relaxed text-soft">
            {usd(done.offer, done.unit)} for SOC {done.soc}, against DOL&apos;s figures for the July {done.seriesYear} to June{" "}
            {done.seriesYear + 1} series, read just now from the{" "}
            <a href={WAGE_SEARCH_PAGE} rel="noopener noreferrer" className="link">
              OFLC wage search
            </a>
            .{" "}
            {assignedNote(assigned.level, limitingSite.at!, done.sites.length)}
          </p>{" "}
          <FinePrint summary="Where the percentages come from">
            <p>
              The level rule is {LOTTERY_RULE.cfr}, and the percentages are DHS&apos;s estimate in the same rule,{" "}
              <a href={LOTTERY_RULE.source} rel="noopener noreferrer" className="link">
                {WEIGHTED_ESTIMATE.citation}
              </a>
              , in effect from {longDate(LOTTERY_RULE.effective)}, read {longDate(LOTTERY_RULE.read)}. DHS worked them out from past petitions assuming
              employers keep their wages, before any weighted lottery had run; USCIS hasn&apos;t published results by level.
              A person registered by several employers is entered at the lowest level among them.
            </p>
          </FinePrint>
        </div>
      ) : null}
    </div>
  );
}

function assignedNote(level: LotteryLevel, at: SiteLevel, siteCount: number): string {
  const parts: string[] = [];
  if (at.belowLevelI) parts.push("The offer is under DOL's level I figure, which the rule allows when the wage comes from another source, and enters as level I.");
  if (siteCount > 1) parts.push(`With several worksites the rule takes the lowest level the offer meets, here level ${level}.`);
  return parts.join(" ");
}

/**
 * DHS's estimated chance at each wage level, as bars against the old random
 * draw. It doesn't depend on the reader's input, so it shows before a lookup
 * too; the lookup only marks the level the rule assigns.
 */
function LevelOdds({ assigned }: { assigned?: string }) {
  return (
    <ChartTips label="DHS's estimated chance at each wage level">
    <ul className="space-y-3" aria-label="DHS's estimate at each level">
      {WEIGHTED_ESTIMATE.levels.map((l) => (
        <Fragment key={l.level}>
          {" "}
          <li
            data-tip={`Level ${l.level}${l.level === assigned ? ", the level the rule assigns" : ""}\n${l.percent.toFixed(1)}% estimated chance\nEntered in the draw ${timesWord(l.entries)}\n${WEIGHTED_ESTIMATE.randomPercent}% under the old random draw`}
            className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 [&>*]:min-w-0"
          >
            <span className={l.level === assigned ? "font-heading text-lg font-bold" : "text-base font-bold text-muted-foreground"}>
              Level {l.level}
            </span>{" "}
            <span className="relative block h-7 border-input bg-sage border" aria-hidden="true">
              {/* The level the rule assigns in lime with a dark green edge, the
                  others in soft green (round 3: no black or grey bars). */}
              <span
                className={`absolute inset-y-0 left-0 ${l.level === assigned ? "border-2 border-data-good-ink bg-primary" : "bg-chart-green"}`}
                style={{ width: `${l.percent}%` }}
              />
              <span
                className="absolute inset-y-0 border-l-2 border-dashed border-data-info-ink"
                style={{ left: `${WEIGHTED_ESTIMATE.randomPercent}%` }}
              />
            </span>{" "}
            <span className="text-right font-bold tabular-nums">{l.percent.toFixed(1)}%</span>
          </li>
        </Fragment>
      ))}
    </ul>
    </ChartTips>
  );
}
