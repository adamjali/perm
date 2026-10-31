import { addDays, addMonths, addYears, differenceInCalendarDays, differenceInMonths, differenceInYears, format, isValid, parseISO } from "date-fns";

import { parseCutoff, type BulletinMonth, type ChartKind, type CountryKey } from "./priorityDate";

/**
 * The Child Status Protection Act age: whether a child counts as under 21 for a parent's green card.
 *
 * Two primary sources, read Oct 31 2026:
 *
 *  - INA 203(h)(1), 8 U.S.C. 1153(h)(1): the age "on the date on which an immigrant visa number becomes
 *    available", reduced by the days the petition was pending, "but only if the alien has sought to acquire"
 *    permanent residence "within one year of such availability".
 *  - USCIS Policy Manual, Volume 7, Part A, Chapter 7 (current as of October 27, 2026):
 *    - pending time is the approval date less the filing date;
 *    - the visa is available on the later of the approval date and the first day of the bulletin month whose Final
 *      Action Dates chart shows the priority date current (for I-485s filed on or after August 15, 2025; earlier
 *      ones are read on the chart USCIS named for filing that month, the February 14, 2023 guidance);
 *    - a visa that becomes unavailable before anything is filed fixes nothing, and the next availability counts;
 *    - the year to seek to acquire runs from the availability date; a visa unavailable before a full continuous
 *      year passes gives a new year from the next availability, but a full year with nothing filed loses the
 *      protection (barring extraordinary circumstances, which are USCIS's call).
 *
 * The calculator reads the bulletin archive month by month for the line, finds each run of months the date was
 * current, and applies those rules to it. It never decides marriage, extraordinary circumstances or which petition
 * the application rests on: those are facts the reader supplies or an officer finds.
 */

export const CSPA_AGE_LIMIT_YEARS = 21;
/** I-485s received on or after this day are read on the Final Action Dates chart (the August 2025 update). */
export const CSPA_FINAL_ACTION_POLICY_FROM = "2025-08-15";

export interface CspaInput {
  /** The child's date of birth, YYYY-MM-DD. */
  birthDate: string;
  /** The receipt date of the petition the green card rests on (for a work-based derivative, the parent's I-140). */
  petitionFiled: string;
  /** Its approval date, if it has been approved. */
  petitionApproved?: string;
  /** The priority date the green card is in line with (it can come from an earlier petition). */
  priorityDate: string;
  category: string;
  country: CountryKey;
  bulletins: readonly BulletinMonth[];
  /** When the child sought to acquire: the I-485 filed, the DS-260 submitted, or the visa fee paid. */
  soughtToAcquire?: string;
  /** Which chart decides availability. Final Action is current policy; Dates for Filing is for former-policy cases. */
  chart?: ChartKind;
  today: string;
}

export interface Age {
  years: number;
  months: number;
  days: number;
}

export interface CspaWindow {
  /** The day the visa counts as available: the later of the approval and the first of the bulletin month. */
  availableFrom: string;
  /** The last day of the run's last current month. */
  through: string;
  /** The run reaches the newest bulletin held, so it may still be going. */
  open: boolean;
  /** The visa stayed available, month after month, for a whole year from `availableFrom`. */
  fullYear: boolean;
  /** One year from `availableFrom`, less a day: the last day to seek to acquire while it stays available. */
  seekBy: string;
  /** The age on `availableFrom`, less the pending days. Null while the petition is pending. */
  cspaAge: Age | null;
  underTwentyOne: boolean | null;
}

export type CspaStatus =
  | "pending-petition"
  | "not-yet-available"
  | "open"
  | "locked"
  | "filed-waiting"
  | "lost";

