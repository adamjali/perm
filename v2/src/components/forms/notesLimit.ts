/**
 * The most notes one case holds, and what the add controls say about it.
 *
 * Both note views read this, so the limit is said in words wherever a note
 * can be added, never left to a silently greyed button.
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
