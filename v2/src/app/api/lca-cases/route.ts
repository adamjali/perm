import { makeFlagCasesHandler } from "@/lib/flagCasesApi";
import { lca } from "@/lib/db/lcaCases";

export const revalidate = 0;
export const GET = makeFlagCasesHandler(lca);
