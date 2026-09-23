import { NextResponse } from "next/server";

import { RECEIPT_SHAPE_MESSAGE, normaliseReceipt } from "./receipt";
import type { UscisLookupResult } from "@/lib/turso/uscisCaseStatus";

/**
 * The handler behind `GET /api/uscis-case-status?receipt=`, built as a factory
 * so the route file exports only handler names (Next's route type generation
 * rejects anything else) and so the tests can inject the lookup.
 *
 * The public-endpoint checklist, in order, cheapest first:
 *
 *   1. length cap BEFORE the regex (a 100k string costs a comparison);
 *   2. shape (400, with the same sentence the form shows);
 *   3. is USCIS access configured at all (503, "pending"), so nothing below
 *      runs on a deployment without keys;
 *   4. per-IP limit, in memory (429). This is the cost-raiser only: the WAF's
 *      rule 3 (60/min per IP on /api/*) is the real per-IP layer, and neither
 *      stops a proxy pool;
 *   5. the lookup, whose client charges the GLOBAL daily budget before any
 *      call. That budget is the guarantee.
 *
 * A budget refusal and a per-IP refusal are both 429, and both say WHICH in
 * `reason`, or every typo and every flood read the same in monitoring. A
 * shape refusal is 400, never 429.
 *
 * GET reads only. Nothing here mutates on the reader's behalf; the storage
 * write inside the lookup records what USCIS said, which is the cache, not an
 * action taken for the caller.
 */

export const MAX_INPUT_LENGTH = 20;
export const PER_IP_PER_MINUTE = 20;

export interface HandlerDeps {
  lookup: (receipt: string, now: Date) => Promise<UscisLookupResult>;
  enabled: () => boolean;
  now?: () => Date;
}

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

/** Test hook. */
export function resetIpBuckets(): void {
  buckets.clear();
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** True when this address may proceed. Charged before the lookup. */
function underIpLimit(ip: string, now: number): boolean {
  // Prune occasionally so a long-lived instance cannot grow the map forever.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now - b.windowStart > WINDOW_MS) buckets.delete(k);
  }
  const b = buckets.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  b.count += 1;
  return b.count <= PER_IP_PER_MINUTE;
}

const NO_STORE = { "cache-control": "no-store" };

function refuse(status: number, error: string, reason: string) {
  return NextResponse.json({ error, reason }, { status, headers: NO_STORE });
}

export function makeUscisCaseStatusHandler(deps: HandlerDeps) {
  return async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const raw = url.searchParams.get("receipt") ?? "";

    // 1. Length cap before any regex.
    if (raw.length > MAX_INPUT_LENGTH) return refuse(400, "Receipt number too long.", "length");

    // 2. Shape.
    const receipt = normaliseReceipt(raw);
    if (!receipt) return refuse(400, RECEIPT_SHAPE_MESSAGE, "shape");

    // 3. Configured at all.
    if (!deps.enabled()) {
      return refuse(503, "USCIS access is pending; this page will check live once USCIS issues API keys.", "disabled");
    }

    // 4. Per-IP.
    const now = deps.now ? deps.now() : new Date();
    if (!underIpLimit(clientIp(req), now.getTime())) {
      return refuse(429, "Too many lookups from this address. Try again in a minute.", "ip");
    }

    // 5. The lookup, with the global budget inside it.
    const r = await deps.lookup(receipt, now);
    switch (r.kind) {
      case "ok":
        return NextResponse.json(
          { receipt, status: r.status, source: r.source, stale: false },
          { headers: NO_STORE },
        );
      case "stale":
        return NextResponse.json(
          { receipt, status: r.status, source: "stored", stale: true, failure: r.failure },
          { headers: NO_STORE },
        );
      case "not_found":
        return refuse(
          404,
          "USCIS has no case under that receipt number. USCIS also answers this way for cases it keeps confidential.",
          "not_found",
        );
      case "invalid":
        return refuse(400, RECEIPT_SHAPE_MESSAGE, "shape");
      case "budget":
        return refuse(429, "Today's USCIS lookup budget is spent. Check USCIS's own page for now.", "budget");
      case "rate_limited":
        return refuse(429, "USCIS lookups are rate-limited right now. Try again in a moment.", r.where === "uscis" ? "uscis_rate" : "local_rate");
      case "unauthorized":
        return refuse(503, "USCIS refused our credentials. The site's operator has been told.", "unauthorized");
      case "disabled":
        return refuse(503, "USCIS access is pending; this page will check live once USCIS issues API keys.", "disabled");
      case "unavailable":
        return refuse(503, "USCIS did not answer. Their own status page may still.", "unavailable");
    }
  };
}
