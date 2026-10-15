import "server-only";

import { cache } from "react";

import { one, rows } from "./client";

/**
 * The State Department's monthly immigrant visa issuances, as loaded by
 * scripts/ingest_visa_issuances.py: every immigrant visa its consulates issued
 * ABROAD, by visa class and by country of chargeability or by consulate. A
 * green card granted inside the US (adjustment of status at USCIS) isn't here.
 * Each row carries the category State's own symbol legend puts its class in.
 */

export const EMPLOYMENT_CATEGORIES = ["EB-1", "EB-2", "EB-3", "EB-3 other workers", "EB-4", "EB-5"] as const;
export const ALL_CATEGORIES = [
  ...EMPLOYMENT_CATEGORIES,
  "Immediate relatives",
  "Family preferences",
  "Diversity",
  "Special immigrants",
  "Other",
] as const;

export interface IssuanceSummary {
  months: string[];
  newest: string | null;
  byMonth: Record<string, Record<string, number>>;
}

export const issuanceSummary = cache(async (): Promise<IssuanceSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'visa_issuances_summary'").catch(() => null);
  if (!r) return null;
  try {
    const doc = JSON.parse(String(r.json)) as IssuanceSummary;
    return doc.months?.length ? doc : null;
  } catch {
    return null;
  }
});

export interface IssuanceGroup {
  /** One key per place across State's spellings. */
  group: string;
  /** The newest spelling State used. */
  label: string;
  category: string;
  n: number;
}

/**
 * Employment-category issuances per country (dim "fsc") or consulate ("post")
 * over the months from `from` through `to`, YYYY-MM inclusive.
 */
export async function employmentBy(dim: "fsc" | "post", from: string, to: string): Promise<IssuanceGroup[]> {
  // SQLite's bare-column rule: with exactly one max() in the query, `key` comes
  // from the row holding the newest month, so the label is State's latest spelling.
  const got = await rows<{ group_key: string; label: string; category: string; n: unknown }>(
    `SELECT group_key, key AS label, max(month) AS newest, category, sum(n) AS n FROM visa_issuances
     WHERE dim = ? AND month >= ? AND month <= ? AND category IN (${EMPLOYMENT_CATEGORIES.map(() => "?").join(",")})
     GROUP BY group_key, category`,
    [dim, from, to, ...EMPLOYMENT_CATEGORIES],
  ).catch(() => []);
  return got.map((r) => ({ group: r.group_key, label: r.label, category: r.category, n: Number(r.n) }));
}

/** One country's employment issuances by category and month, from `from` on. */
export async function countryByMonth(group: string, from: string): Promise<{ month: string; category: string; n: number }[]> {
  const got = await rows<{ month: string; category: string; n: unknown }>(
    `SELECT month, category, sum(n) AS n FROM visa_issuances
     WHERE dim = 'fsc' AND group_key = ? AND month >= ? GROUP BY month, category ORDER BY month`,
    [group, from],
  ).catch(() => []);
  return got.map((r) => ({ month: r.month, category: r.category, n: Number(r.n) }));
}

/** YYYY-MM a number of months before `month`. */
export function monthsBefore(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** "February 2026". */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The bulletin's category codes, as State's issuance categories. */
const LINE_CATEGORY: Record<string, string> = {
  EB1: "EB-1",
  EB2: "EB-2",
  EB3: "EB-3",
  EW3: "EB-3 other workers",
  EB4: "EB-4",
  EB5: "EB-5",
  EB5R: "EB-5",
  EB5HU: "EB-5",
  EB5I: "EB-5",
};
/** The bulletin's chargeability columns, as State's country keys (group_key). */
const LINE_COUNTRY: Record<string, string> = {
  india: "india",
  china: "china - mainland born",
  mexico: "mexico",
  philippines: "philippines",
};

export interface LineIssuance {
  category: string;
  /** True when the bulletin line is one part of a category State counts whole (the EB-5 set-asides). */
  wholeCategory: boolean;
  from: string;
  to: string;
  total: number;
  newest: number;
}

/**
 * Visas State issued abroad in one bulletin line over the 12 months to its
 * newest table. "Rest of world" is the category less the four countries the
 * bulletin lists apart.
 */
export async function lineIssuance(bulletinCategory: string, country: string): Promise<LineIssuance | null> {
  const category = LINE_CATEGORY[bulletinCategory];
  const summary = await issuanceSummary();
  if (!category || !summary?.newest) return null;
  const to = summary.newest;
  const from = monthsBefore(to, 11);
  const got = await rows<{ group_key: string; month: string; n: unknown }>(
    `SELECT group_key, month, sum(n) AS n FROM visa_issuances
     WHERE dim = 'fsc' AND category = ? AND month >= ? AND month <= ? GROUP BY group_key, month`,
    [category, from, to],
  ).catch(() => []);
  if (!got.length) return null;
  const listed = new Set(Object.values(LINE_COUNTRY));
  const mine = got.filter((r) =>
    country === "worldwide" ? !listed.has(r.group_key) : r.group_key === LINE_COUNTRY[country],
  );
  return {
    category,
    wholeCategory: ["EB5R", "EB5HU", "EB5I"].includes(bulletinCategory),
    from,
    to,
    total: mine.reduce((a, r) => a + Number(r.n), 0),
    newest: mine.filter((r) => r.month === to).reduce((a, r) => a + Number(r.n), 0),
  };
}
