/**
 * One visa bulletin LINE (a category for one chargeability) as a page:
 * `/visa-bulletin/categories/eb2-india`. Pure, so the slugs the sitemap lists
 * and the slugs the route accepts come from one place.
 *
 * The slug is words, not codes, because the words are what people search:
 * "eb3 other workers" rather than "EW3", "rest of world" rather than the
 * bulletin's "all chargeability areas except those listed".
 */

import type { CountryKey, Cutoff } from "@/lib/perm";
import { MS_PER_DAY } from "@/lib/time";
import { fiscalYearOf } from "@convex/lib/months";

// The names, slugs and order live in convex/lib so Convex's bulletin push names a line as its page does.
import {
  CATEGORY_SLUG,
  COUNTRY_SLUG,
  LINE_PAGE_COUNTRIES,
  lineSlug,
} from "@convex/lib/bulletinLineNames";
export {
  LINE_CATEGORY_SHORT,
  LINE_COUNTRY_SHORT,
  LINE_PAGE_COUNTRIES,
  lineName,
  lineSlug,
} from "@convex/lib/bulletinLineNames";

/** Every line page for the categories the archive holds, in page order. */
export function lineSlugs(categories: readonly string[]): string[] {
  const out: string[] = [];
  for (const cat of categories) {
    if (!CATEGORY_SLUG[cat]) continue;
    for (const country of LINE_PAGE_COUNTRIES) out.push(lineSlug(cat, country));
  }
  return out;
}

/** The line a slug names, or null for anything that isn't exactly one. */
export function parseLineSlug(slug: string): { category: string; country: CountryKey } | null {
  for (const [category, cs] of Object.entries(CATEGORY_SLUG)) {
    for (const country of LINE_PAGE_COUNTRIES) {
      if (slug === `${cs}-${COUNTRY_SLUG[country]}`) return { category, country };
    }
  }
  return null;
}

/**
 * USCIS's code for the same line in its awaiting-visa file and I-485
 * inventory. The bulletin's "5th unreserved" row is USCIS's EB5U; the rest
 * match. (USCIS's awaiting-visa file lumps the three set-asides together as
 * EB5S, so those lines have no awaiting count of their own.)
 */
export function uscisCode(category: string): string {
  return category === "EB5" ? "EB5U" : category;
}

export interface FiscalYearMove {
  /** Federal fiscal year: October of the year before through September. */
  fy: number;
  start: { month: string; cutoff: Cutoff };
  end: { month: string; cutoff: Cutoff };
  /** Days the cutoff moved from the first bulletin to the last, both dated. */
  movedDays: number | null;
  /** Bulletins in the year that went back, or shut the line. */
  backwards: number;
  /** The archive holds only part of this year. */
  partial: boolean;
}

/**
 * The line's history a fiscal year at a time, newest first: the October
 * bulletin against the September one, which is the year the State Department
 * plans numbers for. `states` is oldest first.
 */
export function fiscalYearMoves(states: ReadonlyArray<{ month: string; cutoff: Cutoff }>): FiscalYearMove[] {
  const byFy = new Map<number, Array<{ month: string; cutoff: Cutoff }>>();
  for (const s of states) {
    const fy = fiscalYearOf(s.month);
    const list = byFy.get(fy) ?? [];
    list.push(s);
    byFy.set(fy, list);
  }
  const out: FiscalYearMove[] = [];
  for (const [fy, list] of byFy) {
    const start = list[0]!;
    const end = list[list.length - 1]!;
    let backwards = 0;
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]!.cutoff;
      const curr = list[i]!.cutoff;
      if (curr.kind === "unavailable" && prev.kind !== "unavailable") backwards += 1;
      else if (prev.kind === "date" && curr.kind === "date" && curr.iso < prev.iso) backwards += 1;
    }
    const movedDays =
      start.cutoff.kind === "date" && end.cutoff.kind === "date"
        ? Math.round((Date.parse(end.cutoff.iso) - Date.parse(start.cutoff.iso)) / MS_PER_DAY)
        : null;
    out.push({
      fy,
      start,
      end,
      movedDays,
      backwards,
      partial: start.month !== `${fy - 1}-10` || end.month !== `${fy}-09`,
    });
  }
  return out.sort((a, z) => z.fy - a.fy);
}

/** USCIS withholds cells of 1 to 10 people; each withheld cell is a range. */
export function inventoryRange(counted: number, suppressedCells: number): { low: number; high: number } {
  return { low: counted + suppressedCells, high: counted + suppressedCells * 10 };
}
