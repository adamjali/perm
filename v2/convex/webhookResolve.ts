"use node";
/**
 * Where webhook host names point, asked in Node because Convex's default
 * runtime can't resolve names. A name whose addresses include a private,
 * loopback, link-local or other reserved one (convex/lib/webhookSign.ts,
 * isPrivateAddress) is never sent to: a public name can point anywhere, and
 * the static checks on the address only read the name.
 *
 * Every distinct host in a delivery batch is asked in one call, each on its
 * own: one name failing to resolve, however it fails, is a verdict about that
 * name and never an error for the batch.
 */
import { lookup } from "node:dns/promises";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { isPrivateAddress } from "./lib/webhookSign";

export type HostVerdict = { host: string; ok: true } | { host: string; ok: false; reason: string };

async function verdictFor(host: string): Promise<HostVerdict> {
  try {
    const addresses: { address: string }[] = await lookup(host, { all: true, verbatim: true });
    if (!Array.isArray(addresses) || addresses.length === 0) return { host, ok: false, reason: "its host name didn't resolve" };
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return { host, ok: false, reason: "its host name resolves to a private address, which webhooks are never sent to" };
    }
    return { host, ok: true };
  } catch {
    return { host, ok: false, reason: "its host name didn't resolve" };
  }
}

export const publicHosts = internalAction({
  args: { hosts: v.array(v.string()) },
  returns: v.array(
    v.union(
      v.object({ host: v.string(), ok: v.literal(true) }),
      v.object({ host: v.string(), ok: v.literal(false), reason: v.string() }),
    ),
  ),
  handler: async (_ctx, args): Promise<HostVerdict[]> => {
    const settled = await Promise.allSettled(args.hosts.slice(0, 100).map(verdictFor));
    return settled.map((r, i) =>
      r.status === "fulfilled" ? r.value : { host: args.hosts[i]!, ok: false as const, reason: "its host name couldn't be checked" },
    );
  },
});
