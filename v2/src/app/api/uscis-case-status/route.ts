import { makeUscisCaseStatusHandler } from "@/lib/uscis/routeHandler";
import { uscisEnabled } from "@/lib/uscis/torchClient";
import { lookupUscisCase } from "@/lib/turso/uscisCaseStatus";

/**
 * `GET /api/uscis-case-status?receipt=EAC2190123456`
 *
 * Only handler names may be exported from a route file; everything else is
 * in `src/lib/uscis/routeHandler.ts`. Dynamic by construction: it reads the
 * query string and its answer is `no-store`.
 */
export const dynamic = "force-dynamic";

export const GET = makeUscisCaseStatusHandler({
  lookup: (receipt, now) => lookupUscisCase(receipt, now),
  enabled: uscisEnabled,
});
