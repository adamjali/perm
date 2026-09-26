/**
 * How many people stand ahead of one priority date in an employment-based
 * green-card line, counted from what the agencies publish.
 *
 * A plain module (no `server-only`) because the calculator recomputes this in
 * the browser every time the reader changes a select, the same reason
 * `queueAhead.ts` and `bulletinNext.ts` sit outside the server boundary.
 *
 * THE LINE HAS THREE PARTS, AND ONE OF THEM HAS NO PRIORITY DATES ON IT.
 *
 *   1. Approved and waiting for the bulletin. USCIS counts every approved I-140
 *      (and I-360, I-526) whose priority date is not yet current, by category
 *      and country, each quarter. That count is the anchor: it is USCIS's own
 *      number, and nothing here changes its total. What USCIS does NOT publish
 *      is where those priority dates fall, so the count is spread across
 *      priority dates by the SHAPE of I-140 approvals by receipt year, shifted
 *      back by the time the PERM took (a priority date is the day DOL received
 *      the PERM, 8 CFR 204.5(d), and the I-140 comes after the certification).
 *   2. Waiting for I-140 approval. Pending I-140s, by receipt year, times the
 *      approval rate the same file shows for complete years, placed the same way.
 *   3. Already current, not yet finished. USCIS's monthly I-485 inventory of
 *      applications whose visa number is available: everyone in it has an
 *      earlier priority date than anyone still waiting.
 *
 * Parts 1 and 2 are principals (USCIS: "The counts of approved petitions
 * represent only primary beneficiaries"), so they are multiplied by the people
 * per principal DHS measured when these categories got green cards. Part 3 is
 * already people: each family member files an I-485.
 *
 * WHAT IS DELIBERATELY LEFT OUT, and each one is said on the page:
 *   - PERMs still at DOL with an earlier priority date (they will join ahead);
 *   - consular cases already current and not yet issued;
 *   - duplicates: USCIS says one person can hold several petitions, which
 *     overcounts;
 *   - people who give up, port to another category or get a green card another
 *     way. Nobody publishes that rate, so no rate is assumed.
 *
 * Nothing here forecasts a bulletin. "Years at FY2024's pace" divides the count
 * by the visas the category actually issued to that country in FY2024 (State's
 * Table V), which is a measurement of one past year, labelled as such.
 */

import type { CountryKey, Cutoff } from "@/lib/perm";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type LineCategory = "EB2" | "EB3" | "EW3";
export const LINE_CATEGORIES: readonly LineCategory[] = ["EB2", "EB3", "EW3"];

export const LINE_CATEGORY_LABEL: Record<LineCategory, string> = {
  EB2: "EB-2",
  EB3: "EB-3 (professional and skilled)",
  EW3: "EB-3 Other Workers",
};

/** Countries in the order readers most often ask about them. */
export const LINE_COUNTRIES: readonly CountryKey[] = ["india", "china", "philippines", "mexico", "worldwide"];

export const LINE_COUNTRY_LABEL: Record<CountryKey, string> = {
  india: "India",
  china: "China (mainland born)",
  philippines: "Philippines",
  mexico: "Mexico",
  worldwide: "Rest of the world",
};

/**
 * USCIS's I-140 workbook names five countries plus "All Countries". Mexico and
 * the rest of the world have no column of their own, so both take the SHAPE of
 * "All Countries" less China, India and the Philippines. Only the shape is used
 * (the total is USCIS's own awaiting count per country), so sharing it moves
 * where the people sit, never how many there are.
 */
export type ProfileBucket = "china" | "india" | "philippines" | "rowmex";
export const PROFILE_BUCKET: Record<CountryKey, ProfileBucket> = {
  china: "china",
  india: "india",
  philippines: "philippines",
  mexico: "rowmex",
  worldwide: "rowmex",
};

export type I140Class = "E21" | "NIW" | "E31" | "E32" | "EW3";
export type Preference = "EB2" | "EB3";

/** The I-140 approval classes that make up each line. */
export const LINE_CLASSES: Record<LineCategory, readonly I140Class[]> = {
  EB2: ["E21", "NIW"],
  EB3: ["E31", "E32"],
  EW3: ["EW3"],
};

