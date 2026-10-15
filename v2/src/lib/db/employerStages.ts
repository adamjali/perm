import "server-only";

import { cache } from "react";

import { parseEmployerStagesDoc, type EmployerStagesDoc } from "../employerStages";
import { one } from "./client";

/**
 * The per-employer stage census the sweep writes into
 * `perm_docs['employer_stages']`. One point read; no fallback query on
 * purpose, because the fallback IS the 97,000-row group-by the doc exists to
 * avoid. A missing or stale doc renders as the page's empty state, which
 * names the sweep rather than pretending the record is empty.
 */
export const getEmployerStages = cache(async (): Promise<EmployerStagesDoc | null> => {
  const r = await one<{ json: string; computed_at: number | string }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = ?",
    ["employer_stages"],
  ).catch(() => null);
  if (!r) return null;
  return parseEmployerStagesDoc(String(r.json), Number(r.computed_at) || 0, Date.now());
});
