/**
 * The hash a visitor's address is stored as (milestone reports, community timelines, browser push).
 *
 * It was a plain SHA-256 of `scope:address`, and an IPv4 address has only about four billion values, so anyone
 * holding the table could hash them all and read the addresses back (audit, Nov 4 2026). It's an HMAC keyed by
 * IP_HASH_SECRET now. Without the secret (a deployment it hasn't been set on) it falls back to the old hash and
 * logs once, so nothing stops working; a hash made each way is a different value, which costs only the per-address
 * limits and one-per-address checks their continuity across the switch.
 */
let warned = false;

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ipHash(scope: string, ip: string, secret: string | undefined = process.env.IP_HASH_SECRET): Promise<string> {
  const data = new TextEncoder().encode(`${scope}:${ip}`);
  if (!secret) {
    if (!warned) {
      warned = true;
      console.warn("[ipHash] IP_HASH_SECRET is not set; addresses are hashed without a key");
    }
    return hex(await crypto.subtle.digest("SHA-256", data));
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, data));
}