/** The classes USCIS's pending and denied columns are reported across. */
export const PREFERENCE_CLASSES: Record<Preference, readonly I140Class[]> = {
  EB2: ["E21", "NIW"],
  EB3: ["E31", "E32", "EW3"],
};

export const PREFERENCE_OF: Record<LineCategory, Preference> = { EB2: "EB2", EB3: "EB3", EW3: "EB3" };

// ---------------------------------------------------------------------------
// Published constants, each with its source
// ---------------------------------------------------------------------------

/**
 * People who got a green card per principal, DHS Yearbook of Immigration
 * Statistics, Table 7 (persons obtaining lawful permanent resident status by
 * class of admission), fiscal years 2023 and 2024. The two years are the range.
 *
 *   EB-2  FY2023 55,790 / 27,760 = 2.01   FY2024 46,590 / 22,370 = 2.08
 *   EB-3  FY2023 49,140 / 24,030 = 2.045 FY2024 38,680 / 19,010 = 2.035
 *   EW3   FY2023  8,180 /  3,560 = 2.30  FY2024  9,880 /  3,980 = 2.48
 *
 * Principals are E21+E26, E31+E36+E32+E37 and EW3+EW8; dependants are the
 * spouse and child classes printed beside them. DHS rounds cells to the
 * nearest ten.
 */
export const FAMILY_SIZE: Record<LineCategory, { low: number; high: number }> = {
  EB2: { low: 2.01, high: 2.08 },
  EB3: { low: 2.035, high: 2.045 },
  EW3: { low: 2.3, high: 2.48 },
};

/**
 * Share of each category's green cards that were adjustments of status inside
 * the US rather than visas issued abroad, same DHS Table 7, FY2023 and FY2024.
 * USCIS's I-485 inventory can only ever count the adjusting share, so the
 * check against it is a fair comparison only where adjusting dominates.
 *
 *   EB-2  FY2023 0.898   FY2024 0.778
 *   EB-3  FY2023 0.545   FY2024 0.579
 *   EW3   FY2023 0.408   FY2024 0.273
 *
 * DHS publishes no split by country, so India and the Philippines share one
 * figure here even though their mix surely differs.
 */
export const ADJUSTMENT_SHARE: Record<LineCategory, { low: number; high: number }> = {
  EB2: { low: 0.778, high: 0.898 },
  EB3: { low: 0.545, high: 0.579 },
  EW3: { low: 0.273, high: 0.408 },
};

/** A check is judged only where at least this share of the line adjusts inside the US. */
export const CHECK_MIN_ADJUSTMENT = 0.75;

export const FAMILY_SIZE_SOURCES = [
  "https://ohss.dhs.gov/topics/immigration/yearbook/2024",
  "https://ohss.dhs.gov/topics/immigration/yearbook/2023/table7",
] as const;

/**
 * Days from PERM filing to certification, median over certified cases by the
 * fiscal quarter DOL decided them, measured 2026-09-26 from DOL's disclosure
 * files (FY2024 through FY2026 Q3) as loaded in this site's perm_cases table.
 */
export const PERM_DAYS_BY_DECISION_QUARTER: ReadonlyArray<{ fy: number; q: number; days: number }> = [
  { fy: 2024, q: 1, days: 348 },
  { fy: 2024, q: 2, days: 397 },
  { fy: 2024, q: 3, days: 383 },
  { fy: 2024, q: 4, days: 415 },
  { fy: 2025, q: 1, days: 455 },
  { fy: 2025, q: 2, days: 493 },
  { fy: 2025, q: 3, days: 495 },
  { fy: 2025, q: 4, days: 468 },
  { fy: 2026, q: 1, days: 498 },
  { fy: 2026, q: 2, days: 503 },
  { fy: 2026, q: 3, days: 440 },
];

/**
 * Months between certification and the I-140 receipt. A certification is valid
 * for 180 days (20 CFR 656.30(b)), so the I-140 lands zero to six months after
 * it; the midpoint used for the chart is one month.
 */
