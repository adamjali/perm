/**
 * The most notes one case holds, and what the add controls say about it.
 *
 * The add button used to grey out at 200 with no word, and one of the two note
 * views said "N notes remaining" in 9px type only while its options row was
 * open (silent-limit audit, Sep 29 2026). Both note views read this now.
 */

export const NOTES_PER_CASE_MAX = 200;

/** How close to the cap the count starts showing. */
const WARN_WITHIN = 10;

export function notesLimitMessage(count: number): string | null {
  if (count >= NOTES_PER_CASE_MAX) {
    return `${NOTES_PER_CASE_MAX} notes is the most a case can hold. Delete one to add another.`;
  }
  const left = NOTES_PER_CASE_MAX - count;
  if (left <= WARN_WITHIN) {
    return `${left} ${left === 1 ? "note" : "notes"} left of ${NOTES_PER_CASE_MAX} a case can hold.`;
  }
  return null;
}
