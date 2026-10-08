/**
 * How long DOL takes on an H-2A, H-2B or CW-1 application, and what that
 * means for one case still waiting. The pure half: the doc's shape and its
 * parser, and the arithmetic a case card draws. The figures are written by
 * scripts/build_seasonal_timing.py into perm_docs['seasonal_timing'] from
 * DOL's own decided cases; nothing here is a constant someone typed.
 *
 * TWO CLOCKS, CHOSEN BY THE RULES. An H-2A application is decided against the
 * first day of work: 20 CFR 655.160 has DOL decide it 30 days before then,
 * and DOL's certifications cluster there. So an H-2A case with a known first
 * day is placed against that day. H-2B and CW-1 have no such deadline and
 * their decisions land on both sides of the start date (a quarter of H-2B
 * certifications came after it), so they are placed against the filing date.
 */

import type { GroupPick } from "@/lib/h2bGroups";
import { seasonalForm, type SeasonalVisa } from "@/lib/seasonalForms";

export interface TimingPercentiles {
  n: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SeasonTiming {
  daysToDecision: TimingPercentiles | null;
  leadDays: TimingPercentiles | null;
}

export interface VisaTiming {
  daysToDecision: TimingPercentiles | null;
  leadDays: TimingPercentiles | null;
  decidedFrom: string | null;
  decidedTo: string | null;
  files: number;
  /** H-2A only: the share decided at least `deadlineDays` before the first day of work. */
  onTime?: { n: number; share: number; deadlineDays: number };
  /** The same two clocks per calendar quarter of receipt, keyed "2025-Q1". */
  seasons?: Record<string, SeasonTiming>;
  /**
   * The page reads the case's receipt quarter a year earlier instead of every
   * quarter pooled. Set by the builder for H-2B, where the backtest found the
   * pooled range held 21% of later decisions and the season's did better in
   * every quarter it could be tested on (scripts/backtest_seasonal.py).
   */
  useSeason?: boolean;
}

export type SeasonalTiming = Partial<Record<SeasonalVisa, VisaTiming>> & { asOf: string };

const VISAS: readonly SeasonalVisa[] = ["H-2A", "H-2B", "CW-1"];
const SEASON_KEY = /^\d{4}-Q[1-4]$/;
const QUARTER_MONTHS = ["January to March", "April to June", "July to September", "October to December"] as const;

/** The receipt quarter a year before a filing date's own: "2026-02-10" is "2025-Q1". */
export function seasonKeyFor(filingDate: string): string | null {
  if (!isDay(filingDate)) return null;
  const y = Number(filingDate.slice(0, 4));
  const q = Math.floor((Number(filingDate.slice(5, 7)) - 1) / 3) + 1;
  return `${y - 1}-Q${q}`;
}

/** "2025-Q1" as words: "January to March 2025". */
export function seasonLabel(key: string): string {
  const q = Number(key.slice(-1));
  return `${QUARTER_MONTHS[q - 1] ?? key} ${key.slice(0, 4)}`;
}
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

function pcts(v: unknown): TimingPercentiles | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const keys = ["n", "p10", "p25", "p50", "p75", "p90"] as const;
  if (!keys.every((k) => isInt(o[k]))) return null;
  const p = o as unknown as TimingPercentiles;
  // Percentiles must rise, or the doc is not what the builder writes.
  if (!(p.p10 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90) || p.n < 1) return null;
  return { n: p.n, p10: p.p10, p25: p.p25, p50: p.p50, p75: p.p75, p90: p.p90 };
}

/** The doc, or null when it is missing, unreadable or carries no usable visa. */
export function parseSeasonalTiming(json: string): SeasonalTiming | null {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const out: SeasonalTiming = { asOf: typeof o.asOf === "string" ? o.asOf : "" };
  for (const visa of VISAS) {
    const b = o[visa];
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    const block: VisaTiming = {
      daysToDecision: pcts(r.daysToDecision),
      leadDays: pcts(r.leadDays),
      decidedFrom: isDay(r.decidedFrom) ? r.decidedFrom.slice(0, 10) : null,
      decidedTo: isDay(r.decidedTo) ? r.decidedTo.slice(0, 10) : null,
      files: isInt(r.files) ? r.files : 0,
    };
    if (r.seasons && typeof r.seasons === "object") {
      const seasons: Record<string, SeasonTiming> = {};
      for (const [key, v] of Object.entries(r.seasons as Record<string, unknown>)) {
        if (!SEASON_KEY.test(key) || !v || typeof v !== "object") continue;
        const sv = v as Record<string, unknown>;
        const season = { daysToDecision: pcts(sv.daysToDecision), leadDays: pcts(sv.leadDays) };
        if (season.daysToDecision || season.leadDays) seasons[key] = season;
      }
      if (Object.keys(seasons).length) block.seasons = seasons;
    }
    if (r.useSeason === true) block.useSeason = true;
    const ot = r.onTime as Record<string, unknown> | undefined;
    if (ot && isInt(ot.n) && typeof ot.share === "number" && ot.share >= 0 && ot.share <= 1 && isInt(ot.deadlineDays)) {
      block.onTime = { n: ot.n, share: ot.share, deadlineDays: ot.deadlineDays };
    }
    if (block.daysToDecision || block.leadDays) out[visa] = block;
  }
  return VISAS.some((v) => out[v]) ? out : null;
}