export const FILING_DELAY_MONTHS = { low: 0, mid: 1, high: 6 } as const;

/**
 * For I-140s received before October 2023 this site holds no DOL decisions, so
 * the PERM's length is an ASSUMPTION, stated on the page: six to twelve months,
 * nine for the chart. The range below carries it.
 */
export const PERM_MONTHS_BEFORE_MEASURED = { low: 6, mid: 9, high: 12 } as const;

const DAYS_PER_MONTH = 30.4375;

// ---------------------------------------------------------------------------
// The snapshot the server hands the calculator
// ---------------------------------------------------------------------------

export type ByYear = Record<string, number>; // fiscal year -> count

export interface LineSnapshot {
  /** USCIS approved petitions awaiting a visa, principals, as of `YYYY-MM`. */
  awaiting: {
    asOf: string;
    counts: Record<LineCategory, Partial<Record<CountryKey, number>>>;
    /**
     * The final action cutoff the count was taken against (USCIS: "based on
     * the <month> Visa Bulletin Final Action Dates chart"), per line, as an
     * ISO date. Null where that chart was not a date.
     */
    cutoffIso: Record<LineCategory, Partial<Record<CountryKey, string | null>>>;
  } | null;
  /** USCIS I-140 receipts by class and country, by receipt fiscal year. */
  i140: {
    asOf: string;
    /** The receipt fiscal year the file is part-way through, and how far. */
    currentFy: number;
    throughQuarter: number;
    approved: Record<I140Class, Record<ProfileBucket, ByYear>>;
    pending: Record<Preference, Record<ProfileBucket, ByYear>>;
    denied: Record<Preference, Record<ProfileBucket, ByYear>>;
  } | null;
  /** I-485s pending with a visa number available: people, per line. */
  i485Available: {
    asOf: string;
    counts: Record<LineCategory, Partial<Record<CountryKey, { counted: number; suppressed: number }>>>;
  } | null;
  /**
   * Every pending I-485 (both statuses), per line, by priority-date month:
   * `[monthIndex, counted, suppressed]`, month 0 for USCIS's "prior years"
   * column. These are PEOPLE USCIS counted, the one part of the line that
   * needs no estimate. Absent from snapshots built before 2026-09-26.
   */
  i485Filed?: {
    asOf: string;
    cells: Record<LineCategory, Partial<Record<CountryKey, Array<[number, number, number]>>>>;
  } | null;
  /** Visas each line issued to each chargeability, State's Table V. */
  supply: { fy: number; perYear: Record<LineCategory, Partial<Record<CountryKey, number>>> } | null;
  /** The newest final action chart, per line. */
  latest: {
    bulletinMonth: string;
    finalAction: Record<LineCategory, Partial<Record<CountryKey, Cutoff | null>>>;
    datesForFiling: Record<LineCategory, Partial<Record<CountryKey, Cutoff | null>>>;
    /** The newest DATED final action cutoff, for a line that reads U or C now. */
    lastDated: Record<LineCategory, Partial<Record<CountryKey, { iso: string; month: string } | null>>>;
  } | null;
}

// ---------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------

/** `YYYY-MM[-DD]` to a month index; January 2000 is 24000. */
export function monthIndex(s: string): number {
  return Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1);
}

