/**
 * The token that lets the browser that posted a low review add its private note (Nov 4 2026).
 *
 * The thanks screen after 3 stars or fewer asks what would have made it better (convex/siteReviews.ts addNote).
 * That note used to be authorised by the review's id alone, which is no secret once it has been in a reply, a log
 * or a support thread. Now /review/submit makes a random token in the HTTP action (randomness isn't allowed in a
 * mutation), hands it to that browser alone, and stores only its key: the SHA-256 of the token, hex. /review/note
 * must bring the token back; the mutation compares keys. A review stored before Nov 4 2026 has no key and takes no
 * note, which costs nothing: a note is only allowed within two hours of the review.
 */

/** A new token: 32 random bytes, base64url (43 characters). Only in an action: queries and mutations deny randomness. */
export function newNoteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** What's stored for a token: its SHA-256, hex. */
export async function noteKeyOf(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The keys one review keeps: a double send (a retry after a dropped reply) gets a token of its own. */
export const NOTE_KEYS_KEPT = 3;
