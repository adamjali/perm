/**
 * Formatting helpers for DOL processing-time data.
 *
 * Kept separate from the page so they can be unit tested. Every function here
 * is presentation only: none of them derive, estimate or extrapolate a figure.
 * The numbers on the page are the numbers DOL published.
 *
 * @module
 */

/**
 * Exported because QueueAlertForm needs the same twelve strings to label its
 * month picker, and had its own byte-identical copy four lines long in a
 * sibling file. One list, one place.
 */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * "2025-09" to "September 2025".
 *
 * Returns null for null input so a caller must decide what an absent value
 * looks like, rather than silently rendering a fabricated month.
 */
export function formatMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const idx = Number(m[2]) - 1;
  const name = MONTH_NAMES[idx];
  return name ? `${name} ${m[1]}` : null;
}

/**
 * "2026-08" to "Aug 2026". For axis labels and other tight columns.
 *
 * The full form overflows a chart gutter: "September 2024" is 98px at 13px
 * type, which ran past the left edge of a 96px axis gutter.
 */
export function formatMonthShort(value: string | null | undefined): string | null {
  const full = formatMonth(value);
  if (!full) return null;
  const [name, year] = full.split(" ");
  return name && year ? `${name.slice(0, 3)} ${year}` : full;
}

/** "2026-08-20" to "August 20, 2026". Used for DOL's own as-of stamps. */
export function formatAsOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const name = MONTH_NAMES[Number(m[2]) - 1];
  return name ? `${name} ${Number(m[3])}, ${m[1]}` : null;
}

/**
 * "2026-08-05" to "Aug 5, 2026". For tight columns, as formatMonthShort is.
 *
 * The long form overflows a narrow gutter: the I-485 release rows give the
 * date an 88px track below 640px, where "August 5, 2026" truncates and
 * "Aug 5, 2026" fits.
 */
export function formatAsOfShort(value: string | null | undefined): string | null {
  const full = formatAsOf(value);
  if (!full) return null;
  const [name, ...rest] = full.split(" ");
  return name ? `${name.slice(0, 3)} ${rest.join(" ")}` : full;
}

/**
 * Whole months from `from` to `to`, both "YYYY-MM".
 *
 * This is the forward-velocity measurement: how far the queue moved between
 * two snapshots we actually hold. It is arithmetic on two published dates, so
 * it stays a measurement and never becomes a projection.
 */
export function monthsMoved(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const f = /^(\d{4})-(\d{2})$/.exec(from);
  const t = /^(\d{4})-(\d{2})$/.exec(to);
  if (!f || !t) return null;
  return (Number(t[1]) - Number(f[1])) * 12 + (Number(t[2]) - Number(f[2]));
}

/**
 * Days between two "YYYY-MM-DD" stamps, used to caption a velocity figure.
 *
 * Accepts null/undefined like its neighbours rather than bare `string`. It
 * previously did not, which meant a caller could pass a "YYYY-MM" month where a
 * "YYYY-MM-DD" date was wanted and it compiled: `Date.parse("2025-09T00:00:00Z")`
 * is NaN, so the function returned null and the velocity section silently
 * vanished from the page with nothing to debug.
 */
export function daysBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** 14386 to "14,386". Null in, null out, like every other formatter here. */
export function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return n.toLocaleString("en-US");
}

/**
 * Turn a count of calendar days into a plain reading aid.
 * 372 becomes "about 12 months". Deliberately vague at the month level,
 * because pretending 372 days is "12.2 months" implies precision DOL's own
 * average does not carry.
 */
export function daysAsApproxMonths(days: number | null | undefined): string | null {
  // Guarded rather than trusting the caller: every upstream source of this
  // number is `number | null`, and an unguarded version renders the literal
  // string "about NaN months" onto a public page.
  if (days === null || days === undefined || !Number.isFinite(days) || days < 0) {
    return null;
  }
  const months = Math.round(days / 30.44);
  return `about ${months} month${months === 1 ? "" : "s"}`;
}

/**
 * Newest selectable filing month, computed once per server render.
 *
 * UTC deliberately: the alternative is the server's local month, which after
 * ~8pm ET is already tomorrow's in UTC terms and would disagree with anything
 * else deriving a month the same way.
 */
export function currentMonthUtc(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
