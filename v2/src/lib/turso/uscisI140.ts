import "server-only";

import { queryStatic } from "@/lib/convexStatic";
import { parseI140Snapshot, type I140Snapshot } from "@/lib/uscisI140Shape";

import { api } from "../../../convex/_generated/api";
import { doc } from "./publicData";

/**
 * The newest USCIS I-140 quarter: the database copy first, Convex second.
 *
 * The database copy is written by every run of scripts/ingest_uscis_i140.py
 * that parses a complete quarter, on GitHub or on the server. Convex is written
 * only where a deploy key is held, which is GitHub, and www.uscis.gov refuses
 * GitHub's runners, so from Sep 29 2026 the database is the copy that moves.
 * Convex stays as the fallback for a database that has never held a quarter.
 */
export async function getI140Snapshot(revalidateSeconds: number): Promise<I140Snapshot | null> {
  const fromDb = parseI140Snapshot(await doc<unknown>("uscis_i140").catch(() => null));
  if (fromDb) return fromDb;
  return queryStatic(api.uscisI140.getLatest, {}, revalidateSeconds).catch(() => null);
}
