import "server-only";

import { cache } from "react";

import { one } from "./client";
import type { AcwiaAnswer, CapExemptDoc, CapExemptKind } from "@/lib/capExempt";

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

/**
 * One employer's ACWIA answer (cap_exempt_employers): the employer page's
 * note. Null for an employer not listed, or before the table exists.
 */
export const getAcwiaAnswer = cache(async (slug: string): Promise<AcwiaAnswer | null> => {
  try {
    const r = await one<{ kind: string | null; requests: unknown; answered: unknown }>(
      "SELECT kind, requests, answered FROM cap_exempt_employers WHERE slug = ?",
      [slug],
    );
    if (!r) return null;
    return { kind: (r.kind as CapExemptKind | null) ?? null, requests: Number(r.requests), answered: Number(r.answered) };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});
