/**
 * The October 2025 appropriations lapse, and the one PERM deadline it moved.
 *
 * OFLC stopped processing on 1 October 2025 and took FLAG offline, so for 33
 * calendar days employers could not file at all. On 5 November 2025 DOL
 * published what it would do about the deadlines that fell inside that
 * window. Most of the announcement is about extending response deadlines,
 * which this calculator does not compute. One paragraph is about a deadline
 * it does compute, and it says the regulation was not enforced:
 *
 *   "Regarding the PERM program, if an employer's recruitment efforts or
 *   prevailing wage determination expired between October 1 and November 2,
 *   2025, the employer impacted by these circumstances may submit
 *   applications electronically using the expired recruitment efforts or
 *   prevailing wage determination during the same 33 calendar day period
 *   during which an automatic deadline extension has been provided."
 *
 * WHY THIS IS A NOTE AND NOT A CHANGE TO THE ARITHMETIC. 20 CFR 656.40(c) and
 * 656.17(e) still say what they say, and a case is still judged against them.
 * DOL described a filing it would accept, and told employers FLAG would warn
 * them and let them through anyway. Moving the computed date would publish a
 * legal deadline that no regulation carries and that no longer applies to
 * anyone filing now. Printing "your window closed" with nothing beside it
 * would be wrong for the one cohort this covers. So the date stays, and the
 * exception is stated next to it with DOL's own words.
 *
 * It is ten months old at the time of writing and covers a single 33-day
 * window that cannot recur, which is why it earns one band on one tool
 * rather than a place in the model.
 */

/** First day of the affected window, inclusive. DOL's own boundary. */
export const SHUTDOWN_WINDOW_START = "2025-10-01";

/** Last day of the affected window, inclusive. DOL's own boundary. */
export const SHUTDOWN_WINDOW_END = "2025-11-02";

/** The announcement this note is drawn from. */
export const SHUTDOWN_SOURCE_URL =
  "https://www.dol.gov/agencies/eta/foreign-labor/news";

/** The date DOL published it. */
export const SHUTDOWN_ANNOUNCED = "2025-11-05";

/**
 * DOL's sentence, verbatim, minus the leading "Regarding the PERM program,".
 *
 * Quoted rather than paraphrased because the whole value of the note is that
 * a reader can check it against the source. A summary of a rule is a claim; a
 * quotation with a link is a citation.
 */
export const SHUTDOWN_QUOTE =
  "if an employer’s recruitment efforts or prevailing wage determination " +
  "expired between October 1 and November 2, 2025, the employer impacted by " +
  "these circumstances may submit applications electronically using the " +
  "expired recruitment efforts or prevailing wage determination during the " +
  "same 33 calendar day period during which an automatic deadline extension " +
  "has been provided.";

/**
 * Whether an ISO date falls in the window DOL named.
 *
 * String comparison, deliberately: every date in this codebase is an ISO
 * `YYYY-MM-DD` string, those sort lexicographically, and parsing here would
 * add a timezone to a question that has none. A malformed input simply fails
 * both comparisons and returns false rather than throwing into a `useMemo`.
 */
export function inShutdownWindow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return iso >= SHUTDOWN_WINDOW_START && iso <= SHUTDOWN_WINDOW_END;
}
