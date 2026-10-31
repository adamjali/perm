/**
 * Which visa bulletin chart USCIS accepts for an I-485 this month.
 *
 * The State Department prints two charts (Final Action Dates and Dates for
 * Filing). Each month USCIS says, on its own page, which one it accepts for an
 * adjustment-of-status filing, once for employment-based categories and once
 * for family-sponsored ones, and the two can differ. It decides whether
 * someone can file at all, and it changes month to month.
 *
 * The parser is pure, so the unit project holds it against a real copy of the
 * page; the fetch lives in `getUscisCharts` (server only, never fatal).
 */

import { MONTH_NAMES } from "@convex/lib/months";

export const USCIS_CHARTS_URL =
  "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";

export type UscisChart = "Final Action Dates" | "Dates for Filing";

export interface UscisCharts {
  /** The newest bulletin month USCIS names, `YYYY-MM`. */
  month: string;
  /** The chart USCIS accepts for employment-based filings that month, or null when its notice can't be read. */
  employment: UscisChart | null;
  /** The same for family-sponsored filings. */
  family: UscisChart | null;
}

const MONTHS = MONTH_NAMES.join("|");

const iso = (name: string, year: string) => `${year}-${String(MONTH_NAMES.indexOf(name as (typeof MONTH_NAMES)[number]) + 1).padStart(2, "0")}`;

/**
 * The page as plain text. Entities are decoded before whitespace collapses:
 * USCIS writes "use the&nbsp; Dates for Filing chart", and read raw that
 * sentence matched nothing, so the calculator went without USCIS's answer.
 */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/**
 * The newest month USCIS names, and the chart each kind of filing uses that
 * month. A chart is reported only for the month its own sentence names, so an
 * older month's notice can't stand in for the newest one. Null when the page
 * names no month at all.
 */
export function parseUscisCharts(html: string): UscisCharts | null {
  const text = pageText(html);
  // Anchored on USCIS's heading, never a bare "<Month> <Year>": the page lists
  // a dozen archive months, and the first bare match is the month in force.
  const months = [...text.matchAll(new RegExp(`USCIS (${MONTHS}) (\\d{4}) Adjustment of Status Filing Charts`, "g"))]
    .map((m) => iso(m[1]!, m[2]!))
    .sort();
  const month = months[months.length - 1];
  if (!month) return null;
  // "employment-based" and "family-sponsored" are load-bearing: the page
  // carries both sentences for every month, and they can name different charts.
  const chartFor = (kind: string): UscisChart | null => {
    const re = new RegExp(
      `For all ${kind} preference categories, you must use the (Final Action Dates|Dates for Filing) chart ` +
        `in the Department of State Visa Bulletin for (${MONTHS}) (\\d{4})`,
      "g",
    );
    for (const m of text.matchAll(re)) if (iso(m[2]!, m[3]!) === month) return m[1] as UscisChart;
    return null;
  };
  return { month, employment: chartFor("employment-based"), family: chartFor("family-sponsored") };
}
