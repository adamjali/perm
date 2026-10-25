import "server-only";

import { cache } from "react";

import {
  daysBefore,
  foldSpellings,
  rankEmployers,
  weeklyCounts,
  type EmployerRow,
  type FoldedValue,
  type SpellingRow,
  type WeekCount,
} from "@/lib/byTheNumbers";
import { easternDay } from "@/lib/seasonalTiming";

import { rows } from "./client";
import { DIRECT_EVENT_SOURCE } from "./rfi";

/**
 * The counts behind "PERM by the numbers" that no precomputed document
 * already holds: new filings by week and by job, the employers filing most,
 * employers new to PERM, and RFIs issued per week.
 *
 * Each query is bounded by a date and served by an index (`perm_live_recent`
 * by filing date, `perm_case_events` by status and time), and the page that
 * reads them regenerates a few times a day, so the cost is a few small reads a
 * day, not one per visit.
 *
 * A FAILED READ THROWS. The page keeps its last good render when a
 * regeneration fails, which beats printing a count of zero for a read that
 * never happened.
 */

/** The window for "filed in the last 30 days" and its ranked lists. */
export const RECENT_DAYS = 30;
/** The window for "employers new to PERM". */
export const NEW_EMPLOYER_DAYS = 90;
/** How many weeks of new filings the chart draws at most. */
export const FILING_WEEKS = 17;

export interface RecentFilings {
  /** The last day counted, Eastern. */
  through: string;
  /** Cases filed in the last 30 days, and the employers that filed them. */
  cases30: number;
  employers30: number;
  /** New filings per week, oldest first, the newest week partial. */
  weeks: WeekCount[];
  /** The jobs filed most in the last 30 days, as DOL printed them. */
  jobs: FoldedValue[];
  /** The employers that filed most in the last 30 days. */
  employers: FoldedValue[];
}

export const getRecentFilings = cache(async (): Promise<RecentFilings> => {
  const through = easternDay();
  const since30 = daysBefore(through, RECENT_DAYS - 1);
  // The live table holds every case DOL's published files don't, so it is
  // complete for filings made after the newest published decision. Weeks are
  // drawn only from there, or a published case would read as missing.
  const [published] = await rows<{ d: string | null }>("SELECT MAX(decision_date) AS d FROM perm_cases");
  const weeksFrom = daysBefore(through, FILING_WEEKS * 7);
  const from = published?.d && published.d >= weeksFrom ? daysBefore(published.d, -1) : weeksFrom;

  const [byDay, recent] = await Promise.all([
    rows<{ d: string; n: number }>(
      "SELECT filing_date AS d, COUNT(*) AS n FROM perm_live_recent WHERE filing_date >= ? AND filing_date <= ? GROUP BY filing_date",
      [from, through],
    ),
    rows<{ title: string | null; slug: string | null; name: string | null; n: number }>(
      "SELECT job_title AS title, employer_slug AS slug, employer_name AS name, COUNT(*) AS n " +
        "FROM perm_live_recent WHERE filing_date >= ? AND filing_date <= ? " +
        "GROUP BY job_title, employer_slug, employer_name",
      [since30, through],
    ),
  ]);

  const titleRows: SpellingRow[] = recent.map((r) => ({ value: r.title, slug: r.slug, n: Number(r.n) }));
  const employerRows: EmployerRow[] = recent.map((r) => ({ slug: r.slug, name: r.name, n: Number(r.n) }));
  const slugs = new Set(recent.map((r) => r.slug).filter(Boolean));
  return {
    through,
    cases30: recent.reduce((a, r) => a + Number(r.n), 0),
    employers30: slugs.size,
    weeks: weeklyCounts(byDay.map((r) => ({ date: r.d, count: Number(r.n) })), from, through),
    jobs: foldSpellings(titleRows, 10),
    employers: rankEmployers(employerRows, 8),
  };
});

