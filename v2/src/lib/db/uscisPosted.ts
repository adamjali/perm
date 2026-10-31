import "server-only";

import { cache } from "react";

import { parseUscisPosted, type UscisPosted } from "@/lib/uscisPosted";
import { one } from "./client";

/**
 * perm_docs['uscis_posted_times'], written by scripts/ingest_uscis_posted_times.py twice a day. Null when the doc
 * doesn't exist yet or can't be parsed, and the pages then print the typed figures with the day they were read. A
 * failed read throws, so a page keeps its last good render instead of dropping to the typed figures for a day.
 */
export const getUscisPosted = cache(async (): Promise<UscisPosted | null> => {
  try {
    const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'uscis_posted_times'");
    return r ? parseUscisPosted(String(r.json)) : null;
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});
