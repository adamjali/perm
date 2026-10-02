/**
 * The H-1B lottery level for one offered wage, and DHS's estimate of the odds
 * at that level: the pure half of /tools/h1b-lottery-odds-calculator.
 *
 * THE RULE, from the registration requirements DHS wrote into 8 CFR
 * 214.2(h)(8)(iii)(A)(4) (90 FR 60864, Dec. 29, 2025, effective Feb. 27, 2026):
 *
 * - the registrant selects "the highest OEWS wage level that the
 *   beneficiary's proffered wage equals or exceeds for the relevant SOC code
 *   in the area(s) of intended employment";
 * - a wage "lower than OEWS wage level I", because it rests on another
 *   legitimate source, is entered as level I;
 * - with several work locations, "the lowest corresponding OEWS wage level
 *   that the beneficiary's proffered wage will equal or exceed";
 * - a wage range is judged by its lowest wage;
 * - USCIS enters a beneficiary four times at level IV, three at III, twice at
 *   II and once at I, and a beneficiary with several registrations at the
 *   lowest level among them.
 *
 * Every dollar figure comes from DOL's wage search (`lib/wageLevels.ts`);
 * every percent from DHS's estimate in the same rule (`lib/h1bLottery.ts`).
 * Nothing here is fitted or predicted.
 */

import { WEIGHTED_ESTIMATE } from "./h1bLottery";
import type { WageLevel } from "./wageLevels";

export type LotteryLevel = "I" | "II" | "III" | "IV";
/** DOL's wage search answers per hour and per year; an offer is compared in its own unit. */
export type PayUnit = "year" | "hour";

const ORDER: readonly LotteryLevel[] = ["I", "II", "III", "IV"];

export const LOTTERY_RULE = {
  cfr: "8 CFR 214.2(h)(8)(iii)(A)(4)",
  source: WEIGHTED_ESTIMATE.source,
  citation: "90 FR 60864 (Dec. 29, 2025), regulatory text at 60964-60965",
  effective: WEIGHTED_ESTIMATE.effective,
  read: "2026-10-01",
} as const;

export interface SiteLevel {
  level: LotteryLevel;
  /** The offer is under DOL's level I figure here; the rule enters it as level I. */
  belowLevelI: boolean;
  /** What the offer would have to reach here for the next level up, in the offer's unit; null at level IV. */
  next: { level: LotteryLevel; amount: number } | null;
}

/** A positive, finite offer, or null. */
export function parseOffer(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The level an offer meets at one worksite, from DOL's four figures there. */
export function levelAtSite(offer: number, unit: PayUnit, levels: readonly WageLevel[]): SiteLevel {
  const figure = (l: WageLevel) => (unit === "hour" ? l.hourly : l.yearly);
  const byLevel = new Map(levels.map((l) => [l.level, figure(l)]));
  let met: LotteryLevel | null = null;
  for (const lv of ORDER) {
    const f = byLevel.get(lv);
    if (f !== undefined && offer >= f) met = lv;
  }
  const level = met ?? "I";
  const idx = ORDER.indexOf(level);
  const nextLevel = idx < ORDER.length - 1 ? ORDER[idx + 1]! : null;
  // Below level I the next step is level II, the first the offer doesn't
  // already get by the rule.
  const nextAmount = nextLevel ? byLevel.get(nextLevel) : undefined;
  return {
    level,
    belowLevelI: met === null,
    next: nextLevel && nextAmount !== undefined ? { level: nextLevel, amount: nextAmount } : null,
  };
}

/** Several worksites: the lowest level among them, and which site set it. */
export function lotteryLevel(sites: readonly SiteLevel[]): { level: LotteryLevel; limiting: number } | null {
  if (sites.length === 0) return null;
  let limiting = 0;
  for (let i = 1; i < sites.length; i++) {
    if (ORDER.indexOf(sites[i]!.level) < ORDER.indexOf(sites[limiting]!.level)) limiting = i;
  }
  return { level: sites[limiting]!.level, limiting };
}

/** How many times the level is entered, and DHS's estimated chance of selection at it. */
export function oddsAt(level: LotteryLevel): { entries: number; percent: number } {
  const row = WEIGHTED_ESTIMATE.levels.find((l) => l.level === level)!;
  return { entries: row.entries, percent: row.percent };
}

export function timesWord(entries: number): string {
  return entries === 1 ? "once" : entries === 2 ? "twice" : `${["three", "four"][entries - 3] ?? entries} times`;
}