export interface NewEmployers {
  through: string;
  /** Employers whose first PERM case we've seen is in the window. */
  employers: number;
  /** The cases they filed. */
  cases: number;
  /** First filings per week, oldest first. */
  weeks: WeekCount[];
  /** The new employers with the most cases. */
  top: FoldedValue[];
}

/**
 * Employers new to PERM: their first case in our record was filed in the last
 * 90 days, and DOL's published files back to October 2015 hold no decided
 * case under the same name. A company that filed before under a different
 * spelling can still appear here, and the page says so.
 */
const NEW_EMPLOYER_SQL =
  "FROM perm_live_only_index o WHERE o.first_filed >= ? AND o.first_filed <= ? " +
  "AND NOT EXISTS (SELECT 1 FROM perm_cases_history h WHERE h.employer_slug = o.slug) " +
  "AND NOT EXISTS (SELECT 1 FROM perm_cases c WHERE c.employer_slug = o.slug)";

export const getNewEmployers = cache(async (): Promise<NewEmployers> => {
  const through = easternDay();
  const since = daysBefore(through, NEW_EMPLOYER_DAYS - 1);
  const [byDay, top] = await Promise.all([
    rows<{ d: string; n: number; c: number }>(
      `SELECT o.first_filed AS d, COUNT(*) AS n, SUM(o.cases) AS c ${NEW_EMPLOYER_SQL} GROUP BY o.first_filed`,
      [since, through],
    ),
    rows<{ slug: string; name: string; cases: number }>(
      `SELECT o.slug AS slug, o.name AS name, o.cases AS cases ${NEW_EMPLOYER_SQL} ORDER BY o.cases DESC, o.slug LIMIT 8`,
      [since, through],
    ),
  ]);
  return {
    through,
    employers: byDay.reduce((a, r) => a + Number(r.n), 0),
    cases: byDay.reduce((a, r) => a + Number(r.c), 0),
    weeks: weeklyCounts(byDay.map((r) => ({ date: r.d, count: Number(r.n) })), since, through),
    top: top.map((r) => ({ label: r.name, cases: Number(r.cases), employers: 1, slug: r.slug })),
  };
});

/** The day our case-status log begins (Eastern): nothing before it was observed. */
export const EVENT_LOG_FROM = "2026-08-27";

export interface RfiWeeks {
  through: string;
  /** RFIs DOL issued per week, as our sweep saw them, oldest first. */
  weeks: WeekCount[];
  /** All of them in the weeks drawn. */
  total: number;
}

/**
 * RFIs issued per week, dated by the Eastern day our sweep first saw each one.
 * Only the direct DOL record counts: the retired mirror's reconciliations were
 * differences against a stale copy, not RFIs DOL issued that day.
 */
export const getRfiWeeks = cache(async (): Promise<RfiWeeks> => {
  const through = easternDay();
  const fromMs = Date.parse(`${EVENT_LOG_FROM}T04:00:00Z`);
  const r = await rows<{ t: number }>(
    "SELECT changed_at AS t FROM perm_case_events WHERE to_status = 'RFI ISSUED' AND changed_at >= ? AND source = ?",
    [fromMs, DIRECT_EVENT_SOURCE],
  );
  const byDay = new Map<string, number>();
  for (const x of r) {
    const day = easternDay(new Date(Number(x.t)));
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const weeks = weeklyCounts([...byDay].map(([date, count]) => ({ date, count })), EVENT_LOG_FROM, through);
  // The total is the weeks' own sum, so the figure and the chart can't disagree
  // about the days before the first full week.
  return { through, weeks, total: weeks.reduce((a, w) => a + w.count, 0) };
});

/**
 * Every visa bulletin month the archive holds. Named `getVisaBulletins...` so
 * the bulletin revalidation finds the page that reads it.
 */
export const getVisaBulletinsHeld = cache(async (): Promise<string[]> => {
  const r = await rows<{ m: string }>("SELECT bulletin_month AS m FROM visa_bulletins ORDER BY bulletin_month LIMIT 2000");
  return r.map((x) => String(x.m));
});
