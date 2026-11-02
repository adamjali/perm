import "server-only";

import { permLineFrom, type PermLine } from "@/lib/permLine";
import { getLiveCensus } from "./liveCensus";

/**
 * Where DOL is in the PERM line by our own check (lib/permLine.ts), from the census every page already reads
 * (React-cached, so this costs no extra read). Null when the census is missing or too old to trust: the
 * caller then names DOL's own month, with DOL's own date.
 */
export async function getPermLine(): Promise<PermLine | null> {
  const census = await getLiveCensus();
  return census ? permLineFrom(census.matrix, census.asOf) : null;
}