export function monthLabelOf(i: number): string {
  const y = Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** The first month of receipt fiscal year `fy`: October of the year before. */
function fyStart(fy: number): number {
  return (fy - 1) * 12 + 9;
}

/** The fiscal year and quarter a month falls in. */
function fyQuarterOf(i: number): { fy: number; q: number } {
  const y = Math.floor(i / 12);
  const m = (i % 12) + 1;
  const fy = m >= 10 ? y + 1 : y;
  const q = Math.floor(((m - 10 + 12) % 12) / 3) + 1;
  return { fy, q };
}

export type Scenario = "low" | "mid" | "high";

/**
 * Months between a priority date and the I-140 receipt that carries it, for a
 * receipt in month `r`. A national interest waiver needs no labor
 * certification, so its priority date is the I-140's own filing date (8 CFR
 * 204.5(d)): zero lag.
 */
export function lagMonths(r: number, cls: I140Class, scenario: Scenario): number {
  if (cls === "NIW") return 0;
  const { fy, q } = fyQuarterOf(r);
  const measured = PERM_DAYS_BY_DECISION_QUARTER;
  const first = measured[0]!;
  const last = measured[measured.length - 1]!;
  const before = fy < first.fy || (fy === first.fy && q < first.q);
  if (before) return PERM_MONTHS_BEFORE_MEASURED[scenario];
  const hit =
    measured.find((x) => x.fy === fy && x.q === q) ??
    // A receipt after the newest decided quarter takes the newest measurement.
    last;
  return hit.days / DAYS_PER_MONTH + FILING_DELAY_MONTHS[scenario];
}

/** Months a receipt fiscal year's figures are spread across. */
function monthsCovered(fy: number, snap: NonNullable<LineSnapshot["i140"]>): number {
  if (fy < snap.currentFy) return 12;
  if (fy === snap.currentFy) return Math.max(1, Math.min(12, snap.throughQuarter * 3));
  return 0;
}

/** Add `amount` at a fractional month, split between the two months either side. */
function addAt(out: Map<number, number>, at: number, amount: number): void {
  const lo = Math.floor(at);
  const frac = at - lo;
  out.set(lo, (out.get(lo) ?? 0) + amount * (1 - frac));
  if (frac > 0) out.set(lo + 1, (out.get(lo + 1) ?? 0) + amount * frac);
}

/** Approved I-140s of one line, by priority-date month. Principals. */
export function approvedByPriorityDate(
  snap: NonNullable<LineSnapshot["i140"]>,
  category: LineCategory,
  bucket: ProfileBucket,
  scenario: Scenario,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const cls of LINE_CLASSES[category]) {
    const years = snap.approved[cls]?.[bucket] ?? {};
    for (const [fyKey, count] of Object.entries(years)) {
      const fy = Number(fyKey);
      const cover = monthsCovered(fy, snap);
      if (!cover || !(count > 0)) continue;
      const per = count / cover;
      for (let k = 0; k < cover; k += 1) {
        const r = fyStart(fy) + k;
        addAt(out, r - lagMonths(r, cls, scenario), per);
      }
    }
  }
  return out;
}

/**
 * The approval rate the file shows for complete receipt years: approved over
 * approved plus denied, across the three most recent years with almost nothing
 * left pending (the current year and the two before it are still being
 * decided). Null when there is nothing to divide.
 */
export function approvalRate(
  snap: NonNullable<LineSnapshot["i140"]>,
  pref: Preference,
  bucket: ProfileBucket,
): number | null {
  let approved = 0;
  let denied = 0;
  for (let fy = snap.currentFy - 5; fy <= snap.currentFy - 3; fy += 1) {
    for (const cls of PREFERENCE_CLASSES[pref]) approved += snap.approved[cls]?.[bucket]?.[fy] ?? 0;
    denied += snap.denied[pref]?.[bucket]?.[fy] ?? 0;
  }
  return approved + denied > 0 ? approved / (approved + denied) : null;
}

/** Pending I-140s of one line, by priority-date month, times the approval rate. */
export function pendingByPriorityDate(
  snap: NonNullable<LineSnapshot["i140"]>,
  category: LineCategory,
  bucket: ProfileBucket,
  scenario: Scenario,
): Map<number, number> {
  const out = new Map<number, number>();
  const pref = PREFERENCE_OF[category];
  const rate = approvalRate(snap, pref, bucket);
  if (rate === null) return out;
  const pending = snap.pending[pref]?.[bucket] ?? {};
  for (const [fyKey, count] of Object.entries(pending)) {
    const fy = Number(fyKey);
    const cover = monthsCovered(fy, snap);
    if (!cover || !(count > 0)) continue;
    // Pending is reported per preference, so each class takes its share of
    // that year's approvals in the preference (the year before when nothing
    // from this one has been decided yet).
    const classShare = (cls: I140Class, y: number): number => {
      const all = PREFERENCE_CLASSES[pref].reduce((n, c) => n + (snap.approved[c]?.[bucket]?.[y] ?? 0), 0);
      return all > 0 ? (snap.approved[cls]?.[bucket]?.[y] ?? 0) / all : NaN;
    };
    for (const cls of LINE_CLASSES[category]) {
      let clsShare = classShare(cls, fy);
      if (Number.isNaN(clsShare)) clsShare = classShare(cls, fy - 1);
      if (Number.isNaN(clsShare)) continue;
      const per = (count * rate * clsShare) / cover;
      if (!(per > 0)) continue;
      for (let k = 0; k < cover; k += 1) {
        const r = fyStart(fy) + k;
        addAt(out, r - lagMonths(r, cls, scenario), per);
      }
    }
  }
  return out;
}

