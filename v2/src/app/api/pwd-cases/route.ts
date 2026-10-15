import { makeFlagCasesHandler } from "@/lib/flagCasesApi";
import { pwd } from "@/lib/db/pwdCases";

export const revalidate = 0;
export const GET = makeFlagCasesHandler(pwd);
