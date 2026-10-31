import type { BulletinMonth, CountryKey } from "@/lib/perm";

/**
 * One visa bulletin line (a category and a country), month by month, for a calculator that reads its history in the
 * browser. Sending the whole archive to every visitor would cost the page about 150 KB; one line is a few.
 *
 * Shared by the route that serves it and the calculator that reads it.
 */

export const LINE_COUNTRIES: readonly CountryKey[] = ["worldwide", "china", "india", "mexico", "philippines"];
export type LineChartSet = "employment" | "family";

export interface LineMonth {
  /** The bulletin's own month, YYYY-MM. */
  month: string;
  /** The Final Action cell as State printed it (`01JAN13`, `C`, `U`), or null where the bulletin has none. */
  finalAction: string | null;
  datesForFiling: string | null;
}

export interface BulletinLine {
  set: LineChartSet;
  category: string;
  country: CountryKey;
  months: LineMonth[];
}

/** The line's cells, oldest first; a month the archive holds with no cell for the line keeps its row, as null. */
export function lineOf(set: LineChartSet, category: string, country: CountryKey, series: readonly BulletinMonth[]): BulletinLine {
  const months = [...series]
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth))
    .map((b) => ({
      month: b.bulletinMonth,
      finalAction: b.finalAction?.[category]?.[country] ?? null,
      datesForFiling: b.datesForFiling?.[category]?.[country] ?? null,
    }));
  return { set, category, country, months };
}

/** Back into the calculators' shape: one category and country per month. */
export function bulletinsOf(line: BulletinLine): BulletinMonth[] {
  return line.months.map((m) => ({
    bulletinMonth: m.month,
    finalAction: m.finalAction === null ? {} : { [line.category]: { [line.country]: m.finalAction } },
    datesForFiling: m.datesForFiling === null ? {} : { [line.category]: { [line.country]: m.datesForFiling } },
  }));
}
