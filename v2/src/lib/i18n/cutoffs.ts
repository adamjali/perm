import { parseCutoff, type BulletinMonth, type CountryKey, type Cutoff } from "@/lib/perm";

/**
 * The four employment rows a localized guide prints for its readers'
 * countries, from the newest bulletin held: EB-1, EB-2, EB-3 and EB-3 Other
 * Workers, each with both charts.
 *
 * A cell the bulletin did not print is null and renders as "not printed",
 * never as a blank that reads like "no wait". `C` and `U` stay distinct, as
 * everywhere on this site: current means open to every date, unavailable
 * means shut to all of them.
 */

export const GUIDE_CATEGORIES = ["EB1", "EB2", "EB3", "EW3"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export interface CutoffRow {
  category: GuideCategory;
  finalAction: Cutoff | null;
  datesForFiling: Cutoff | null;
}

export function newestBulletin(bulletins: readonly BulletinMonth[]): BulletinMonth | null {
  let newest: BulletinMonth | null = null;
  for (const b of bulletins) {
    if (!newest || b.bulletinMonth > newest.bulletinMonth) newest = b;
  }
  return newest;
}

export function countryCutoffRows(bulletin: BulletinMonth, country: CountryKey): CutoffRow[] {
  return GUIDE_CATEGORIES.map((category) => ({
    category,
    finalAction: parseCutoff(bulletin.finalAction?.[category]?.[country]),
    datesForFiling: parseCutoff(bulletin.datesForFiling?.[category]?.[country]),
  }));
}
