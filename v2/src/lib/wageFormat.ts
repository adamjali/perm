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

/** The yearly figure for a wage, when its unit says how to get there; else null. */
export function annualised(wage: number | null | undefined, unit: string | null | undefined): number | null {
  if (wage === null || wage === undefined || !Number.isFinite(wage) || wage <= 0) return null;
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