/** Applications only: a wage request or a job order is not decided on these clocks. */
const APPLICATION = /^(?:H-300|H-400|C-500)-/;

/**
 * Is this application still waiting on DOL's first decision? An appeal and a
 * post-certification request come after one, so "when DOL usually decides"
 * counted from filing would date something that already happened.
 */
export function awaitingFirstDecision(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return !(s.includes("APPEAL") || s.includes("POST-CERT"));
}

export interface TimingView {
  visa: SeasonalVisa;
  /** "start": counted back from the first day of work; "filed": forward from the filing date. */
  basis: "start" | "filed";
  n: number;
  decidedFrom: string | null;
  decidedTo: string | null;
  /** p10, p25, p50, p75 and p90 as calendar dates for this case, earliest first. */
  early: string;
  from: string;
  typical: string;
  to: string;
  late: string;
  /** The middle half and the typical case, in days (before the start, or since filing). */
  days: { from: number; typical: number; to: number };
  /** H-2A, start basis: the day 20 CFR 655.160 sets, 30 days before the first day of work. */
  ruleDay: string | null;
  /** Today, YYYY-MM-DD, so a label clamped to the bar's edge can say its own date. */
  today: string;
  /** Where today falls on the early-to-late span, 0 to 1, clamped. */
  todayAt: number;
  /** Today is past the 75th percentile's date: three in four certified cases were decided by now. */
  pastMost: boolean;
  /** H-2A, start basis: the share DOL decided at least 30 days before the first day of work. */
  onTimeShare: number | null;
  /** When the figures are one receipt quarter's, not every quarter pooled: which, in words. */
  season: string | null;
  /** An H-2B application in one of DOL's assignment groups: the group's own figures. */
  group: GroupPick | null;
}


function addDays(day: string, n: number): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);

/**
 * The card's numbers for one pending application, or null when there is no
 * measured basis for it: not an application, no doc for its visa, or no date
 * to count from. Null is the honest answer; the card then says nothing.
 */
export function timingView(args: {
  caseNumber: string;
  filingDate: string | null;
  firstDay: string | null;
  today: string;
  timing: SeasonalTiming | null;
  /**
   * The case's H-2B assignment group and its estimate (src/lib/h2bGroups.ts).
   * When present it wins: the group was typically 5 days off on January 2026,
   * the season pooled 25 (scripts/backtest_seasonal.py, its h2bGroups section).
   */
  group?: GroupPick | null;
}): TimingView | null {
  const { caseNumber, filingDate, firstDay, today, timing } = args;
  if (!APPLICATION.test(caseNumber.trim().toUpperCase())) return null;
  const visa = seasonalForm(caseNumber)?.visa;
  const g = args.group ?? null;
  if (g && visa === "H-2B" && filingDate && isDay(filingDate)) {
    const d = g.days;
    const at = (n: number) => addDays(filingDate, n);
    return finish({
      visa, basis: "filed", p: { n: 0, p10: d.p10, p25: d.p25, p50: d.p50, p75: d.p75, p90: d.p90 },
      // The decided-window line reads the visa's pooled block when there is one.
      block: timing?.["H-2B"] ?? ({ decidedFrom: null, decidedTo: null } as unknown as VisaTiming),
      early: at(d.p10), from: at(d.p25), typical: at(d.p50), to: at(d.p75), late: at(d.p90), today,
      days: { from: d.p25, typical: d.p50, to: d.p75 }, ruleDay: null, group: g,
    });
  }
  if (!timing) return null;
  const block = visa ? timing[visa] : undefined;
  if (!visa || !block) return null;

  let basis: "start" | "filed";
  let at: (days: number) => string;
  let p: TimingPercentiles;
  if (visa === "H-2A" && firstDay && isDay(firstDay) && block.leadDays) {
    // Counted back from the first day: the 90th percentile of lead time is the
    // EARLIEST decision date, so the order flips.
    basis = "start";
    p = block.leadDays;
    at = (d) => addDays(firstDay, -d);
    const [early, from, typical, to, late] = [p.p90, p.p75, p.p50, p.p25, p.p10].map(at) as [
      string, string, string, string, string,
    ];
    return finish({
      visa, basis, p, block, early, from, typical, to, late, today,
      days: { from: p.p75, typical: p.p50, to: p.p25 },
      ruleDay: block.onTime ? at(block.onTime.deadlineDays) : null,
    });
  }
  if (!filingDate || !isDay(filingDate)) return null;
  // The season a year earlier when the builder says this visa runs on one,
  // and that season reached the floor; every quarter pooled otherwise.
  const key = block.useSeason ? seasonKeyFor(filingDate) : null;
  const seasonal = key ? block.seasons?.[key]?.daysToDecision ?? null : null;
  const pooled = block.daysToDecision;
  if (!seasonal && !pooled) return null;
  basis = "filed";
  p = (seasonal ?? pooled)!;
  at = (d) => addDays(filingDate, d);
  const [early, from, typical, to, late] = [p.p10, p.p25, p.p50, p.p75, p.p90].map(at) as [
    string, string, string, string, string,
  ];
  return finish({
    visa, basis, p, block, early, from, typical, to, late, today,
    days: { from: p.p25, typical: p.p50, to: p.p75 },
    ruleDay: null,
    season: seasonal && key ? seasonLabel(key) : null,
  });
}