function sumWhere(m: Map<number, number>, pred: (i: number) => boolean): number {
  let n = 0;
  for (const [i, v] of m) if (pred(i)) n += v;
  return n;
}

// ---------------------------------------------------------------------------
// The estimate
// ---------------------------------------------------------------------------

export interface LineInput {
  category: LineCategory;
  country: CountryKey;
  /** `YYYY-MM-DD`. */
  priorityDate: string;
}

export interface Range {
  low: number;
  high: number;
}

export type LineResult =
  | { kind: "no-data"; reason: string }
  | {
      kind: "current";
      /** What the newest chart printed, and in which bulletin. */
      cutoff: Cutoff;
      bulletinMonth: string;
    }
  | {
      kind: "estimate";
      bulletinMonth: string;
      /** The newest final action cutoff as printed (a date, or U). */
      latestCutoff: Cutoff;
      /** The dated cutoff used as the front of the line, and its bulletin. */
      front: { iso: string; month: string };
      /** Principals USCIS counted waiting in this line, all priority dates. */
      awaitingTotal: number;
      awaitingAsOf: string;
      parts: {
        approvedWaiting: Range;
        pendingApproval: Range;
        currentUnfinished: Range;
      };
      peopleAhead: Range & { mid: number };
      familySize: { low: number; high: number };
      /** People ahead by priority-date month, for the chart. Mid scenario. */
      histogram: Array<{ month: string; people: number }>;
      supply: { fy: number; perYear: number } | null;
      /** People ahead over FY2024's issuance, in years. Null with no supply. */
      years: Range | null;
      i485AsOf: string | null;
      /**
       * People USCIS COUNTED in its I-485 inventory with an earlier priority
       * date: a floor, because every one of them is real and ahead. The range
       * above is never allowed below it.
       */
      counted: Range | null;
      /**
       * The same boundary seen two ways, where filing is open past the final
       * action date: the estimate's people ahead of the dates-for-filing
       * cutoff against the I-485s USCIS counted before it. `ratio` is
       * estimate (mid) over counted (mid); `disagrees` when it is outside 0.5
       * to 2, and the page then says the estimate is rough.
       */
      check: {
        at: string;
        estimate: Range;
        counted: Range;
        ratio: number;
        /**
         * False where most of the line gets its visa abroad: the I-485 count
         * then misses most people by design, and the ratio says nothing.
         */
        comparable: boolean;
        disagrees: boolean;
        /**
         * The estimate divided by the ratio, when a comparable check
         * disagrees: what the range would be if the estimate overcounts
         * everywhere by the amount it overcounts at the filing cutoff. Never
         * below the counted floor.
         */
        scaled: Range | null;
      } | null;
    };

/** People in the I-485 inventory with a priority date before month `pd`. */
export function countedBefore(
  snap: LineSnapshot,
  category: LineCategory,
  country: CountryKey,
  pd: number,
): Range | null {
  const cells = snap.i485Filed?.cells[category]?.[country];
  if (!cells || cells.length === 0) return null;
  let counted = 0;
  let suppressed = 0;
  for (const [m, n, sup] of cells) {
    if (m < pd) {
      counted += n;
      suppressed += sup;
    }
  }
  return { low: counted + suppressed, high: counted + suppressed * 10 };
}

