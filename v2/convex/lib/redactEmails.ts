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

const LOCAL_CHAR = /[A-Za-z0-9._%+-]/;
const DOMAIN_CHAR = /[A-Za-z0-9.-]/;
const LABEL = /^[A-Za-z0-9-]+$/;
const TOP_LEVEL = /^[A-Za-z]{2,}$/;

/**
 * Where the addresses in `text` are, as [start, end) spans: a local part, @, two or more dot-separated labels, a
 * letter-only top-level label of two or more. Found by walking out from each @ rather than by one regular
 * expression: a pattern with nested repeats backtracks on a long dotted string, and an error's text can carry
 * anyone's input. Each character is looked at a bounded number of times.
 */
function addressSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let at = text.indexOf("@");
  while (at !== -1) {
    let start = at;
    while (start > 0 && LOCAL_CHAR.test(text[start - 1]!)) start -= 1;
    let end = at + 1;
    while (end < text.length && DOMAIN_CHAR.test(text[end]!)) end += 1;
    // A sentence's full stop or a trailing hyphen isn't part of the domain.
    while (end > at + 1 && (text[end - 1] === "." || text[end - 1] === "-")) end -= 1;
    const labels = text.slice(at + 1, end).split(".");
    if (
      start < at &&
      labels.length >= 2 &&
      labels.every((l) => LABEL.test(l)) &&
      TOP_LEVEL.test(labels[labels.length - 1]!)
    ) {
      spans.push([start, end]);
    }
    at = text.indexOf("@", Math.max(end, at + 1));
  }
  return spans;
}

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
  const spans = addressSpans(text);
  if (spans.length === 0) return text;
  const labels = new Map<string, string>();
  let out = "";
  let from = 0;
  for (const [start, end] of spans) {
    const address = text.slice(start, end);
    let label = labels.get(address);
    if (!label) {
      label = await emailLabel(address);
      labels.set(address, label);
    }
    out += text.slice(from, start) + label;
    from = end;
  }
  return out + text.slice(from);
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
