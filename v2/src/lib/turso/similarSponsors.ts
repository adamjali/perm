import "server-only";

import type { EntityNeighbor } from "@/lib/turso/entities";
import { rows } from "@/lib/turso/client";

/**
 * Sponsors hiring for the same work as one employer.
 *
 * The employer's top occupations come from its own facet rows (already read
 * by the page); for each, `perm_entity_facets` holds that occupation's top
 * sponsors. One indexed read per occupation, never a scan, so this costs a
 * handful of rows per page. Distinct from the volume peers above it: those
 * file about as many cases, these file for the same jobs.
 */
export interface SimilarSponsors {
  /** The occupation the list is drawn from, as DOL names it. */
  occupation: { slug: string; label: string } | null;
  sponsors: (EntityNeighbor & { inOccupation: number })[];
}

export async function similarSponsors(
  selfSlug: string,
  occupations: readonly { key: string | null; label: string }[],
  limit = 6,
): Promise<SimilarSponsors> {
  const out: SimilarSponsors["sponsors"] = [];
  const seen = new Set([selfSlug]);
  let used: SimilarSponsors["occupation"] = null;
  for (const occ of occupations.slice(0, 2)) {
    if (!occ.key) continue;
    const got = await rows<{
      slug: string; name: string; rank: number; total: number; certified: number | null; denied: number | null;
      median_days: number | null; median_annual_wage: number | null; state: string | null; n: number;
    }>(
      `SELECT e.slug, e.name, e.rank, e.total, e.certified, e.denied, e.median_days,
              e.median_annual_wage, e.state, f.n
         FROM perm_entity_facets f
         JOIN perm_entities e ON e.kind = 'employer' AND e.slug = f.key
        WHERE f.kind = 'occupation' AND f.slug = ? AND f.facet = 'employer'
        ORDER BY f.pos`,
      [occ.key],
    );
    for (const r of got) {
      if (seen.has(r.slug) || out.length >= limit) continue;
      seen.add(r.slug);
      used ??= { slug: occ.key, label: occ.label };
      out.push({
        slug: r.slug,
        name: r.name,
        rank: Number(r.rank),
        total: Number(r.total),
        certified: Number(r.certified ?? 0),
        denied: Number(r.denied ?? 0),
        medianDays: r.median_days === null ? null : Number(r.median_days),
        medianAnnualWage: r.median_annual_wage === null ? null : Number(r.median_annual_wage),
        state: r.state,
        inOccupation: Number(r.n),
      });
    }
  }
  return { occupation: used, sponsors: out };
}
