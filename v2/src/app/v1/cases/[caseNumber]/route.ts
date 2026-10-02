import { apiGet } from "@/lib/api/route";
import { readCase } from "@/lib/api/reads";

export const dynamic = "force-dynamic";

/** One case by number: PERM (G-100-...), prevailing wage (P-100-...), H-1B LCA (I-200-...) or H-2A/H-2B. */
export const GET = apiGet<{ caseNumber: string }>(async (_ctx, { caseNumber }) => readCase(caseNumber));
