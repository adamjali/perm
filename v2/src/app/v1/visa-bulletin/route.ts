import { apiGet } from "@/lib/api/route";
import { readBulletin } from "@/lib/api/reads";

export const dynamic = "force-dynamic";

/** The newest visa bulletin, or ?month=YYYY-MM back to June 2005. */
export const GET = apiGet(async ({ url }) => readBulletin(url.searchParams.get("month")));
