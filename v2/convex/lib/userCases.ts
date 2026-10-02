/**
 * One read of a signed-in user's cases, shared by every list that shows them
 * (the case list, select-all, the dashboard, the calendar, the timeline,
 * calendar sync and the chat's case data).
 *
 * A plain `.withIndex("by_user_id").take(1000)` has three faults, all silent:
 *   - it reads OLDEST first, so the newest cases are the ones that fall off;
 *   - soft-deleted cases count toward the limit, so an account that has
 *     deleted cases loses live ones sooner;
 *   - nothing on any page says a case was left out.
 *
 * Here the index leaves deleted cases out, the read goes newest first (so a
 * ceiling drops the oldest), the result is returned oldest first, and
 * `truncated` says when more cases exist than were read, so each page can say
 * so. The ceiling is set by Convex's own read limits (32,000 documents and
 * 16 MiB a transaction): a case document is usually a few KB, and the loop
 * stops early, still with `truncated`, if its bytes run low, leaving room for
 * the rest of the query.
 */
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** The most cases one read returns. */
export const USER_CASES_MAX = 5_000;

/** Bytes kept back for the rest of the query (decrypting, joins, the reply). */
const READ_RESERVE_BYTES = 4 * 1024 * 1024;

/** How often the loop checks its remaining read budget. */
const METRICS_EVERY = 100;

export interface UserCasesRead {
  /**
   * Non-deleted cases, OLDEST first: the order every caller had before, which
   * their sorts break ties with. The read itself goes newest first, so it is
   * the oldest that a ceiling leaves out.
   */
  cases: Doc<"cases">[];
  /** True when the user has more non-deleted cases than were read. */
  truncated: boolean;
}

export async function readUserCases(
  ctx: Pick<QueryCtx, "db" | "meta">,
  userId: Id<"users">,
  max: number = USER_CASES_MAX
): Promise<UserCasesRead> {
  const cases: Doc<"cases">[] = [];
  const rows = ctx.db
    .query("cases")
    .withIndex("by_user_and_deleted", (q) =>
      q.eq("userId", userId).eq("deletedAt", undefined)
    )
    .order("desc");
  for await (const c of rows) {
    // A row in hand that will not be returned is what makes `truncated` true,
    // so the flag never claims more cases than exist.
    if (cases.length >= max) return { cases: cases.reverse(), truncated: true };
    if (cases.length > 0 && cases.length % METRICS_EVERY === 0) {
      const metrics = await ctx.meta.getTransactionMetrics();
      if (metrics.bytesRead.remaining < READ_RESERVE_BYTES) {
        return { cases: cases.reverse(), truncated: true };
      }
    }
    cases.push(c);
  }
  return { cases: cases.reverse(), truncated: false };
}
