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
 * `scripts/lib_slugs.py`. A key or a slug computed differently in the
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
  "llp", "lllp", "llc", "inc", "pc", "plc", "pllc", "lp", "ltd", "corp",
  "corporation", "co", "company", "pa", "chartered", "and", "the",
  // The spelled-out forms of "ltd" and "inc" (Oct 5 2026). Without them "INFOSYS LIMITED"
  // (46,988 LCAs) sat on a page apart from "INFOSYS LTD.", whose PERM page showed 0 H-1B.
  "limited", "incorporated",
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

/**
 * The entities DOL's program files actually carry, plus numeric ones.
 * Python's `html.unescape` knows every HTML5 name; these are the ones a
 * printed employer name has been seen to hold, so the two agree on every
 * name the fixture pins.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** "Acme Holdings d/b/a Acme Staffing": the legal name is the part before the trade name. */
const TRADE_NAME = /\s+(?:d\s*\/\s*b\s*\/\s*a|d\.b\.a\.?|dba|a\s*\/\s*k\s*\/\s*a|aka)\s+.*$/i;

/**
 * The key that joins a printed employer name to its page across programs.
 *
 * `entityKey` after the three repairs the H-1B and wage-request files need:
 * HTML entities decoded (twice, for "&amp;amp;"), only the legal name before
 * "d/b/a" or "a/k/a", and ".com" dropped. Mirrors `program_key` in
 * `scripts/entity_identity.py`, which builds `employer_page_map.key`; both are
 * asserted against `program_keys` in the shared fixture.
 */
export function programKey(raw: string): string {
  let text = decodeEntities(decodeEntities(raw ?? ""));
  text = text.replace(TRADE_NAME, "");
  text = text.replace(/\.com\b/gi, "");
  return entityKey(text);
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