function finish(a: {
  visa: SeasonalVisa;
  basis: "start" | "filed";
  p: TimingPercentiles;
  block: VisaTiming;
  early: string;
  from: string;
  typical: string;
  to: string;
  late: string;
  today: string;
  days: { from: number; typical: number; to: number };
  ruleDay: string | null;
  season?: string | null;
  group?: GroupPick | null;
}): TimingView {
  const span = dayNumber(a.late) - dayNumber(a.early);
  const raw = span > 0 ? (dayNumber(a.today) - dayNumber(a.early)) / span : 0;
  return {
    visa: a.visa,
    basis: a.basis,
    n: a.p.n,
    decidedFrom: a.block.decidedFrom,
    decidedTo: a.block.decidedTo,
    early: a.early,
    from: a.from,
    typical: a.typical,
    to: a.to,
    late: a.late,
    days: a.days,
    ruleDay: a.ruleDay,
    today: a.today,
    todayAt: Math.min(1, Math.max(0, raw)),
    pastMost: a.today > a.to,
    onTimeShare: a.basis === "start" && a.block.onTime ? a.block.onTime.share : null,
    season: a.season ?? null,
    group: a.group ?? null,
  };
}

/** How the page's own method did on past seasons: perm_docs['seasonal_backtest']. */
export type SeasonalCheck = Partial<Record<SeasonalVisa, { share: number; cases: number; quarters: number }>> & {
  /** The H-2B assignment-group method on the newest season DOL has finished. */
  groups?: { share: number; cases: number; quarters: number; typicalMissDays: number; season: string };
};

/** The backtest's summary per visa, or null when it is missing or unreadable. */
export function parseSeasonalCheck(json: string): SeasonalCheck | null {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  const visas = (d as { visas?: unknown } | null)?.visas;
  if (!visas || typeof visas !== "object") return null;
  const out: SeasonalCheck = {};
  for (const visa of VISAS) {
    const page = ((visas as Record<string, unknown>)[visa] as { page?: Record<string, unknown> } | undefined)?.page;
    if (!page) continue;
    const share = page.middleHalfShare;
    const cases = page.cases;
    const quarters = page.quarters;
    if (typeof share === "number" && share >= 0 && share <= 1 && isInt(cases) && cases > 0 && isInt(quarters)) {
      out[visa] = { share, cases, quarters };
    }
  }
  const tests = (d as { h2bGroups?: unknown[] } | null)?.h2bGroups;
  const g = (Array.isArray(tests) ? tests[tests.length - 1] : undefined) as
    | { season?: string; decided?: number; groups?: { middleHalfShare?: number; typicalMissDays?: number } }
    | undefined;
  if (g && typeof g.season === "string" && isInt(g.decided) && g.decided > 0 && typeof g.groups?.middleHalfShare === "number"
      && typeof g.groups.typicalMissDays === "number") {
    out.groups = { share: g.groups.middleHalfShare, cases: g.decided, quarters: 1, typicalMissDays: g.groups.typicalMissDays, season: g.season };
  }
  return Object.keys(out).length ? out : null;
}

/** Today's date in Eastern time, YYYY-MM-DD: after 8 PM Eastern the UTC date is already tomorrow. */
export function easternDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
