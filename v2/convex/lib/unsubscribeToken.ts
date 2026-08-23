/**
 * Signed action tokens (HMAC-SHA256 over a purpose-scoped recipient email).
 *
 * Stateless: no per-user token column, no migration. The same secret
 * (`UNSUBSCRIBE_SECRET`) signs the token when mail is sent and verifies it at
 * the receiving HTTP route. A valid token proves the bearer received an email
 * at that address, so a one-click endpoint can act without a login. Tampering
 * with the email or signature fails verification.
 *
 * ## Purpose scoping
 *
 * The signed message is `<purpose>:<email>`, or bare `<email>` when no purpose
 * is given. Without a purpose, every token for one address is the same string,
 * so a link that means "unsubscribe me" is byte-identical to one that means
 * "confirm me" and differs only in which path it is pasted into. That let an
 * unsubscribe link be replayed against a confirm route to undo an opt-out.
 * Verification is scoped too: a token minted for one purpose does not verify
 * for another, so the routes can no longer be crossed.
 *
 * The purpose is OPTIONAL and defaults to unscoped ON PURPOSE. Weekly-digest
 * unsubscribe links are already sitting in real inboxes signed the old way
 * (`convex/notificationActions.ts`), and they have no expiry, so making scoping
 * mandatory would silently break every one of them. New callers must pass a
 * purpose; the bare form exists only to keep those live links working.
 *
 * These tokens do not expire and are replayable by anyone holding the email.
 * That is acceptable for "stop sending me mail", which is idempotent and
 * self-harming at worst. It is NOT acceptable for anything that grants or
 * restores a subscription, so callers on that side must re-check state rather
 * than treat a valid token as a fresh act of consent.
 *
 * Token format: `<base64url(email)>.<base64url(hmac(purpose:email))>`.
 *
 * @module
 */

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSha256(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

/** Constant-time-ish string comparison (length-independent on content). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * What a token is allowed to do. See the purpose-scoping note above.
 *
 * `undefined` means the legacy unscoped form, which exists only for weekly
 * digest links already in the wild. Do not use it for new callers.
 */
export type TokenPurpose = "queue-confirm" | "queue-unsubscribe";

/** The exact string that gets signed. Kept in one place so both sides agree. */
function signedMessage(normalizedEmail: string, purpose?: TokenPurpose): string {
  return purpose ? `${purpose}:${normalizedEmail}` : normalizedEmail;
}

/** Build an action token for an email address, scoped to one purpose. */
export async function makeUnsubscribeToken(
  email: string,
  secret: string,
  purpose?: TokenPurpose
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const signature = await hmacSha256(signedMessage(normalized, purpose), secret);
  return `${toBase64Url(encoder.encode(normalized))}.${toBase64Url(signature)}`;
}

/**
 * Verify a token against one purpose. Returns the (normalized) email if the
 * signature is valid for that secret AND that purpose, otherwise null. Safe for
 * malformed input.
 *
 * Omitting `purpose` verifies only the legacy unscoped form. It does NOT accept
 * any purpose-scoped token, which is what stops a scoped token being replayed
 * through an older route.
 */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
  purpose?: TokenPurpose
): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  let email: string;
  try {
    email = new TextDecoder().decode(fromBase64Url(token.slice(0, dot)));
  } catch {
    return null;
  }
  if (!email) return null;

  const expected = toBase64Url(await hmacSha256(signedMessage(email, purpose), secret));
  return safeEqual(expected, token.slice(dot + 1)) ? email : null;
}
