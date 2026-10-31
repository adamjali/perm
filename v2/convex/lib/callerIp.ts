/**
 * The address a request to one of our HTTP routes came from, for per-address limits.
 *
 * Convex sets `x-forwarded-for` itself to the address that connected (measured Oct 22 2026: a faked header is
 * replaced). The site's forms post to its own address since Oct 31 2026 (`/c/<route>`), because some work networks
 * block the `.convex.site` host and six people's forms failed there; nginx relays them here and passes the
 * visitor's address in `x-pt-client-ip`. That header is believed only when the request came from the relay itself,
 * one of the addresses in the `RELAY_FROM_IPS` setting (the server's own, kept out of this public repository).
 * From anywhere else it is ignored, so nobody can name an address to spend someone else's limit.
 */

const IP_SHAPE = /^[0-9a-fA-F.:]{3,45}$/;

/** The relay's addresses, from the deployment's RELAY_FROM_IPS setting (comma-separated). */
export function relayAddresses(): Set<string> {
  return new Set(
    (process.env.RELAY_FROM_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function callerIp(req: Request): string {
  const connected = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  const relayed = (req.headers.get("x-pt-client-ip") ?? "").trim();
  if (connected && relayed && IP_SHAPE.test(relayed)) {
    if (relayAddresses().has(connected)) return relayed;
    // The relay header from an address not on the list: a misread setting (or the server's address changed), and
    // every visitor would share one limit, or someone trying to name an address. Either way it goes in the log.
    console.warn(`callerIp: x-pt-client-ip from ${connected}, which isn't in RELAY_FROM_IPS; using ${connected}`);
  }
  return connected || "unknown";
}
