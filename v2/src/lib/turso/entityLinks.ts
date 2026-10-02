import "server-only";

import { rows } from "@/lib/turso/client";

/**
 * Which of these slugs have a page to link to.
 *
 * Every filing row stores its employer's and law firm's slug, page or not. A
 * prevailing wage request from a ski resort that never filed a PERM, or a law
 * firm from a FY2016 file, carries a slug no page answers, and linking it
 * sends visitors and crawlers to a 404 (the daily activity tables and the
 * case search are where those links appear).
 *
 * The rule mirrors the pages themselves. An employer page exists for a
 * published employer, an alias of one (`resolveEntity`), or an employer with a
 * live PERM filing (`liveEmployerRecord`); a law-firm page for a published firm
 * or an alias. Each table is asked once per 300 slugs, by primary key or index.
 */
export type LinkableKind = "employer" | "attorney";

const BATCH = 300;

export async function linkableSlugs(
  kind: LinkableKind,
  slugs: Iterable<string | null | undefined>,
): Promise<Set<string>> {
  // A slug longer than the writer can produce names no page (liveEmployerRecord).
  const want = [...new Set([...slugs].filter((s): s is string => !!s && s.length <= 80))];
  const ok = new Set<string>();
  for (let i = 0; i < want.length; i += BATCH) {
    const batch = want.slice(i, i + BATCH);
    const marks = batch.map(() => "?").join(", ");
    const reads = [
      rows<{ slug: string }>(
        `SELECT slug FROM perm_entities WHERE kind = ? AND slug IN (${marks})`,
        [kind, ...batch],
      ),
      rows<{ slug: string }>(
        `SELECT slug FROM perm_entity_alias WHERE kind = ? AND slug IN (${marks})`,
        [kind, ...batch],
      ),
    ];
    if (kind === "employer") {
      reads.push(
        rows<{ slug: string }>(
          `SELECT DISTINCT employer_slug AS slug FROM perm_live_recent WHERE employer_slug IN (${marks})`,
          batch,
        ),
      );
    }
    for (const found of await Promise.all(reads)) {
      for (const r of found) ok.add(String(r.slug));
    }
  }
  return ok;
}

/**
 * Null out the employer and law-firm slugs that have no page, so the tables
 * that render them print the name as text instead of linking a 404.
 *
 * If the lookup itself fails the rows are returned untouched: the pages still
 * render, and the cost is the old behaviour, not a missing table.
 */
export async function keepLinkableSlugs<
  T extends { employerSlug?: string | null },
>(
  items: T[],
  firmSlugOf: (t: T) => string | null | undefined = () => null,
  clearFirm: (t: T) => T = (t) => t,
): Promise<T[]> {
  if (items.length === 0) return items;
  let employers: Set<string>;
  let firms: Set<string>;
  try {
    [employers, firms] = await Promise.all([
      linkableSlugs("employer", items.map((t) => t.employerSlug)),
      linkableSlugs("attorney", items.map(firmSlugOf)),
    ]);
  } catch {
    return items;
  }
  return items.map((t) => {
    let out = t;
    if (out.employerSlug && !employers.has(out.employerSlug)) out = { ...out, employerSlug: null };
    const firm = firmSlugOf(out);
    if (firm && !firms.has(firm)) out = clearFirm(out);
    return out;
  });
}
