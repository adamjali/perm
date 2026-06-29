/**
 * Signed unsubscribe tokens (HMAC-SHA256 over the recipient email).
 *
 * Stateless: no per-user token column, no migration. The same secret
 * (`UNSUBSCRIBE_SECRET`) signs the token when the weekly digest is sent and
 * verifies it at the `/unsubscribe` HTTP route. A valid token proves the bearer
 * received an email at that address, so the one-click endpoint can act without a
 * login. Tampering with the email or signature fails verification.
 *
 * Token format: `<base64url(email)>.<base64url(hmac(email))>`.
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

/** Build an unsubscribe token for an email address. */
export async function makeUnsubscribeToken(email: string, secret: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const signature = await hmacSha256(normalized, secret);
  return `${toBase64Url(encoder.encode(normalized))}.${toBase64Url(signature)}`;
}

/**
 * Verify a token. Returns the (normalized) email if the signature is valid for
 * the given secret, otherwise null. Safe for malformed input.
 */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string
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

  const expected = toBase64Url(await hmacSha256(email, secret));
  return safeEqual(expected, token.slice(dot + 1)) ? email : null;
}
