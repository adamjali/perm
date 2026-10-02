import { apiGet } from "@/lib/api/route";
import { readEstimate } from "@/lib/api/reads";

export const dynamic = "force-dynamic";

/** A PERM decision estimate for ?case=G-100-... or ?filed=YYYY-MM-DD. */
export const GET = apiGet(async ({ url }) =>
  readEstimate({ caseNumber: url.searchParams.get("case"), filed: url.searchParams.get("filed") }),
);
