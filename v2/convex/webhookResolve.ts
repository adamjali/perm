"use node";
/**
 * Where a webhook's host name points, asked in Node because Convex's default
 * runtime can't resolve names. A name whose addresses include a private,
 * loopback, link-local or other reserved one (convex/lib/webhookSign.ts,
 * isPrivateAddress) is never sent to: a public name can point anywhere, and
 * the static checks on the address only read the name.
 */
import { lookup } from "node:dns/promises";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { isPrivateAddress } from "./lib/webhookSign";

export const publicHost = internalAction({
  args: { host: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), reason: v.string() })),
  handler: async (_ctx, args): Promise<{ ok: true } | { ok: false; reason: string }> => {
    let addresses: { address: string }[];
    try {
      addresses = await lookup(args.host, { all: true, verbatim: true });
    } catch {
      return { ok: false, reason: "its host name didn't resolve" };
    }
    if (addresses.length === 0) return { ok: false, reason: "its host name didn't resolve" };
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return { ok: false, reason: "its host name resolves to a private address, which webhooks are never sent to" };
    }
    return { ok: true };
  },
});