/** The dated front of the line the reader's priority date is measured from. */
function frontOf(
  snap: LineSnapshot,
  category: LineCategory,
  country: CountryKey,
): { iso: string; month: string } | null {
  const latest = snap.latest;
  if (!latest) return null;
  const now = latest.finalAction[category]?.[country] ?? null;
  if (now?.kind === "date") return { iso: now.iso, month: latest.bulletinMonth };
  return latest.lastDated[category]?.[country] ?? null;
}

interface Ahead {
  parts: { approvedWaiting: Range; pendingApproval: Range; currentUnfinished: Range };
  low: number;
  high: number;
  mid: number;
  /** Mid-scenario principals by priority-date month, already scaled to USCIS's count. */
  approvedMid: Map<number, number>;
  pendingMid: Map<number, number>;
}

/** Everything ahead of month `pd` in one line, before any floor or check. */
function aheadOf(
  snap: LineSnapshot,
  category: LineCategory,
  country: CountryKey,
  pd: number,
  cut: number,
  awaitingTotal: number,
): Ahead {
  const i140 = snap.i140!;
  const bucket = PROFILE_BUCKET[country];
  const fam = FAMILY_SIZE[category];

  const scenarioResult = (scenario: Scenario) => {
    const app = approvedByPriorityDate(i140, category, bucket, scenario);
    const pend = pendingByPriorityDate(i140, category, bucket, scenario);
    // The count's priority dates all sit after its cutoff; spread it over the
    // approvals profile there, and keep the share that falls before `pd`.
    const beyond = sumWhere(app, (i) => i >= cut);
    const before = sumWhere(app, (i) => i >= cut && i < pd);
    const approvedPrincipals = beyond > 0 ? (awaitingTotal * before) / beyond : 0;
    const pendingPrincipals = sumWhere(pend, (i) => i < pd);
    return { app, pend, beyond, approvedPrincipals, pendingPrincipals };
  };

  const lo = scenarioResult("low");
  const mid = scenarioResult("mid");
  const hi = scenarioResult("high");
  const pick = (f: (r: ReturnType<typeof scenarioResult>) => number): Range => {
    const v = [f(lo), f(mid), f(hi)];
    return { low: Math.min(...v), high: Math.max(...v) };
  };
  const approvedP = pick((r) => r.approvedPrincipals);
  const pendingP = pick((r) => r.pendingPrincipals);

  const avail = snap.i485Available?.counts[category]?.[country] ?? null;
  const currentUnfinished: Range = avail
    ? { low: avail.counted + avail.suppressed, high: avail.counted + avail.suppressed * 10 }
    : { low: 0, high: 0 };

  const parts = {
    approvedWaiting: { low: approvedP.low * fam.low, high: approvedP.high * fam.high },
    pendingApproval: { low: pendingP.low * fam.low, high: pendingP.high * fam.high },
    currentUnfinished,
  };
  const famMid = (fam.low + fam.high) / 2;
  const scale = mid.beyond > 0 ? awaitingTotal / mid.beyond : 0;
  const approvedMid = new Map<number, number>();
  for (const [i, v] of mid.app) if (i >= cut) approvedMid.set(i, v * scale);
  return {
    parts,
    low: parts.approvedWaiting.low + parts.pendingApproval.low + currentUnfinished.low,
    high: parts.approvedWaiting.high + parts.pendingApproval.high + currentUnfinished.high,
    mid:
      (mid.approvedPrincipals + mid.pendingPrincipals) * famMid +
      (currentUnfinished.low + currentUnfinished.high) / 2,
    approvedMid,
    pendingMid: mid.pend,
  };
}

const midOf = (r: Range) => (r.low + r.high) / 2;