export interface CspaResult {
  turns21: string;
  /** Approval less filing, in days. Null while the petition is pending. */
  pendingDays: number | null;
  /** Days the petition has been pending so far, while it is. */
  pendingSoFar: number | null;
  /** The last day a visa can become available with the CSPA age still under 21. */
  lastQualifyingDay: string | null;
  /** While the petition is pending: the last qualifying day if it were approved today. It moves a day later each day. */
  lastQualifyingDayIfApprovedToday: string | null;
  windows: CspaWindow[];
  status: CspaStatus;
  /** The window the answer turns on: the one the age is fixed in, open in, or lost in. */
  counted: CspaWindow | null;
  /** Bulletin months the archive is missing for this line, from the approval to the newest bulletin. */
  missingMonths: string[];
  newestBulletin: string | null;
  /** The I-485 was filed before August 15, 2025, which USCIS reads under the former policy. */
  formerPolicy: boolean;
  chart: ChartKind;
  caveats: string[];
  citations: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const day = (s: string) => parseISO(s);

function checkDate(name: string, value: string | undefined): void {
  if (value === undefined) return;
  if (!DATE_RE.test(value) || !isValid(day(value)) || iso(day(value)) !== value) {
    throw new Error(`${name}: expected a real date as YYYY-MM-DD, got ${JSON.stringify(value)}`);
  }
}

/** Whole years, then months, then days, from `from` to `to`. */
export function ageBetween(from: string, to: string): Age {
  const a = day(from);
  const b = day(to);
  const years = differenceInYears(b, a);
  const afterYears = addYears(a, years);
  const months = differenceInMonths(b, afterYears);
  const afterMonths = addMonths(afterYears, months);
  return { years, months, days: differenceInCalendarDays(b, afterMonths) };
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const monthOf = (isoDay: string) => isoDay.slice(0, 7);
const lastDayOf = (ym: string) => iso(addDays(parseISO(`${nextMonth(ym)}-01`), -1));
const monthName = (ym: string) => format(parseISO(`${ym}-01`), "MMMM yyyy");

type MonthState = "current" | "not-current" | "unknown";

/** Each bulletin month from the first held to the newest, and whether the priority date was current in it. */
function monthStates(input: CspaInput, chart: ChartKind): Array<{ month: string; state: MonthState }> {
  const held = new Map(input.bulletins.map((b) => [b.bulletinMonth, b] as const));
  const months = [...held.keys()].sort();
  if (months.length === 0) return [];
  const out: Array<{ month: string; state: MonthState }> = [];
  for (let m = months[0]!; m <= months[months.length - 1]!; m = nextMonth(m)) {
    const b = held.get(m);
    const cutoff = b ? parseCutoff(b[chart]?.[input.category]?.[input.country]) : null;
    let state: MonthState = "unknown";
    if (cutoff?.kind === "current") state = "current";
    else if (cutoff?.kind === "unavailable") state = "not-current";
    // "Earlier than the final action date": the cutoff day itself isn't current.
    else if (cutoff?.kind === "date") state = input.priorityDate < cutoff.iso ? "current" : "not-current";
    out.push({ month: m, state });
  }
  return out;
}

export function calculateCspa(input: CspaInput): CspaResult {
  checkDate("birthDate", input.birthDate);
  checkDate("petitionFiled", input.petitionFiled);
  checkDate("petitionApproved", input.petitionApproved);
  checkDate("priorityDate", input.priorityDate);
  checkDate("soughtToAcquire", input.soughtToAcquire);
  checkDate("today", input.today);
  if (input.petitionApproved && input.petitionApproved < input.petitionFiled) {
    throw new Error("petitionApproved: the petition can't be approved before it was filed");
  }
  const chart: ChartKind = input.chart ?? "finalAction";
  const turns21 = iso(addYears(day(input.birthDate), CSPA_AGE_LIMIT_YEARS));
  const approved = input.petitionApproved ?? null;
  const pendingDays = approved ? differenceInCalendarDays(day(approved), day(input.petitionFiled)) : null;
  const pendingSoFar = approved ? null : Math.max(0, differenceInCalendarDays(day(input.today), day(input.petitionFiled)));
  const lastDayFor = (pending: number) => iso(addDays(day(turns21), pending - 1));
  const sought = input.soughtToAcquire ?? null;
  const formerPolicy = sought !== null && sought < CSPA_FINAL_ACTION_POLICY_FROM;

  const states = monthStates(input, chart);
  const newestBulletin = states.length ? states[states.length - 1]!.month : null;
  const stateOf = new Map(states.map((s) => [s.month, s.state] as const));

  // Runs of consecutive current months; an unknown month ends a run, since nothing says the visa stayed available.
  const runs: Array<{ first: string; last: string }> = [];
  for (const s of states) {
    const prev = runs[runs.length - 1];
    if (s.state !== "current") continue;
    if (prev && nextMonth(prev.last) === s.month) prev.last = s.month;
    else runs.push({ first: s.month, last: s.month });
  }

  const windows: CspaWindow[] = [];
  if (approved) {
    for (const run of runs) {
      const through = lastDayOf(run.last);
      if (approved > through) continue;
      const firstOfMonth = `${run.first}-01`;
      const availableFrom = approved > firstOfMonth ? approved : firstOfMonth;
      const seekBy = iso(addDays(addYears(day(availableFrom), 1), -1));
      // A whole year means every bulletin month that touches the year was current.
      let fullYear = true;
      for (let m = monthOf(availableFrom); m <= monthOf(seekBy); m = nextMonth(m)) {
        if (stateOf.get(m) !== "current") {
          fullYear = false;
          break;
        }
      }
      const effective = iso(addDays(day(availableFrom), -pendingDays!));
      const cspaAge = ageBetween(input.birthDate, effective);
      windows.push({
        availableFrom,
        through,
        open: run.last === newestBulletin,
        fullYear,
        seekBy,
        cspaAge,
        underTwentyOne: effective < turns21,
      });
    }
  }

  let status: CspaStatus;
  let counted: CspaWindow | null = null;
  if (!approved) {
    status = "pending-petition";
  } else {
    let resolved: CspaStatus | null = null;
    for (const w of windows) {
      if (sought !== null && sought <= w.through) {
        // Filed before the visa was available (on the Dates for Filing chart) or inside the year: fixed here.
        resolved = sought <= w.seekBy ? "locked" : "lost";
        counted = w;
        break;
      }
      if (w.fullYear) {
        // A continuous year passed with nothing filed in it.
        resolved = "lost";
        counted = w;
        break;
      }
      if (w.open) {
        // Still current at the newest bulletin. A filing dated after it is fixed here only inside the year.
        resolved = sought !== null && sought <= w.seekBy ? "locked" : "open";
        counted = w;
        break;
      }
      // Unavailable again inside the year: nothing fixed, the next availability starts a new year.
    }
    status = resolved ?? (sought !== null ? "filed-waiting" : "not-yet-available");
  }

  const fromMonth = approved ? monthOf(approved) : monthOf(input.petitionFiled);
  const missingMonths = states.filter((s) => s.state === "unknown" && s.month >= fromMonth).map((s) => s.month);

  const caveats: string[] = [];
  if (missingMonths.length > 0) {
    const named = missingMonths.slice(0, 4).map(monthName).join(", ");
    caveats.push(
      `The archive has no reading of this line for ${missingMonths.length === 1 ? named : `${missingMonths.length} months (${named}${missingMonths.length > 4 ? " and more" : ""})`}, so whether the visa stayed available through ${missingMonths.length === 1 ? "it" : "them"} can't be read here. Check State's own bulletin for ${missingMonths.length === 1 ? "that month" : "those months"}.`,
    );
  }
  if (formerPolicy) {
    caveats.push(
      "The I-485 was filed before August 15, 2025. For those, USCIS counts the visa available from the chart it named for filing that month (its February 14, 2023 guidance), which was often the Dates for Filing chart. Switch the chart to see that reading.",
    );
  }
  if (newestBulletin && counted?.open && status === "open") {
    caveats.push(
      `The newest bulletin held here is ${monthName(newestBulletin)}. The year to file assumes the date stays current every month until then; a month that retrogresses first gives a new year from the next availability.`,
    );
  }

  return {
    turns21,
    pendingDays,
    pendingSoFar,
    lastQualifyingDay: pendingDays === null ? null : lastDayFor(pendingDays),
    lastQualifyingDayIfApprovedToday: pendingSoFar === null ? null : lastDayFor(pendingSoFar),
    windows,
    status,
    counted,
    missingMonths,
    newestBulletin,
    formerPolicy,
    chart,
    caveats,
    citations: [
      "INA 203(h)(1), 8 U.S.C. 1153(h)(1): the age on the day a visa becomes available, less the days the petition was pending, if permanent residence was sought within a year.",
      "USCIS Policy Manual, Volume 7, Part A, Chapter 7: pending time is approval less filing; the visa is available on the later of the approval and the first of the Final Action month (I-485s filed from August 15, 2025).",
      "USCIS Policy Manual, Volume 7, Part A, Chapter 7, sections F.5 and G: retrogression before filing fixes nothing; a full year of availability with nothing filed loses the protection.",
      "INA 101(b)(1), 8 U.S.C. 1101(b)(1): a child is unmarried and under 21, so marrying ends it whatever the CSPA age.",
    ],
  };
}
