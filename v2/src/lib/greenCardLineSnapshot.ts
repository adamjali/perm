/**
 * Shapes the stored USCIS, State and bulletin records into the calculator's
 * `LineSnapshot`. Pure, so the mapping (which is where a wrong column quietly
 * produces a wrong line) is tested without a database; the server module in
 * `lib/turso/greenCardLine.ts` only reads the rows and hands them here.
 */

import { parseCutoff, type BulletinMonth, type CountryKey, type Cutoff } from "@/lib/perm";
import type { TableVYear } from "@/lib/visaLimits";
import {
  LINE_CATEGORIES,
  LINE_COUNTRIES,
  type ByYear,
  type I140Class,
  type LineCategory,
  type LineSnapshot,
  type Preference,
  type ProfileBucket,
} from "@/lib/greenCardLine";

/** USCIS's spellings of the bulletin's chargeabilities. */
export const USCIS_COUNTRY: Record<string, CountryKey> = {
  "China": "china",
  "India": "india",
  "Mexico": "mexico",
  "Philippines": "philippines",
  "Rest of the World": "worldwide",
};

/** Table V's Part 2 columns for each line. */
const TABLE_V_COLUMN: Record<LineCategory, string> = { EB2: "2nd", EB3: "3rd", EW3: "3rd_other_workers" };
const TABLE_V_KEY: Record<CountryKey, "china" | "india" | "mexico" | "philippines" | "row"> = {
  china: "china",
  india: "india",
  mexico: "mexico",
  philippines: "philippines",
  worldwide: "row",
};

const CLASS_MEASURE: Record<I140Class, string> = {
  E21: "approved_E21",
  NIW: "approved_NIW",
  E31: "approved_E31",
  E32: "approved_E32",
  EW3: "approved_EW3",
};

export interface RawLineInputs {
  awaiting: { asOf: string; cells: Array<{ country: string; category: string; count: number }> } | null;
  i140: {
    asOf: string;
    cells: Array<{ country: string; preference: string; measure: string; fy: number; count: number }>;
  } | null;
  i485Available: {
    asOf: string;
    rows: Array<{ country: string; category: string; counted: number; suppressed: number }>;
  } | null;
  /** Every pending I-485 cell, both statuses: `pdYear` is "prior" or a year. */
  i485Filed?: {
    asOf: string;
    rows: Array<{ country: string; category: string; pdYear: string; pdMonth: number; counted: number; suppressed: number }>;
  } | null;
  tableV: TableVYear | null;
  /** Oldest first. */
  bulletins: readonly BulletinMonth[];
}

function emptyByLine<T>(): Record<LineCategory, Partial<Record<CountryKey, T>>> {
  return { EB2: {}, EB3: {}, EW3: {} };
}

function emptyBuckets(): Record<ProfileBucket, ByYear> {
  return { china: {}, india: {}, philippines: {}, rowmex: {} };
}

/**
 * The newest dated final action cutoff at or before `month` (inclusive), and
 * the bulletin that printed it. Null when there is none in the archive.
 */
export function lastDatedCutoff(
  bulletins: readonly BulletinMonth[],
  category: string,
  country: CountryKey,
  month?: string,
): { iso: string; month: string } | null {
  for (let i = bulletins.length - 1; i >= 0; i -= 1) {
    const b = bulletins[i]!;
    if (month && b.bulletinMonth > month) continue;
    const c = parseCutoff(b.finalAction?.[category]?.[country]);
    if (c?.kind === "date") return { iso: c.iso, month: b.bulletinMonth };
  }
  return null;
}

/**
 * The I-140 file names China, India and the Philippines; Mexico and the rest
 * of the world take "All Countries" less those three (Brazil and Vietnam are
 * rest-of-world chargeability, so they stay inside it). Floored at zero, which
 * only matters if USCIS ever prints a country total above its own "All".
 */
function rowmex(all: number | undefined, parts: Array<number | undefined>): number {
  return Math.max(0, (all ?? 0) - parts.reduce<number>((n, v) => n + (v ?? 0), 0));
}

