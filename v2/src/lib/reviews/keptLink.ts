/**
 * The sealed link from our email, kept in this browser for a day (Nov 2 2026). The review form takes the link out
 * of the address bar as soon as it opens, so it can't be copied, and a reload, the back button or a new tab then
 * came back without it: the review arrived with no address and the same person counted twice. The link is sealed
 * (AES-GCM, `convex/lib/sealedEmail.ts`), so what's kept can't be read here; it's cleared once a review is sent.
 * Every read and write is guarded: a private window or blocked storage just means no link is kept.
 */

const KEY = "pt.reviewLink";

/** How long the browser keeps the link: long enough to come back to the form, short of the link's own 120 days. */
export const LINK_KEEP_MS = 24 * 60 * 60 * 1000;

export function keepLink(token: string, now = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ t: token, until: now + LINK_KEEP_MS }));
  } catch {
    // Storage refused: the form still works, it just won't remember the link.
  }
}

/** The kept link, or null when there's none, it's older than a day, or storage can't be read. */
export function keptLink(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const kept = JSON.parse(raw) as { t?: unknown; until?: unknown };
    if (typeof kept.t === "string" && typeof kept.until === "number" && now < kept.until) return kept.t;
    window.localStorage.removeItem(KEY);
  } catch {
    // Unreadable or refused: treat it as no link.
  }
  return null;
}

export function forgetLink(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
