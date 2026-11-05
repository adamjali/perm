import "server-only";

import { cache } from "react";

import { parseFilingsDoc, type FilingsDoc } from "@/lib/filingsByDay";

import { one } from "./client";

/**
 * perm_docs['filings_by_day'] (scripts/build_filings_by_day.py, after each case-status pass).
 * Null when the row doesn't exist yet; a failed read throws, so a page keeps its last good render
 * rather than showing a day with no filings.
 */
export const getFilingsByDay = cache(async (): Promise<FilingsDoc | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'filings_by_day'");
  return parseFilingsDoc(r?.json ?? null);
});