export function estimateLine(input: LineInput, snap: LineSnapshot): LineResult {
  const { category, country, priorityDate } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate)) return { kind: "no-data", reason: "Give a priority date." };
  const latest = snap.latest;
  if (!latest) return { kind: "no-data", reason: "The visa bulletin archive is unavailable." };
  const cutoff = latest.finalAction[category]?.[country] ?? null;
  if (!cutoff) return { kind: "no-data", reason: "The bulletin prints no cutoff for this line." };

  // CURRENT means current on the chart that decides it, the final action one.
  if (cutoff.kind === "current" || (cutoff.kind === "date" && priorityDate < cutoff.iso)) {
    return { kind: "current", cutoff, bulletinMonth: latest.bulletinMonth };
  }

  const front = frontOf(snap, category, country);
  if (!front || !snap.i140 || !snap.awaiting) {
    return { kind: "no-data", reason: "USCIS's counts for this line are unavailable." };
  }
  if (priorityDate < front.iso) {
    // The newest chart is U and the reader sits before its last dated cutoff:
    // they were current and the line has shut. Nobody is ahead of them in it.
    return { kind: "current", cutoff, bulletinMonth: latest.bulletinMonth };
  }

  const awaitingTotal = snap.awaiting.counts[category]?.[country] ?? 0;
  // The count's own cutoff: everyone in it has a later priority date than this.
  const cut = monthIndex(snap.awaiting.cutoffIso[category]?.[country] ?? front.iso);
  const pd = monthIndex(priorityDate);
  const a = aheadOf(snap, category, country, pd, cut, awaitingTotal);

  // The floor: I-485s USCIS counted with an earlier priority date. Everyone in
  // the inventory filed on or before the dates-for-filing cutoff, so this is
  // simply every counted cell before the reader's month.
  const counted = countedBefore(snap, category, country, pd);
  const low = counted ? Math.max(a.low, counted.low) : a.low;
  const high = counted ? Math.max(a.high, counted.high) : a.high;
  const mid = Math.min(high, Math.max(low, a.mid));

  // The check, at the dates-for-filing cutoff, where both views exist.
  let check: Extract<LineResult, { kind: "estimate" }>["check"] = null;
  const dff = latest.datesForFiling[category]?.[country] ?? null;
  if (dff?.kind === "date" && dff.iso > front.iso) {
    const at = monthIndex(dff.iso);
    const est = aheadOf(snap, category, country, at, cut, awaitingTotal);
    const got = countedBefore(snap, category, country, at);
    if (got && midOf(got) > 0) {
      const ratio = est.mid / midOf(got);
      const comparable = ADJUSTMENT_SHARE[category].low >= CHECK_MIN_ADJUSTMENT;
      const disagrees = comparable && (ratio < 0.5 || ratio > 2);
      const floor = counted ? counted.low : 0;
      check = {
        at: dff.iso,
        estimate: { low: est.low, high: est.high },
        counted: got,
        ratio,
        comparable,
        disagrees,
        scaled: disagrees ? { low: Math.max(floor, low / ratio), high: Math.max(floor, high / ratio) } : null,
      };
    }
  }

  // Where the people ahead sit, month by month, mid scenario.
  const fam = FAMILY_SIZE[category];
  const famMid = (fam.low + fam.high) / 2;
  const histogram: Array<{ month: string; people: number }> = [];
  for (let i = cut; i < pd; i += 1) {
    const people = ((a.approvedMid.get(i) ?? 0) + (a.pendingMid.get(i) ?? 0)) * famMid;
    histogram.push({ month: monthLabelOf(i), people });
  }

  const perYear = snap.supply?.perYear[category]?.[country] ?? null;
  const supply = snap.supply && perYear !== null ? { fy: snap.supply.fy, perYear } : null;
  const years = supply && supply.perYear > 0 ? { low: low / supply.perYear, high: high / supply.perYear } : null;

  return {
    kind: "estimate",
    bulletinMonth: latest.bulletinMonth,
    latestCutoff: cutoff,
    front,
    awaitingTotal,
    awaitingAsOf: snap.awaiting.asOf,
    parts: a.parts,
    peopleAhead: { low, high, mid },
    familySize: fam,
    histogram,
    supply,
    years,
    i485AsOf: snap.i485Available?.asOf ?? snap.i485Filed?.asOf ?? null,
    counted,
    check,
  };
}
