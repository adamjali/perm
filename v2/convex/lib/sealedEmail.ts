/**
 * An address sealed into a link, for the review form's prefill (convex/siteReviews.ts). Encrypted (AES-GCM, key
 * derived from the deployment's secret), not merely signed: a signed token carries the address in plain base64,
 * and this one rides in a page's address, where it could reach a log or an analytics tool. It also expires, and
 * the GCM tag refuses any token that was altered. Opening one gives back only the address it was made for.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Separates this key from every other use of the same secret. */
const KEY_LABEL = "permtracker:review-link:v1";

/** How long a review link keeps its prefill. */
export const REVIEW_LINK_TTL_MS = 120 * 24 * 60 * 60 * 1000;

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function keyFor(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(`${KEY_LABEL}\0${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** A sealed, expiring token for an address. */
export async function sealEmail(email: string, secret: string, expiresAt: number): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = encoder.encode(JSON.stringify({ e: email.trim().toLowerCase(), x: Math.floor(expiresAt) }));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(secret), body));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return toB64Url(out);
}

/** The address a token was sealed for, or null when it's malformed, altered, expired or from another secret. */
export async function openEmail(token: unknown, secret: string, now: number): Promise<string | null> {
  if (typeof token !== "string" || token.length < 40 || token.length > 600) return null;
  const bytes = fromB64Url(token);
  if (!bytes || bytes.length < 12 + 16 + 2) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await keyFor(secret), bytes.slice(12));
    const parsed = JSON.parse(decoder.decode(plain)) as { e?: unknown; x?: unknown };
    if (typeof parsed.e !== "string" || typeof parsed.x !== "number" || !(now < parsed.x)) return null;
    return parsed.e;
  } catch {
    return null;
  }
}
