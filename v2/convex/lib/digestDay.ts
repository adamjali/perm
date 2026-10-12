/**
 * Which weekday an account's weekly case summary goes out.
 *
 * Every summary used to go on Monday at once, beside the day's deadline
 * reminders and alerts, on a 100-email-a-day allowance (Oct 12 2026: 65 sent
 * that Monday, 29 of them summaries). Each account now has one fixed day,
 * Monday, Tuesday or Wednesday, worked out from its id, so a summary still
 * comes once a week on the same day and the three days share the load.
 */
export const DIGEST_DAYS = ["monday", "tuesday", "wednesday"] as const;
export type DigestDay = (typeof DIGEST_DAYS)[number];

/** A stable 32-bit FNV-1a hash of the id: the same account always lands on the same day. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The slot (0 Monday, 1 Tuesday, 2 Wednesday) an account's summary goes in. */
export function digestSlot(userId: string): number {
  return fnv1a(userId) % DIGEST_DAYS.length;
}

/** "Tuesday": the day an account's summary goes out, for settings and help text. */
export function digestDayName(userId: string): string {
  const day = DIGEST_DAYS[digestSlot(userId)]!;
  return day.charAt(0).toUpperCase() + day.slice(1);
}
