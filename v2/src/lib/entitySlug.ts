/**
 * Identity and URLs for the programmatic entity pages.
 *
 * Two separate jobs, and conflating them was the original bug.
 *
 * `entityKey` decides WHO an entity is, before anything is counted or
 * ranked. DOL prints the name that went on the form, so one practice
 * arrives under dozens of spellings.
 *
 * `slugify` / `withUniqueSlugs` decide what URL a decided entity gets. The
 * `-2` suffix still exists, but it now only handles the residue that
 * survives a real merge - two genuinely different entities whose names
 * happen to reduce to the same string. It is no longer doing identity's job.
 *
 * THE RULES ARE MIRRORED IN `scripts/entity_identity.py` AND
 * `scripts/store_entities.py`. A key or a slug computed differently in the
 * writer than in the reader is a detail page that 404s from its own index,
 * so `src/lib/__tests__/entitySlug.test.ts` and
 * `scripts/test_entity_identity.py` assert both against ONE fixture file:
 * `src/lib/__fixtures__/entityIdentity.json`.
 */

/**
 * Words that say what KIND of thing something is rather than which one.
 * Stripping them is conservative: two names still only merge when every
 * remaining word is identical.
 */
const ENTITY_NOISE = new Set([
  "llp", "llc", "inc", "pc", "plc", "pllc", "lp", "ltd", "corp",
  "corporation", "co", "company", "pa", "chartered", "and", "the",
]);

/**
 * A merge key for one real-world entity across its printed spellings.
 *
 * The load-bearing step is the re-glue. Punctuation is shredded to spaces
 * first, so `P.C.` arrived as `p` + `c` and the noise list - which has
 * always contained "pc" - never saw it. `Jackson Lewis P.C.` and `Jackson
 * Lewis PC` were two firms with two pages and two ranks, and so were 604
 * other pairs. Gluing runs of consecutive single-letter tokens back into one
 * token before filtering fixes exactly that and nothing else: `l l c` ->
 * `llc` (dropped), `p a` -> `pa` (dropped), `a t t` -> `att` (kept, and
 * correct for AT&T).
 */
export function entityKey(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const glued: string[] = [];
  for (let i = 0; i < words.length; ) {
    if (words[i]!.length === 1) {
      let j = i;
      while (j < words.length && words[j]!.length === 1) j += 1;
      glued.push(words.slice(i, j).join(""));
      i = j;
    } else {
      glued.push(words[i]!);
      i += 1;
    }
  }
  const kept = glued.filter((w) => !ENTITY_NOISE.has(w));
  return kept.length > 0 ? kept.join(" ") : cleaned.trim();
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
}

export interface Slugged<T> {
  slug: string;
  item: T;
}

/**
 * Assigns each item a unique slug. Order matters and must be deterministic:
 * the caller sorts first (by volume), so the busier entity keeps the clean
 * slug and the later one takes the suffix.
 */
export function withUniqueSlugs<T>(items: T[], nameOf: (item: T) => string): Slugged<T>[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = slugify(nameOf(item)) || "entity";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { slug: n === 0 ? base : `${base}-${n + 1}`, item };
  });
}

export function findBySlug<T>(items: Slugged<T>[], slug: string): T | undefined {
  return items.find((s) => s.slug === slug)?.item;
}
