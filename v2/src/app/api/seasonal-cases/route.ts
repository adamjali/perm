import { makeFlagCasesHandler } from "@/lib/flagCasesApi";
import { seasonal } from "@/lib/turso/seasonalCases";

export const revalidate = 0;
export const GET = makeFlagCasesHandler(seasonal);
