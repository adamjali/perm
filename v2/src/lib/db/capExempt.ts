import "server-only";

import { cache } from "react";

import { one } from "./client";
import type { CapExemptDoc } from "@/lib/capExempt";

/**
 * perm_docs['cap_exempt'], as build_cap_exempt.py writes it. A failed read
 * throws, so a page keeps its last good render; no doc yet is null.
 */
export const getCapExempt = cache(async (): Promise<CapExemptDoc | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'cap_exempt'");
  if (!r) return null;
  const d = JSON.parse(String(r.json)) as CapExemptDoc;
  return d && Array.isArray(d.top) ? d : null;
});
