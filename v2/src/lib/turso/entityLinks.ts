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
 * published employer, an alias of one (`resolveEntity`), an employer with a
 * live PERM filing (`liveEmployerRecord`), or one with no PERM record
 * (`otherEmployerRecord`); a law-firm page for a published firm or an alias.
 * And a spelling with no page of its own links to the page the nightly map
 * assigns it (`employer_page_map`): "Salesforce.com, Inc." goes straight to
 * Salesforce's page, not through a redirect. Each table is asked once per 300
 * slugs, by primary key or index.
 */
export type LinkableKind = "employer" | "attorney";

const BATCH = 300;

const tolerateMissing = (e: unknown): { slug: string }[] => {
  if (/no such table/i.test(String(e))) return [];
  throw e;
};

/** Each slug that has a page, with the page it links to (itself, or the page the map assigns it). */
export async function linkTargets(
  kind: LinkableKind,
  slugs: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  // A slug longer than the writer can produce names no page (liveEmployerRecord).
  const want = [...new Set([...slugs].filter((s): s is string => !!s && s.length <= 80))];
  const out = new Map<string, string>();
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
    let mapped: Promise<{ source_slug: string; page_slug: string }[]> = Promise.resolve([]);
    if (kind === "employer") {
      reads.push(
        rows<{ slug: string }>(
          `SELECT DISTINCT employer_slug AS slug FROM perm_live_recent WHERE employer_slug IN (${marks})`,
          batch,
        ),
        // Built nightly; before the first build the Oct 3 seasonal table stands in.
        rows<{ slug: string }>(`SELECT slug FROM employer_other_index WHERE slug IN (${marks})`, batch).catch(
          (e: unknown) => {
            tolerateMissing(e);
            return rows<{ slug: string }>(`SELECT slug FROM seasonal_employer_index WHERE slug IN (${marks})`, batch).catch(
              tolerateMissing,
            );
          },
        ),
      );
      mapped = rows<{ source_slug: string; page_slug: string }>(
        `SELECT source_slug, page_slug FROM employer_page_map WHERE source_slug IN (${marks})`,
        batch,
      ).catch((e: unknown) => tolerateMissing(e) as never[]);
    }
    const [found, map] = await Promise.all([Promise.all(reads), mapped]);
    for (const r of map) out.set(String(r.source_slug), String(r.page_slug));
    for (const list of found) {
      for (const r of list) if (!out.has(String(r.slug))) out.set(String(r.slug), String(r.slug));
    }
  }
  return out;
}

/** Which of these slugs have a page to link to (their own, or one the map assigns). */
export async function linkableSlugs(
  kind: LinkableKind,
  slugs: Iterable<string | null | undefined>,
): Promise<Set<string>> {
  return new Set((await linkTargets(kind, slugs)).keys());
}

/**
 * Point each employer slug at its page, and null out the employer and
 * law-firm slugs that have no page, so the tables that render them print the
 * name as text instead of linking a 404.
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
  let employers: Map<string, string>;
  let firms: Set<string>;
  try {
    [employers, firms] = await Promise.all([
      linkTargets("employer", items.map((t) => t.employerSlug)),
      linkableSlugs("attorney", items.map(firmSlugOf)),
    ]);
  } catch {
    return items;
  }
  return items.map((t) => {
    let out = t;
    if (out.employerSlug) {
      const page = employers.get(out.employerSlug) ?? null;
      if (page !== out.employerSlug) out = { ...out, employerSlug: page };
    }
    const firm = firmSlugOf(out);
    if (firm && !firms.has(firm)) out = clearFirm(out);
    return out;
  });
}
