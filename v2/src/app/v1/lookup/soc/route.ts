import { cleanSocQuery, lookupSoc } from "@/lib/api/socLookup";
import { keylessGet, keylessOptions } from "@/lib/api/keyless";

export const dynamic = "force-dynamic";

/**
 * GET /v1/lookup/soc?q=data%20scientist: the SOC codes employers filed a job title under in DOL's
 * files, with their shares, or a code's title (a 2010 code with the codes it became). No key, under
 * the same shared limits as the employer lookup (src/lib/api/keyless.ts).
 */
export const GET = keylessGet("soc", (url) => cleanSocQuery(url.searchParams.get("q")), (q) => lookupSoc(q));

export const OPTIONS = keylessOptions;
