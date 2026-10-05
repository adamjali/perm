/**
 * Signed links that stop working after a set time, for actions that GRANT
 * something: confirming a firm-page claim, and editing a claimed firm's page.
 *
 * The alert links (convex/lib/unsubscribeToken.ts) never expire, which is fine
 * for "stop sending me mail" and wrong for "publish words on a public page":
 * a forwarded email would be a standing key to the firm's profile. These carry
 * their expiry inside the signed message, so the time can't be edited without
 * breaking the signature, and nothing is stored.
 *
 * Format: `<base64url(email)>.<expiresAtMs>.<base64url(hmac("x:<purpose>:<expiresAtMs>:<email>"))>`.
 * Three parts where the alert tokens have two, and a different message prefix,
 * so neither kind verifies as the other. Same secret (`UNSUBSCRIBE_SECRET`).
 *
 * HMAC is deterministic, so a token can be minted inside a mutation (Convex
 * denies cryptographic RANDOMNESS there, not hashing).
 */

export type ExpiringPurpose = "firm-confirm" | "firm-edit";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  try {
    let s = value.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function message(email: string, purpose: ExpiringPurpose, expiresAt: number): string {
  return `x:${purpose}:${expiresAt}:${email}`;
}

/** A link token for `email`, good for `purpose` until `expiresAt` (epoch ms). */
export async function makeExpiringToken(
  email: string,
  secret: string,
  purpose: ExpiringPurpose,
  expiresAt: number,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const at = Math.floor(expiresAt);
  return `${toBase64Url(encoder.encode(normalized))}.${at}.${await sign(message(normalized, purpose, at), secret)}`;
}

/**
 * The address a token was minted for, when the signature holds for this
 * purpose and `now` is before its expiry; otherwise null. Safe for junk input.
 */
export async function verifyExpiringToken(
  token: string,
  secret: string,
  purpose: ExpiringPurpose,
  now: number,
): Promise<string | null> {
  if (typeof token !== "string" || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailPart, atPart, sigPart] = parts as [string, string, string];
  if (!/^\d{10,16}$/.test(atPart)) return null;
  const at = Number(atPart);
  if (!(now < at)) return null;
  const email = fromBase64Url(emailPart);
  if (!email || email.length > 320 || !email.includes("@")) return null;
  const expected = await sign(message(email, purpose, at), secret);
  return safeEqual(expected, sigPart) ? email : null;
}
