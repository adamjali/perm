/**
 * A wage as DOL's disclosure files carry it: an amount and a unit-of-pay
 * word. The PW file says YEAR / HOUR (and a stray HOURLY, ANNUAL, MONTH,
 * WEEK); the LCA file the same. Anything unrecognised prints the amount
 * with the unit lower-cased rather than guessing a period: a wrong "per
 * year" on an hourly figure is the misleading case, a plain "$65 hour" is
 * merely odd.
 */

const PERIOD: Record<string, string> = {
  YEAR: "per year",
  ANNUAL: "per year",
  YR: "per year",
  HOUR: "per hour",
  HOURLY: "per hour",
  HR: "per hour",
  MONTH: "per month",
  MONTHLY: "per month",
  WEEK: "per week",
  WEEKLY: "per week",
  "BI-WEEKLY": "every two weeks",
  BIWEEKLY: "every two weeks",
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
  const period = PERIOD[key];
  const hourly = period === "per hour";
  const amount = usd(wage, hourly || !Number.isInteger(wage));
  if (period) return `${amount} ${period}`;
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
 * $30,000 and $40,000, 1,378 above). Above these floors a wage is shown as
 * DOL printed it, with a note, and left out of every average and median.
 * The SQL twins are in src/lib/turso/lcaWages.ts and scripts/build_lca_facets.py.
 */
export const HOURLY_LOOKS_YEARLY = 10_000;
export const PERIOD_LOOKS_YEARLY = 40_000;

/** The note shown beside such a wage, and its short form for a table cell. */
export const LOOKS_YEARLY_NOTE =
  "As DOL printed it. The amount looks like a yearly salary filed under the wrong unit, so averages and medians leave it out.";
export const LOOKS_YEARLY_SHORT = "looks like yearly pay";

/** Whether this amount can't be pay for the period its unit names. */
export function looksYearly(wage: number | null | undefined, unit: string | null | undefined): boolean {
  if (wage === null || wage === undefined || !Number.isFinite(wage)) return false;
  const period = PERIOD[(unit ?? "").trim().toUpperCase()];
  if (period === "per hour") return wage >= HOURLY_LOOKS_YEARLY;
  if (period === "per week" || period === "every two weeks" || period === "per month") return wage >= PERIOD_LOOKS_YEARLY;
  return false;
}

/**
 * The yearly figure for a wage, when its unit says how to get there; else null.
 * Null too when the amount looks like a yearly salary under the wrong unit:
 * multiplying it out would give a figure nobody is paid.
 */
export function annualised(wage: number | null | undefined, unit: string | null | undefined): number | null {
  if (wage === null || wage === undefined || !Number.isFinite(wage) || wage <= 0) return null;
  if (looksYearly(wage, unit)) return null;
  const period = PERIOD[(unit ?? "").trim().toUpperCase()];
  switch (period) {
    case "per year":
      return wage;
    case "per hour":
      return wage * 2080;
    case "per month":
      return wage * 12;
    case "per week":
      return wage * 52;
    case "every two weeks":
      return wage * 26;
    default:
      return null;
  }
}
