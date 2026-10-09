/**
 * Webhooks the Standard Webhooks way (standardwebhooks.com): what an event
 * is called, how a delivery is signed, which addresses we'll deliver to, and
 * how long a failing delivery is retried.
 *
 * SIGNING. Each delivery carries three headers:
 *
 *   webhook-id         msg_<event id>, the same on every retry of one event
 *   webhook-timestamp  seconds since 1970, when this attempt was sent
 *   webhook-signature  v1,<base64 of HMAC-SHA256 over "id.timestamp.body">
 *
 * The HMAC key is the endpoint's secret without its `whsec_` prefix,
 * base64-decoded, so any Standard Webhooks library (svix's included) checks
 * it. The secret is shown once when the endpoint is made and stored
 * encrypted (convex/lib/crypto.ts), because signing needs it back.
 *
 * Pure, no Convex imports: the delivery action, the SDKs and the tests use it.
 */

export const WEBHOOK_SECRET_PREFIX = "whsec_";

/** Every event type an endpoint can subscribe to. */
export const WEBHOOK_EVENTS = [
  "case.status_changed",
  "employer.moved",
  "bulletin.published",
  "queue.moved",
  "processing_times.updated",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** The ones that fire for everyone subscribed, not for one account's watches. */
export const FEED_EVENTS: readonly WebhookEvent[] = ["bulletin.published", "queue.moved", "processing_times.updated"];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "case.status_changed": "A watched case changes status",
  "employer.moved": "DOL moves a watched employer's cases as a group",
  "bulletin.published": "A new visa bulletin is published",
  "queue.moved": "DOL's PERM queue reaches a new month",
  "processing_times.updated": "DOL republishes its processing times",
};

export function isWebhookEvent(s: string): s is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(s);
}

/** Known events only, each once, in the canonical order. */
export function normaliseEvents(asked: readonly string[]): WebhookEvent[] {
  const want = new Set(asked);
  return WEBHOOK_EVENTS.filter((e) => want.has(e));
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A new secret: whsec_ plus 32 random bytes in base64. `randomBytes` is crypto.getRandomValues in production. */
export function buildWebhookSecret(randomBytes: (n: number) => Uint8Array): string {
  return WEBHOOK_SECRET_PREFIX + toBase64(randomBytes(32));
}

/** The secret's last four characters, to tell endpoints' secrets apart in Settings. */
export function secretHint(secret: string): string {
  return secret.slice(-4);
}

/** "v1,<base64 HMAC-SHA256 of id.timestamp.body>", keyed by the secret's decoded bytes. */
export async function signWebhook(secret: string, id: string, timestamp: number, body: string): Promise<string> {
  if (!secret.startsWith(WEBHOOK_SECRET_PREFIX)) throw new Error("not a webhook secret");
  const keyBytes = fromBase64(secret.slice(WEBHOOK_SECRET_PREFIX.length));
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${toBase64(new Uint8Array(mac))}`;
}

export async function webhookHeaders(secret: string, id: string, timestamp: number, body: string): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "PERMTrackerWebhooks/1.0 (+https://permtracker.app/developers#webhooks)",
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": await signWebhook(secret, id, timestamp, body),
  };
}

/* ------------------------------------------------------------------ */
/* Where we'll deliver                                                 */
/* ------------------------------------------------------------------ */

const URL_MAX = 2048;
const PRIVATE_HOST = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * An address we'll POST to: https, a public host name (no IP address, no
 * credentials, no .local or .internal names), the standard port, at most
 * 2,048 characters. Length first, before any pattern walks the string.
 */
export function checkWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const text = raw.trim();
  if (text.length === 0 || text.length > URL_MAX) return { ok: false, message: `Give an address of at most ${URL_MAX} characters.` };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, message: "That isn't a web address. It should look like https://example.com/hooks/perm." };
  }
  if (u.protocol !== "https:") return { ok: false, message: "Webhooks are sent over https only." };
  if (u.username || u.password) return { ok: false, message: "Leave the user name and password out of the address; check the signature instead." };
  if (u.port && u.port !== "443") return { ok: false, message: "Webhooks are sent to the standard https port only." };
  const host = u.hostname.toLowerCase();
  if (IPV4.test(host) || host.startsWith("[") || host.includes(":")) {
    return { ok: false, message: "Use a host name, not an IP address." };
  }
  if (!host.includes(".") || PRIVATE_HOST.test(host)) return { ok: false, message: "Use a public host name." };
  if (host === "permtracker.app" || host.endsWith(".permtracker.app") || host.endsWith(".convex.cloud") || host.endsWith(".convex.site")) {
    return { ok: false, message: "Webhooks can't be sent to PERM Tracker itself." };
  }
  u.hash = "";
  return { ok: true, url: u.toString() };
}

/* ------------------------------------------------------------------ */
/* Retries                                                             */
/* ------------------------------------------------------------------ */

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Waits after each failed attempt: 1 and 5 minutes, half an hour, then 2, 5 and 10 hours, capped at 24 hours. */
export const RETRY_DELAYS_MS = [MIN, 5 * MIN, 30 * MIN, 2 * HOUR, 5 * HOUR, 10 * HOUR, 10 * HOUR] as const;
/** How long one event is retried for before its endpoint pauses. */
export const RETRY_WINDOW_MS = 24 * HOUR;

/**
 * When to try again after attempt number `attempts` (1 for the first) failed,
 * or null when the 24 hours are up. The last attempt lands at the 24-hour
 * mark rather than past it.
 */
export function nextAttemptAt(firstAttemptAt: number, attempts: number, now: number): number | null {
  const end = firstAttemptAt + RETRY_WINDOW_MS;
  if (now >= end) return null;
  const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
  return Math.min(now + delay, end);
}
