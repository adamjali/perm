/**
 * Employers whose names are withheld from the site, each at that person's own
 * request and by the owner's decision for that request alone.
 *
 * The list is never in this repository, which is public: a name kept here to
 * hide it would publish it, and even a hash can be matched against DOL's own
 * files. It lives in WITHHELD_EMPLOYERS, set on the server
 * (/srv/permtracker/app/env/production.env) and as a GitHub Actions secret for
 * the build, which prerenders pages from the same database. Unset, nothing is
 * withheld.
 *
 * Format: entries separated by ";", each "slug|name|label|case numbers", the
 * case numbers comma-separated, for example
 * "jane-q-example|Jane Q Example|Private household employer|G-100-25001-000001".
 * The case numbers catch the cases whatever spelling a later DOL file prints.
 *
 * DOL's record is untouched in the database. A withheld employer's own page
 * answers 404, and it and its cases leave every list, search and sitemap, so
 * no row stands out as the one taken down; totals computed in SQL still count
 * them. A lookup by the case's own number asks DOL live, shows the entry's
 * label, and is never recorded (`withheld` on DOL's answer). Applied in
 * one place for the database (`rows()` in ../db/client.ts, which every read
 * goes through) and one for DOL's live service (`askDol` in
 * ../db/caseDiscovery.ts, which every live lookup goes through).
 */

export type WithheldEntry = {
  readonly slug: string;
  readonly name: string;
  readonly label: string;
  readonly cases: readonly string[];
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Entries from the setting's text; a malformed entry is skipped, never guessed at. */
export function parseWithheld(raw: string | undefined): WithheldEntry[] {
  if (!raw) return [];
  const out: WithheldEntry[] = [];
  for (const part of raw.split(";")) {
    const [slug, name, label, cases] = part.split("|").map((s) => s.trim());
    if (!slug || !name || !label) continue;
    out.push({
      slug: normalize(slug),
      name: normalize(name),
      label,
      cases: (cases ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    });
  }
  return out;
}

/** The two checks, for a list of entries. A cell is compared only when its length matches one. */
export function makeWithholder(entries: readonly WithheldEntry[]) {
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const byName = new Map(entries.map((e) => [e.name, e]));
  const byCase = new Map(entries.flatMap((e) => e.cases.map((c) => [c.toLowerCase(), e] as const)));
  const sizes = new Set(entries.flatMap((e) => [e.slug.length, e.name.length, ...e.cases.map((c) => c.length)]));

  const match = (v: unknown): { kind: "slug" | "name" | "case"; entry: WithheldEntry } | null => {
    if (typeof v !== "string") return null;
    const n = normalize(v);
    if (!sizes.has(n.length)) return null;
    const s = bySlug.get(n);
    if (s) return { kind: "slug", entry: s };
    const m = byName.get(n);
    if (m) return { kind: "name", entry: m };
    const c = byCase.get(n);
    return c ? { kind: "case", entry: c } : null;
  };

  /**
   * A stored summary (a JSON document in one cell) that ever lists the name:
   * the name is replaced in place, which keeps the JSON valid. No summary
   * holds one today; this keeps a future one from bringing it back.
   */
  const inText = entries.map((e) => ({
    label: e.label,
    re: new RegExp(e.name.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "gi"),
  }));
  const scrubText = (v: string): string => {
    let out = v;
    for (const { re, label } of inText) out = out.replace(re, label);
    return out;
  };

  /** The name to show: the entry's label for a withheld name or case, else as given. */
  const shownName = (name: string | null | undefined, caseNumber?: string): string | null => {
    const byNumber = caseNumber ? byCase.get(caseNumber.trim().toLowerCase()) : undefined;
    if (byNumber) return byNumber.label;
    if (name == null) return null;
    const m = match(name);
    return m?.kind === "name" ? m.entry.label : name;
  };

  /**
   * Rows with a withheld employer taken out: any row that names it or is tied
   * to its page by a slug (the page, a ranking, a sitemap entry, one of its
   * cases, DOL's live status record of one) is dropped. A lookup by the case's
   * own number then misses here and asks DOL live, where `shownName` applies.
   */
  const withhold = <T>(rows: T[]): T[] => {
    if (!entries.length) return rows;
    const out: T[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        out.push(row);
        continue;
      }
      const cells = Object.entries(row as Record<string, unknown>);
      if (cells.some(([, v]) => match(v))) continue;
      let copy: Record<string, unknown> | null = null;
      for (const [k, v] of cells) {
        if (typeof v !== "string" || v.length < 64) continue;
        const scrubbed = scrubText(v);
        if (scrubbed === v) continue;
        copy ??= { ...(row as Record<string, unknown>) };
        copy[k] = scrubbed;
      }
      out.push((copy ?? row) as T);
    }
    return out;
  };

  return { shownName, withhold };
}

const shipped = makeWithholder(parseWithheld(process.env.WITHHELD_EMPLOYERS));

export const shownName = shipped.shownName;
export const withhold = shipped.withhold;
