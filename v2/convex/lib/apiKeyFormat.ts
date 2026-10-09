/**
 * The shape of a PERM Tracker API key, shared by the Convex action that makes
 * one and the site code that checks one.
 *
 *   pt_live_ + 32 random characters + a 6-character checksum
 *   pt_test_ + the same, for a sandbox key (fixed sample data, nothing counted)
 *
 * The checksum lets the site refuse a mistyped or made-up key without asking
 * Convex, and it lets secret scanners (GitHub's included) tell a real key from
 * random text with the same prefix. The first 8 random characters are the
 * key's public id: shown in Settings, written beside each call in the usage
 * counters, and never enough to use the key.
 *
 * Pure, no imports: Convex actions and Next route handlers both load it.
 */

export const API_KEY_PREFIX = "pt_live_";
export const SANDBOX_KEY_PREFIX = "pt_test_";
export const API_KEY_BODY_LENGTH = 32;
export const API_KEY_CHECK_LENGTH = 6;
export const API_KEY_ID_LENGTH = 8;
export const API_KEY_LENGTH = API_KEY_PREFIX.length + API_KEY_BODY_LENGTH + API_KEY_CHECK_LENGTH;

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const KEY_RE = /^pt_(live|test)_([0-9A-Za-z]{32})([0-9A-Za-z]{6})$/;

let crcTable: Uint32Array | null = null;

function crc32(text: string): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    crc = crcTable[(crc ^ text.charCodeAt(i)) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** CRC32 of prefix and body, as 6 base-62 characters (62^6 covers 2^32). */
export function apiKeyChecksum(body: string, prefix: string = API_KEY_PREFIX): string {
  let n = crc32(prefix + body);
  let out = "";
  for (let i = 0; i < API_KEY_CHECK_LENGTH; i++) {
    out = ALPHABET[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
}

/**
 * Random base-62 text from a source of random bytes. Bytes of 248 and over
 * are skipped so every character is equally likely (248 = 4 x 62).
 */
export function randomBase62(length: number, randomBytes: (n: number) => Uint8Array): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248) out += ALPHABET[b % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

/** A new key. `randomBytes` is crypto.getRandomValues in production. */
export function buildApiKey(randomBytes: (n: number) => Uint8Array, sandbox = false): string {
  const prefix = sandbox ? SANDBOX_KEY_PREFIX : API_KEY_PREFIX;
  const body = randomBase62(API_KEY_BODY_LENGTH, randomBytes);
  return prefix + body + apiKeyChecksum(body, prefix);
}

/** The key's public id and kind, or null when the text isn't a well-formed key. */
export function parseApiKey(text: string): { key: string; keyId: string; sandbox: boolean } | null {
  if (text.length !== API_KEY_LENGTH) return null;
  const m = KEY_RE.exec(text);
  if (!m) return null;
  const sandbox = m[1] === "test";
  const body = m[2]!;
  if (apiKeyChecksum(body, sandbox ? SANDBOX_KEY_PREFIX : API_KEY_PREFIX) !== m[3]) return null;
  return { key: text, keyId: body.slice(0, API_KEY_ID_LENGTH), sandbox };
}

/** How a key is shown once it can't be shown again: its prefix and id. */
export function displayKeyId(keyId: string, sandbox = false): string {
  return `${sandbox ? SANDBOX_KEY_PREFIX : API_KEY_PREFIX}${keyId}…`;
}

/** SHA-256 of the whole key, lowercase hex. The only form of a key that is stored. */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const API_KEY_HASH_RE = /^[0-9a-f]{64}$/;
