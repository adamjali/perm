import { makeFlagCasesHandler } from "@/lib/flagCasesApi";
import { lca } from "@/lib/turso/lcaCases";

export const revalidate = 0;
export const GET = makeFlagCasesHandler(lca);
