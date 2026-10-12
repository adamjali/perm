/**
 * The mail Worker's decisions, kept pure so tests can hold them to the app's.
 *
 * shouldForward mirrors convex/lib/supportEmailForward.ts (shouldForwardInbound),
 * which decided the same thing while Resend received the mail; a test runs both
 * over the same cases so they can't drift.
 */

/** The addresses this site sends from. */
export const OWN_SENDERS = ["notifications@permtracker.app"];
/** Where the site sends to itself on purpose: the contact form writes to support@. */
export const SELF_ADDRESSED_ON_PURPOSE = ["support@permtracker.app"];

const bare = (from) => ((from || "").match(/<([^>]+)>/)?.[1] ?? from ?? "").trim().toLowerCase();

/** Whether a message to `to` from `from` goes on to the owner's inbox. */
export function shouldForward(to, ownerEmail, from = "") {
  const t = (to || "").toLowerCase();
  if (t.startsWith("dmarc@")) return false; // DMARC machine report
  if (t === (ownerEmail || "").toLowerCase()) return false; // loop guard
  if (OWN_SENDERS.includes(bare(from)) && !SELF_ADDRESSED_ON_PURPOSE.includes(t)) return false; // our own mail to an account inbox
  return true;
}

/** A shared key compared as SHA-256 digests. An unset key matches nothing. */
export async function keyMatches(given, want) {
  if (!want || !given) return false;
  const digest = async (x) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)));
  const [a, b] = await Promise.all([digest(given), digest(want)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Most an owner message may carry. */
export const OWNER_LIMITS = { subject: 300, text: 200_000, html: 500_000 };

/** An owner message from a request body, or why it isn't one. */
export function ownerMessage(body) {
  if (!body || typeof body !== "object") return { error: "Send JSON: { subject, text, html? }." };
  const { subject, text, html } = body;
  if (typeof subject !== "string" || subject.trim().length === 0) return { error: "subject is required." };
  if (typeof text !== "string" || text.length === 0) return { error: "text is required." };
  if (html !== undefined && typeof html !== "string") return { error: "html must be text." };
  if (subject.length > OWNER_LIMITS.subject || text.length > OWNER_LIMITS.text || (html?.length ?? 0) > OWNER_LIMITS.html) {
    return { error: "Too long." };
  }
  return { subject: subject.replace(/[\r\n]+/g, " ").trim(), text, ...(html ? { html } : {}) };
}

/** Messages larger than this are forwarded and stored with headers only (CPU on the free plan). */
export const PARSE_MAX_BYTES = 1_000_000;

/** A key as it's provisioned: 64 hex characters (openssl rand -hex 32). */
export const KEY_PATTERN = /^[0-9a-f]{64}$/;

/** The first 8 hex of a key's SHA-256: enough to confirm which key is set, nothing more. */
export async function keyTag(key) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  return Array.from(d.slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}
