import "server-only";

import { cache } from "react";

import { one, rows } from "./client";

/**
 * DOL's debarment lists, as `scripts/ingest_debarments.py` stores them.
 *
 * A row is one entity barred from one program for a dated period, with the
 * violation in DOL's own words. "Active" means the period contains today;
 * expired rows stay in the table as history. The employer and law-firm pages
 * ask for their own slug; the match is the entity's normalised name against
 * the page's slug prefix, which is how DOL's three files are joined
 * everywhere else on this site, so a differently punctuated spelling still
 * finds its row and a different company does not.
 */

export type DebarmentProgram = "perm" | "h1b" | "h2a" | "h2b";

export interface Debarment {
  program: DebarmentProgram;
  entity: string;
  entitySlug: string;
  entityType: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  violation: string | null;
  citation: string | null;
  sourceUrl: string;
}

export interface DebarmentsSummary {
  asOf: string;
  pdfDate: string | null;
  h1bEffective: string | null;
  counts: Record<DebarmentProgram, number>;
}

export const PROGRAM_LABEL: Record<DebarmentProgram, string> = {
  perm: "PERM (permanent labor certification)",
  h1b: "H-1B (Wage and Hour Division)",
  h2a: "H-2A (agricultural)",
  h2b: "H-2B (non-agricultural temporary)",
};

interface DbRow {
  program: string;
  entity: string;
  entity_slug: string;
  entity_type: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  violation: string | null;
  citation: string | null;
  source_url: string;
}

const COLS = "program, entity, entity_slug, entity_type, location, start_date, end_date, violation, citation, source_url";

function isProgram(v: string): v is DebarmentProgram {
  return v === "perm" || v === "h1b" || v === "h2a" || v === "h2b";
}

function toRow(r: DbRow): Debarment | null {
  if (!isProgram(r.program)) return null;
  return {
    program: r.program,
    entity: String(r.entity),
    entitySlug: String(r.entity_slug),
    entityType: r.entity_type == null ? null : String(r.entity_type),
    location: r.location == null ? null : String(r.location),
    startDate: String(r.start_date).slice(0, 10),
    endDate: String(r.end_date).slice(0, 10),
    violation: r.violation == null ? null : String(r.violation),
    citation: r.citation == null ? null : String(r.citation),
    sourceUrl: String(r.source_url),
  };
}

/** Every row, newest start first. The table is a few hundred rows at most. */
export const listDebarments = cache(async (): Promise<Debarment[]> => {
  const r = await rows<DbRow>(
    `SELECT ${COLS} FROM debarments ORDER BY start_date DESC, entity`,
  ).catch(() => [] as DbRow[]);
  return r.map(toRow).filter((x): x is Debarment => x !== null);
});

export const getDebarmentsSummary = cache(async (): Promise<DebarmentsSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'debarments_summary'").catch(() => null);
  if (!r?.json) return null;
  try {
    const d = JSON.parse(String(r.json)) as Record<string, unknown>;
    if (typeof d.asOf !== "string" || typeof d.counts !== "object" || d.counts === null) return null;
    const c = d.counts as Record<string, unknown>;
    return {
      asOf: d.asOf,
      pdfDate: typeof d.pdfDate === "string" ? d.pdfDate : null,
      h1bEffective: typeof d.h1bEffective === "string" ? d.h1bEffective : null,
      counts: {
        perm: Number(c.perm ?? 0),
        h1b: Number(c.h1b ?? 0),
        h2a: Number(c.h2a ?? 0),
        h2b: Number(c.h2b ?? 0),
      },
    };
  } catch {
    return null;
  }
}

);

/** True when the period contains `today` (ISO date). */
export function isActive(d: Debarment, today: string): boolean {
  return d.startDate <= today && today <= d.endDate;
}

/**
 * Debarments whose normalised entity name matches a page's slug: the entity's
 * slug is a prefix of the page slug or the page slug a prefix of it, so
 * "hercules-staffing-llc" finds "hercules-staffing" and the reverse, while a
 * short prefix like "acme" is refused to keep "acme-corp" from claiming
 * "acme-staffing-of-texas".
 */
export const debarmentsForSlug = cache(async (slug: string): Promise<Debarment[]> => {
  const stem = slug.replace(/-(llc|inc|corp|corporation|co|ltd|lp|llp|pc|pllc)$/i, "");
  if (stem.length < 8) return [];
  const r = await rows<DbRow>(
    `SELECT ${COLS} FROM debarments INDEXED BY debarments_slug ` +
      `WHERE (entity_slug >= ? AND entity_slug < ?) OR entity_slug = ? ORDER BY start_date DESC`,
    [stem, stem.slice(0, -1) + String.fromCharCode(stem.charCodeAt(stem.length - 1) + 1), slug],
  ).catch(() => [] as DbRow[]);
  return r.map(toRow).filter((x): x is Debarment => x !== null);
});
