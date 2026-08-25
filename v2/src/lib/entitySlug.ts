/**
 * Slugs for the programmatic entity pages.
 *
 * DOL prints legal entity names, and two of them really do collapse to the
 * same slug: "NORMAN W. FRIES, INC" and "Norman W. Fries, Inc." both reduce
 * to `norman-w-fries-inc`. A collision is not cosmetic here - two pages
 * claiming one URL means one of them is unreachable and the other shows the
 * wrong numbers - so `withUniqueSlugs` disambiguates by appending an index in
 * a stable order, and `findBySlug` is the only sanctioned way back.
 */

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
