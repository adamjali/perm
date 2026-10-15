import { makeFlagCasesHandler } from "@/lib/flagCasesApi";
import { seasonal } from "@/lib/db/seasonalCases";

export const revalidate = 0;
export const GET = makeFlagCasesHandler(seasonal);
