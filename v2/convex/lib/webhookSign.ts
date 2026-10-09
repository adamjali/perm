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
  // A name may end in one dot (the fully qualified form); it names the same
  // host, so it's dropped before any rule below reads the name.
  let host = u.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.endsWith(".") || host.includes("..")) return { ok: false, message: "Use a public host name." };
  if (IPV4.test(host) || host.startsWith("[") || host.includes(":")) {
    return { ok: false, message: "Use a host name, not an IP address." };
  }
  if (!host.includes(".") || PRIVATE_HOST.test(host)) return { ok: false, message: "Use a public host name." };
  if (host === "permtracker.app" || host.endsWith(".permtracker.app") || host.endsWith(".convex.cloud") || host.endsWith(".convex.site")) {
    return { ok: false, message: "Webhooks can't be sent to PERM Tracker itself." };
  }
  u.hostname = host;
  u.hash = "";
  return { ok: true, url: u.toString() };
}

/* ------------------------------------------------------------------ */
/* Where a name resolves                                                */
/* ------------------------------------------------------------------ */

function ipv4Bytes(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const bytes = parts.map(Number);
  return bytes.every((b) => b <= 255) ? bytes : null;
}

function privateIpv4([a, b, c]: number[]): boolean {
  if (a === undefined || b === undefined || c === undefined) return true;
  return (
    a === 0 || // "this network"
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a === 127 ||
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** An IPv6 address as eight 16-bit groups, or null when it isn't one. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  // An IPv4 tail ("::ffff:10.0.0.1") becomes two groups.
  const lastColon = text.lastIndexOf(":");
  if (lastColon >= 0 && text.slice(lastColon + 1).includes(".")) {
    const v4 = ipv4Bytes(text.slice(lastColon + 1));
    if (!v4) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === "" ? [] : part.split(":"));
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

/**
 * True when an address a webhook's host resolves to is one we never deliver
 * to: private, loopback, link-local (where cloud metadata lives), carrier
 * NAT, multicast, reserved or documentation ranges, in IPv4 or IPv6
 * (IPv4-mapped and NAT64 forms judged by the IPv4 they carry). Anything that
 * doesn't parse as an address counts as private.
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Bytes(ip);
  if (v4) return privateIpv4(v4);
  const g = ipv6Groups(ip);
  if (!g) return true;
  const [g0 = 0, g1 = 0, , , , g5 = 0, g6 = 0, g7 = 0] = g;
  const embedded = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
  if (g.slice(0, 7).every((x) => x === 0)) return true; // :: and ::1 (and the old IPv4-compatible form)
  if (g.slice(0, 5).every((x) => x === 0) && g5 === 0xffff) return privateIpv4(embedded); // ::ffff:a.b.c.d
  if (g0 === 0x64 && g1 === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return privateIpv4(embedded); // NAT64
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  return false;
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
