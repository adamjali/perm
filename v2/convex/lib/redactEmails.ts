/**
 * Email addresses out of what we send Sentry (Nov 4 2026).
 *
 * Sentry is a third party, and backend errors carried addresses there: recordError's `extra` (eight call sites
 * pass `to: <address>`), error messages from Resend and Convex Auth ("Account <address> already exists"), and the
 * stacks that repeat those messages. `reportError` in convex/lib/sentry.ts runs every string it sends through
 * `redactEmails`, which swaps each address for `email#<6 hex>`: the first six hex digits of the SHA-256 of the
 * lowercased address. The same address always gets the same label, so a recurring failure for one recipient still
 * groups and can be told apart from another's, and the label can't be read back into the address.
 *
 * The admin's own error log (systemErrors) and its email keep the address: those stay with the owner.
 */

/** A plausible address: local part, @, one or more labels, a letter-only top-level domain of two or more. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** The label an address is replaced by. */
export async function emailLabel(address: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address.trim().toLowerCase())),
  );
  const hex = Array.from(bytes.slice(0, 3), (b) => b.toString(16).padStart(2, "0")).join("");
  return `email#${hex}`;
}

/** `text` with every address in it replaced by its label. */
export async function redactEmails(text: string): Promise<string> {
  const found = new Set(text.match(EMAIL_RE) ?? []);
  if (found.size === 0) return text;
  const labels = new Map<string, string>();
  for (const address of found) labels.set(address, await emailLabel(address));
  return text.replace(EMAIL_RE, (address) => labels.get(address) ?? address);
}

/** A value with every string inside it redacted: strings, arrays and plain objects, to a few levels. */
export async function redactDeep(value: unknown, depth = 0): Promise<unknown> {
  if (typeof value === "string") return redactEmails(value);
  if (depth >= 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Promise.all(value.map((v) => redactDeep(v, depth + 1)));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = await redactDeep(v, depth + 1);
  return out;
}
