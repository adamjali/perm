import { apiGet } from "@/lib/api/route";
import { readQueue } from "@/lib/api/reads";

export const dynamic = "force-dynamic";

/** DOL's processing times and the pending PERM cases by filing month. */
export const GET = apiGet(async () => readQueue());