export function buildLineSnapshot(raw: RawLineInputs): LineSnapshot {
  // --- awaiting, and the cutoff it was counted against
  let awaiting: LineSnapshot["awaiting"] = null;
  if (raw.awaiting && raw.awaiting.cells.length) {
    const counts = emptyByLine<number>();
    for (const c of raw.awaiting.cells) {
      const country = USCIS_COUNTRY[c.country];
      if (!country || !(LINE_CATEGORIES as readonly string[]).includes(c.category)) continue;
      counts[c.category as LineCategory][country] = c.count;
    }
    const cutoffIso = emptyByLine<string | null>();
    for (const cat of LINE_CATEGORIES) {
      for (const country of LINE_COUNTRIES) {
        // USCIS: "The priority date is based on <month> Visa Bulletin Final
        // Action Dates chart", the month of the count itself.
        cutoffIso[cat][country] = lastDatedCutoff(raw.bulletins, cat, country, raw.awaiting.asOf)?.iso ?? null;
      }
    }
    awaiting = { asOf: raw.awaiting.asOf, counts, cutoffIso };
  }

  // --- I-140 receipts by class, country and receipt year
  let i140: LineSnapshot["i140"] = null;
  const qm = raw.i140 ? /^(\d{4})-Q([1-4])$/.exec(raw.i140.asOf) : null;
  if (raw.i140 && qm && raw.i140.cells.length) {
    const byCountry = new Map<string, Map<string, number>>(); // country -> "measure|pref|fy" -> count
    for (const c of raw.i140.cells) {
      const m = byCountry.get(c.country) ?? new Map<string, number>();
      m.set(`${c.measure}|${c.preference}|${c.fy}`, c.count);
      byCountry.set(c.country, m);
    }
    const get = (country: string, measure: string, pref: string, fy: number) =>
      byCountry.get(country)?.get(`${measure}|${pref}|${fy}`);
    const years = [...new Set(raw.i140.cells.map((c) => c.fy))].sort((a, b) => a - b);
    const fill = (measure: string, pref: string): Record<ProfileBucket, ByYear> => {
      const out = emptyBuckets();
      for (const fy of years) {
        const china = get("China", measure, pref, fy);
        const india = get("India", measure, pref, fy);
        const ph = get("Philippines", measure, pref, fy);
        if (china !== undefined) out.china[fy] = china;
        if (india !== undefined) out.india[fy] = india;
        if (ph !== undefined) out.philippines[fy] = ph;
        const all = get("All Countries", measure, pref, fy);
        if (all !== undefined) out.rowmex[fy] = rowmex(all, [china, india, ph]);
      }
      return out;
    };
    const prefOfClass: Record<I140Class, Preference> = { E21: "EB2", NIW: "EB2", E31: "EB3", E32: "EB3", EW3: "EB3" };
    const approved = {} as Record<I140Class, Record<ProfileBucket, ByYear>>;
    for (const cls of Object.keys(CLASS_MEASURE) as I140Class[]) {
      approved[cls] = fill(CLASS_MEASURE[cls], prefOfClass[cls]);
    }
    i140 = {
      asOf: raw.i140.asOf,
      currentFy: Number(qm[1]),
      throughQuarter: Number(qm[2]),
      approved,
      pending: { EB2: fill("pending", "EB2"), EB3: fill("pending", "EB3") },
      denied: { EB2: fill("denied", "EB2"), EB3: fill("denied", "EB3") },
    };
  }

  // --- I-485s pending with a visa number available
  let i485Available: LineSnapshot["i485Available"] = null;
  if (raw.i485Available && raw.i485Available.rows.length) {
    const counts = emptyByLine<{ counted: number; suppressed: number }>();
    for (const r of raw.i485Available.rows) {
      const country = USCIS_COUNTRY[r.country];
      if (!country || !(LINE_CATEGORIES as readonly string[]).includes(r.category)) continue;
      counts[r.category as LineCategory][country] = { counted: r.counted, suppressed: r.suppressed };
    }
    i485Available = { asOf: raw.i485Available.asOf, counts };
  }

  // --- every pending I-485, by priority-date month
  let i485Filed: LineSnapshot["i485Filed"] = null;
  if (raw.i485Filed && raw.i485Filed.rows.length) {
    const cells = emptyByLine<Array<[number, number, number]>>();
    for (const r of raw.i485Filed.rows) {
      const country = USCIS_COUNTRY[r.country];
      if (!country || !(LINE_CATEGORIES as readonly string[]).includes(r.category)) continue;
      // "Prior years" sorts before every real month, which is all it needs to do.
      const m = r.pdYear === "prior" ? 0 : Number(r.pdYear) * 12 + (r.pdMonth - 1);
      if (!Number.isFinite(m)) continue;
      (cells[r.category as LineCategory][country] ??= []).push([m, r.counted, r.suppressed]);
    }
    i485Filed = { asOf: raw.i485Filed.asOf, cells };
  }

  // --- visas issued, Table V
  let supply: LineSnapshot["supply"] = null;
  const by = raw.tableV?.employment_by_chargeability;
  if (raw.tableV && by) {
    const perYear = emptyByLine<number>();
    for (const cat of LINE_CATEGORIES) {
      for (const country of LINE_COUNTRIES) {
        const v = by[TABLE_V_KEY[country]]?.[TABLE_V_COLUMN[cat]];
        if (typeof v === "number") perYear[cat][country] = v;
      }
    }
    supply = { fy: raw.tableV.fiscal_year, perYear };
  }

  // --- the newest chart
  let latest: LineSnapshot["latest"] = null;
  const newest = raw.bulletins[raw.bulletins.length - 1];
  if (newest) {
    const finalAction = emptyByLine<Cutoff | null>();
    const datesForFiling = emptyByLine<Cutoff | null>();
    const lastDated = emptyByLine<{ iso: string; month: string } | null>();
    for (const cat of LINE_CATEGORIES) {
      for (const country of LINE_COUNTRIES) {
        finalAction[cat][country] = parseCutoff(newest.finalAction?.[cat]?.[country]);
        datesForFiling[cat][country] = parseCutoff(newest.datesForFiling?.[cat]?.[country]);
        lastDated[cat][country] = lastDatedCutoff(raw.bulletins, cat, country);
      }
    }
    latest = { bulletinMonth: newest.bulletinMonth, finalAction, datesForFiling, lastDated };
  }

  return { awaiting, i140, i485Available, i485Filed, supply, latest };
}
