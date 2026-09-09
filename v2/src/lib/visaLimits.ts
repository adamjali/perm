/**
 * The Department's own spillover figures, as stored by
 * scripts/ingest_visa_limits.py in perm_docs['visa_annual_limits'].
 *
 * Two sources, both PDFs the State Department publishes once a year: the
 * Annual Numerical Limits sheet (the employment worldwide total minus the
 * statutory 140,000 is the year's spillover from unused family numbers,
 * marked estimated until the official determination), and Table V of the
 * Report of the Visa Office (numbers used per preference the year before,
 * from which the unused family numbers are a subtraction). This module is
 * pure: it reads the document and shapes it for the page, and forecasts
 * nothing. A year the Department has not published is simply absent.
 */

export interface LimitRow {
  foreign_state: number | null;
  worldwide: number;
}

export interface LimitsYear {
  fiscal_year: number;
  estimated: boolean;
  family: Record<string, LimitRow>;
  employment: Record<string, LimitRow>;
  family_base: number;
  employment_base: number;
  spillover_to_employment: number;
  per_country_employment: number | null;
  notes: string[];
  source: string;
}

export interface TableVYear {
  fiscal_year: number;
  family: Record<string, number>;
  employment: Record<string, number | number[] | null>;
  grand_total: number;
  family_base: number;
  family_unused: number;
  source: string;
}

export interface VisaAnnualLimitsDoc {
  limits: Record<string, LimitsYear>;
  table_v: Record<string, TableVYear>;
  updated?: string;
  computedAt?: number;
}

/** The employment rows in the order the sheet prints them, with plain labels. */
export const EMPLOYMENT_ROW_LABELS: ReadonlyArray<[key: string, label: string]> = [
  ["E1", "EB-1"],
  ["E2", "EB-2"],
  ["E3/EW", "EB-3, including other workers"],
  ["E4/SR", "EB-4, including religious workers"],
  ["E5", "EB-5"],
  ["Total", "All employment-based"],
];

export interface SpilloverSummary {
  fiscalYear: number;
  estimated: boolean;
  employmentTotal: number;
  employmentBase: number;
  spillover: number;
  perCountry: number | null;
  rows: Array<{ label: string; worldwide: number; foreignState: number | null }>;
  source: string;
}

/** The newest fiscal year's limits, or null when the Department has published none we hold. */
export function latestLimits(doc: VisaAnnualLimitsDoc | null): SpilloverSummary | null {
  const years = Object.keys(doc?.limits ?? {}).map(Number).filter(Number.isFinite);
  if (years.length === 0 || !doc) return null;
  const y = doc.limits[String(Math.max(...years))];
  if (!y || !y.employment?.Total) return null;
  return {
    fiscalYear: y.fiscal_year,
    estimated: y.estimated,
    employmentTotal: y.employment.Total.worldwide,
    employmentBase: y.employment_base,
    spillover: y.spillover_to_employment,
    perCountry: y.per_country_employment,
    rows: EMPLOYMENT_ROW_LABELS.filter(([k]) => y.employment[k]).map(([k, label]) => ({
      label,
      worldwide: y.employment[k]!.worldwide,
      foreignState: y.employment[k]!.foreign_state,
    })),
    source: y.source,
  };
}

export interface UsageSummary {
  fiscalYear: number;
  familyUsed: number;
  familyBase: number;
  familyUnused: number;
  employmentUsed: number;
  source: string;
}

/** The newest Table V we hold: what was used, and the family numbers left over. */
export function latestUsage(doc: VisaAnnualLimitsDoc | null): UsageSummary | null {
  const years = Object.keys(doc?.table_v ?? {}).map(Number).filter(Number.isFinite);
  if (years.length === 0 || !doc) return null;
  const y = doc.table_v[String(Math.max(...years))];
  const familyUsed = y?.family?.total;
  const employmentUsed = y?.employment?.total;
  if (!y || typeof familyUsed !== "number" || typeof employmentUsed !== "number") return null;
  return {
    fiscalYear: y.fiscal_year,
    familyUsed,
    familyBase: y.family_base,
    familyUnused: y.family_unused,
    employmentUsed,
    source: y.source,
  };
}

export const fmtNumber = (n: number): string => n.toLocaleString("en-US");
