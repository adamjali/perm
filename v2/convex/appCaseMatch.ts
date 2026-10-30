/**
 * "Is this your DOL case?" — find a saved case's DOL case number from the
 * employer and filing date the attorney already entered, so linking it (which
 * turns on the live status) is one tap instead of typing the number.
 *
 * It reads only the public mirror (DOL's own published records), behind
 * sign-in, and only ever SUGGESTS: the attorney confirms, so a loose match is
 * safe and nothing is ever applied automatically. The pure matching lives in
 * `convex/lib/caseMatch.ts`.
 *
 * @module
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { rows } from "./lib/publicMirror";
import {
  dateWindow,
  employerLike,
  rankCandidates,
  SEARCH_WINDOW_DAYS,
  type MatchResult,
} from "./lib/caseMatch";

const EMPTY: MatchResult = { candidates: [], likely: null };

export const suggestDolCase = action({
  args: {
    employerName: v.string(),
    /** `YYYY-MM-DD`: the PERM (ETA-9089) or PWD filing date. */
    filingDate: v.string(),
    program: v.union(v.literal("perm"), v.literal("pwd")),
  },
  returns: v.object({
    candidates: v.array(
      v.object({
        caseNumber: v.string(),
        status: v.string(),
        employer: v.union(v.string(), v.null()),
        jobTitle: v.union(v.string(), v.null()),
        filingDate: v.union(v.string(), v.null()),
      }),
    ),
    likely: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { employerName, filingDate, program }): Promise<MatchResult> => {
    // Signed-in only: this is an app convenience, not a public case-probing door.
    const userId = await getAuthUserId(ctx);
    if (!userId) return EMPTY;

    // Cheap shape gates before the read.
    if (employerName.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(filingDate)) return EMPTY;
    const like = employerLike(employerName);
    if (!like) return EMPTY;

    const [from, to] = dateWindow(filingDate, SEARCH_WINDOW_DAYS);
    // The table and prefix come from the validated `program` literal, never
    // from user text, so interpolating them is safe.
    const table = program === "pwd" ? "pwd_case_status" : "perm_case_status";
    const prefix = program === "pwd" ? "P-100-%" : "G-%";

    let mirror;
    try {
      mirror = await rows(
        `SELECT case_number, current_status, employer_name, job_title, filing_date
           FROM ${table}
          WHERE employer_name LIKE ? AND filing_date BETWEEN ? AND ? AND case_number LIKE ?
          LIMIT 60`,
        [like, from, to, prefix],
      );
    } catch {
      return EMPTY;
    }

    return rankCandidates(
      mirror.map((r) => ({
        caseNumber: String(r.case_number),
        status: String(r.current_status ?? ""),
        employer: r.employer_name == null ? null : String(r.employer_name),
        jobTitle: r.job_title == null ? null : String(r.job_title),
        filingDate: r.filing_date == null ? null : String(r.filing_date),
      })),
      filingDate,
    );
  },
});
