import "server-only";

import { cache } from "react";
import { measurePace, type DecisionDay, type MeasuredPace } from "@/lib/perm";
import { rows } from "./client";

/**
 * How fast DOL is deciding right now, measured over our own observed series.
 *
 * WHERE THE NUMBERS COME FROM. `daily_decisions` carries two sources and only
 * one of them can answer "recently": `dol-disclosure` is dated by DOL's own
 * decision date and stops at the last published quarter (currently
 * 2026-06-30), so "the last 28 days" does not exist in it. `sweep-observed`
 * is written by every sweep from `perm_case_events` and is dated by when our
 * sweep SAW a case become final. That is a different measurement and it is
 * labelled as one everywhere it is published.
 *
 * IT IS VALIDATED AGAINST AN INDEPENDENT SOURCE, which is what makes it
 * usable as a rate rather than merely available. Measured 2026-09-13 over the
 * 16 days our series and permupdate's published `daily-volume` both cover:
 * our mean 574.6/day against their 566.4, a difference of **+1.4%**.
 * Individual days diverge by more, because a day boundary falls in a
 * different place for each of us - but the model divides by a 28-day mean,
 * and the mean is the quantity that agrees.
 *
 * One consequence worth stating rather than discovering later: our
 * day-boundary noise inflates the weekday spread that the BAND is built from,
 * so the band is wider than DOL's true daily variation would produce. That
 * errs toward claiming less.
 *
 * WHY NOT A PRECOMPUTED DOC. Every other derived figure on this site is
 * folded into `perm_docs` by the ingest because the live query is a table
 * scan. This one is at most 35 rows off a primary key, so a doc would be a
 * second copy of a table we already keep, with a second way to go stale.
 */

/** The source name the sweep writes. Must match `OBSERVED_SOURCE` in the ingest. */
export const OBSERVED_SOURCE = "sweep-observed";

/**
 * Calendar days of history to ask for.
 *
 * The model wants 28. Asking for a few more lets it still measure when a day
 * is missing from the series - a day the sweep withheld because a bulk
 * timestamp landed on it, which is a real and correct thing for it to do.
 */
const WINDOW_DAYS = 35;

/**
 * Past this many days without a fresh row the series is not "recent" any more.
 *
 * Shorter than the eight days the precomputed docs use, because this one
 * describes a RATE over a rolling window: a series that stopped three days ago
 * is already averaging a window that no longer ends today.
 */
export const MAX_SERIES_AGE_DAYS = 3;

export interface DecisionPaceReading {
  pace: MeasuredPace;
  /** ISO date of the newest day in the series. */
  through: string;
  /** Calendar days actually returned, before the model drops any. */
  daysObserved: number;
}

/**
 * Measure the pace, or return null.
 *
 * Null on every path where a number would be invented: no series, a series
 * that has stopped, or too few usable days for `measurePace` to commit to a
 * rate. Callers omit the decision-pace model rather than substituting one.
 */
export const getDecisionPace = cache(
  async (): Promise<DecisionPaceReading | null> => {
    const got = await rows<{ date: string; total: number | string }>(
      `SELECT date, total FROM daily_decisions
        WHERE source = ?
          AND date >= date('now', ?)
        ORDER BY date DESC`,
      [OBSERVED_SOURCE, `-${WINDOW_DAYS} day`],
    ).catch(() => null);
    if (!got || got.length === 0) return null;

    // THE MAXIMUM, NOT THE FIRST ROW. `through` is what the staleness guard
    // below is measured against, so taking it from the query's ordering makes
    // the guard silently depend on an ORDER BY three lines away: change the
    // index or the sort and a series that stopped a fortnight ago starts
    // reporting itself fresh. ISO dates compare correctly as strings.
    let through = "";
    for (const r of got) if (r.date > through) through = r.date;
    if (!through) return null;
    const ageDays = Math.floor(
      (Date.now() - Date.parse(`${through}T00:00:00Z`)) / 86_400_000,
    );
    if (ageDays > MAX_SERIES_AGE_DAYS) return null;

    const days: DecisionDay[] = [];
    for (const r of got) {
      const t = Date.parse(`${r.date}T00:00:00Z`);
      if (Number.isNaN(t)) continue;
      // libSQL hands integers back as strings often enough that this has bitten
      // three separate diffs in this repo. Coerce, never trust.
      const n = Number(r.total);
      if (!Number.isFinite(n)) continue;
      days.push({ dayOfWeek: new Date(t).getUTCDay(), n });
    }
    // Chronological, because that is what a caller reading this expects a
    // series to be. NOT load-bearing today: `measurePace` splits by weekday,
    // detects collapse runs and takes means, and all three are order-
    // invariant - `decisionPace.test.ts` pins that with an explicit shuffle.
    // It is kept because the first change that DOES depend on order (weighting
    // recent days more, say) would otherwise be silently wrong on a reversed
    // input, and because a test asserting the reverse could not tell you.
    days.reverse();

    const pace = measurePace(days);
    if (!pace) return null;
    return { pace, through, daysObserved: days.length };
  },
);
