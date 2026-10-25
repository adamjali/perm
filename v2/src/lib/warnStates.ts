import { ISO_MONTH_RE, MONTH_ABBR, MONTH_NAMES, longDate, shortDate } from "@convex/lib/months";

/**
 * The states whose WARN notices the site reads (scripts/ingest_warn.py and
 * scripts/warn_states.py), by the code each row carries. `warnStates.test.ts`
 * holds this list to the readers, so a state added there gets its name here.
 */
export const WARN_STATE_NAMES: Readonly<Record<string, string>> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MS: "Mississippi",
  MT: "Montana",
  NE: "Nebraska",
  NJ: "New Jersey",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WI: "Wisconsin",
};

/** How many jurisdictions are read: 40 states and the District of Columbia. */
export const WARN_STATE_COUNT = Object.keys(WARN_STATE_NAMES).length;

export function warnStateName(code: string): string {
  return WARN_STATE_NAMES[code] ?? code;
}

/**
 * A notice's date as the state printed it. New Jersey and Pennsylvania print
 * only the month a notice was posted, stored as "2026-10", which reads
 * "Oct 2026" (or "October 2026"), never an invented day.
 */
export function warnDate(iso: string, style: "short" | "long" = "short"): string {
  if (ISO_MONTH_RE.test(iso)) {
    const [y, m] = iso.split("-");
    const names = style === "long" ? MONTH_NAMES : MONTH_ABBR;
    return `${names[Number(m) - 1]} ${y}`;
  }
  return (style === "long" ? longDate(iso) : shortDate(iso)) ?? iso;
}
