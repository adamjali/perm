/**
 * A wage as DOL's disclosure files carry it: an amount and a unit-of-pay
 * word. The PW file says YEAR / HOUR (and a stray HOURLY, ANNUAL, MONTH,
 * WEEK); the LCA file the same. Anything unrecognised prints the amount
 * with the unit lower-cased rather than guessing a period: a wrong "per
 * year" on an hourly figure is the misleading case, a plain "$65 hour" is
 * merely odd.
 */

import table from "../../scripts/data/pay_periods.json";

/**
 * Each pay period DOL's files use: the spellings it prints, how many make a
 * year, and the amount past which a figure can't be pay for that period. One
 * table, `scripts/data/pay_periods.json`, which the data scripts read too
 * (scripts/lib_wage.py), so the yearly figure a page computes and the one a
 * precomputed doc holds are one rule.
 */
interface PayPeriod {
  label: string;
  perYear: number;
  looksYearlyFrom: number | null;
  spellings: string[];
}

export const PAY_PERIODS: readonly PayPeriod[] = table.periods;
const PERIOD: Readonly<Record<string, PayPeriod>> = Object.fromEntries(
  PAY_PERIODS.flatMap((p) => p.spellings.map((s) => [s, p] as const)),
);
const periodOf = (unit: string | null | undefined): PayPeriod | undefined => PERIOD[(unit ?? "").trim().toUpperCase()];

/** DOL counts a wage year as 2,080 hours. */
export const HOURS_PER_YEAR = PAY_PERIODS.find((p) => p.label === "per hour")?.perYear ?? 0;

/** The plausible yearly figure, lowest and highest: outside it is a data defect, not an offer. */
export const YEARLY_BAND: Readonly<Record<"perm" | "flag", readonly [number, number]>> = {
  perm: [table.yearlyBands.perm[0] ?? 0, table.yearlyBands.perm[1] ?? 0],
  flag: [table.yearlyBands.flag[0] ?? 0, table.yearlyBands.flag[1] ?? 0],
};

const usd = (n: number, cents: boolean) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

/** `$241,925 per year`, `$65.00 per hour`, or null when there is no amount. */
export function formatWage(wage: number | null | undefined, unit: string | null | undefined): string | null {
  if (wage === null || wage === undefined || !Number.isFinite(wage) || wage <= 0) return null;
  const key = (unit ?? "").trim().toUpperCase();
  const period = periodOf(unit);
  const amount = usd(wage, period?.perYear === HOURS_PER_YEAR || !Number.isInteger(wage));
  if (period) return `${amount} ${period.label}`;
  return key ? `${amount} ${key.toLowerCase()}` : amount;
}

/**
 * DOL's files carry a few thousand wages that can't be pay for the period they
 * name: $95,000 "per hour", $120,000 "per week", $100,000 "per month". They're
 * yearly salaries filed under the wrong unit. Measured Oct 3 2026 over 3.65
 * million LCA rows, the amounts fall in two groups with a gap between: hourly
 * amounts thin out under $1,000 and start again at $10,000 (6 rows between
 * $10,000 and $20,000, 2,307 above), and weekly, bi-weekly and monthly ones
 * thin out above $20,000 and start again at $40,000 (11 monthly rows between
 * $30,000 and $40,000, 1,378 above). From each period's `looksYearlyFrom` a
 * wage is shown as DOL printed it, with a note, and left out of every average
 * and median.
 */

/** The note shown beside such a wage, and its short form for a table cell. */
export const LOOKS_YEARLY_NOTE =
  "As DOL printed it. The amount looks like a yearly salary filed under the wrong unit, so averages and medians leave it out.";
export const LOOKS_YEARLY_SHORT = "looks like yearly pay";

/** Whether this amount can't be pay for the period its unit names. */
export function looksYearly(wage: number | null | undefined, unit: string | null | undefined): boolean {
  if (wage === null || wage === undefined || !Number.isFinite(wage)) return false;
  const from = periodOf(unit)?.looksYearlyFrom;
  return from !== null && from !== undefined && wage >= from;
}

/**
 * The yearly figure for a wage, when its unit says how to get there; else null.
 * Null too when the amount looks like a yearly salary under the wrong unit:
 * multiplying it out would give a figure nobody is paid.
 */
export function annualised(wage: number | null | undefined, unit: string | null | undefined): number | null {
  if (wage === null || wage === undefined || !Number.isFinite(wage) || wage <= 0) return null;
  if (looksYearly(wage, unit)) return null;
  const period = periodOf(unit);
  return period ? wage * period.perYear : null;
}

/**
 * The figure to compare one row's wage with another's: yearly. A PERM row
 * carries no unit because the ingest stored it yearly already; a wage-request,
 * LCA or seasonal row carries the unit DOL printed. Display is a different
 * question (`formatWage` prints the amount as published).
 */
export function comparableWage(wage: number | null | undefined, unit: string | null | undefined): number | null {
  if (wage === null || wage === undefined) return null;
  return unit ? annualised(wage, unit) : wage;
}

const spellingList = (p: PayPeriod) => p.spellings.map((s) => `'${s}'`).join(", ");

/**
 * The same rule in SQL, over a row's `wage` and `wage_unit`: yearly dollars, or
 * NULL for an unknown unit or an amount that can't be pay for its period.
 * scripts/lib_wage.py builds the same text from the same table, and
 * scripts/fixtures/annual_wage_sql.txt holds both to it.
 */
export const ANNUAL_WAGE_SQL = `CASE ${[
  ...PAY_PERIODS.filter((p) => p.looksYearlyFrom !== null).map(
    (p) => `WHEN wage_unit IN (${spellingList(p)}) AND wage >= ${p.looksYearlyFrom} THEN NULL`,
  ),
  ...PAY_PERIODS.map((p) => `WHEN wage_unit IN (${spellingList(p)}) THEN ${p.perYear === 1 ? "wage" : `wage * ${p.perYear}`}`),
].join(" ")} END`;
