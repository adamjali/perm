/**
 * Names taken off the site at a person's or a firm's own request, by the
 * owner's decision for that request alone. The one rule, shared by the site
 * (`src/lib/privacy/withheld.ts`, applied in `rows()` in
 * `src/lib/db/client.ts`) and Convex (`convex/lib/publicMirror.ts`, which
 * every Convex read of the public database goes through). Convex can't import
 * the site's modules, so the rule lives here and the site re-exports it.
 *
 * WHAT A REMOVAL DOES (owner, Nov 5 2026). The NAME goes; every row, count,
 * total, share, rank and chart stays exactly as it was.
 *   - Everywhere the name would show it shows a stable label, "Law firm 3" or
 *     "Employer 1", and its slug becomes the label's own slug, so the row
 *     still links, to a neutral page (/perm-attorneys/law-firm-3).
 *   - The neutral page is the entity's own page with the name masked; the
 *     page marks itself noindex and hides its spelling, alias and profile
 *     blocks. Reads asked by the neutral slug are rewritten here to the real
 *     slugs, so every figure on it is the real one.
 *   - A read asked BY the real name or slug (the old URL, a search, a filter,
 *     an alias redirect) finds nothing: the rows that are the entity are
 *     dropped, so the old URL answers 404 and never redirects to the neutral
 *     page, which would tie the name to the number.
 *   - A case read by its number keeps working, with the label in place of the
 *     employer's name.
 * DOL's records in the database are never changed: the masking happens on
 * the way out, so a reload or a rebuild can't bring a name back.
 *
 * THE LISTS ARE NEVER IN THIS REPOSITORY, which is public: a name kept here to
 * hide it would publish it. They live in two settings, one per kind, on the
 * server (production.env), as GitHub Actions secrets (the build) and on Convex
 * production, all written by `scripts/withhold.py`:
 *   WITHHELD_EMPLOYERS  employers (a person employing a household worker, a company)
 *   WITHHELD_FIRMS      law firms (DOL's attorney or agent firm)
 * Two settings rather than a kind prefix in one: code that predates the firm
 * kind ignores WITHHELD_FIRMS entirely instead of misreading a firm as an
 * employer, and each setting's name says what it holds.
 *
 * FORMAT, the same for both: entries separated by ";", each
 *   slug|name|label|cases|number|more slugs|more names
 * - slug: the entity's page slug; name: its name as DOL prints it;
 * - label: the neutral word ("Law firm", "Employer", "Private household
 *   employer"); shown as "<label> <number>";
 * - cases: case numbers, comma-separated (an employer's, to catch a later file
 *   that spells the name differently; usually empty for a firm);
 * - number: the entry's stable number for its kind, assigned once by the tool
 *   and never reused, so removing one entry renumbers nothing;
 * - more slugs: alias, merged and page-map spellings' slugs, comma-separated;
 * - more names: every other printed spelling, separated by "^".
 * The first four fields are the format before Nov 5 2026 and still parse: an
 * entry without a number is masked with its plain label and links nowhere.
 * Example (made up): "jane-q-example|Jane Q Example|Employer|G-100-25001-000001|1||"
 *
 * NUMBERING IS SITE-WIDE (owner's decision, Nov 5 2026): each entry carries
 * its own number in its kind, so "Law firm 3" is the same firm on every page.
 * There is no per-page mode.
 */

export type WithheldKind = "employer" | "firm";

/** The setting each kind's list lives in. */
export const WITHHELD_ENV: Readonly<Record<WithheldKind, string>> = {
  employer: "WITHHELD_EMPLOYERS",
  firm: "WITHHELD_FIRMS",
};

/** Where each kind's pages live; a neutral page is one more page there. */
export const NEUTRAL_BASE: Readonly<Record<WithheldKind, string>> = {
  employer: "/perm-employers",
  firm: "/perm-attorneys",
};

/** The label a new entry gets when the owner names none. */
export const DEFAULT_LABEL: Readonly<Record<WithheldKind, string>> = {
  employer: "Employer",
  firm: "Law firm",
};

export interface WithheldEntry {
  readonly kind: WithheldKind;
  /** The page slug, lower case. */
  readonly slug: string;
  /** The name as DOL prints it, spacing evened out. */
  readonly name: string;
  readonly label: string;
  readonly cases: readonly string[];
  /** Its stable number in its kind; null for an entry made before numbers. */
  readonly number: number | null;
  /** Every slug the entity is known by, the page slug first. */
  readonly slugs: readonly string[];
  /** Every printed spelling, the main one first. */
  readonly names: readonly string[];
}

const squashSpaces = (s: string) => s.trim().replace(/\s+/g, " ");
/** A name or slug as compared: case and spacing don't count. */
const squash = (s: string) => squashSpaces(s.normalize("NFKC")).toLowerCase();

/** Entries from one setting's text; a malformed entry is skipped, never guessed at. */
export function parseWithheld(raw: string | undefined | null, kind: WithheldKind = "employer"): WithheldEntry[] {
  if (!raw) return [];
  const out: WithheldEntry[] = [];
  for (const part of raw.split(";")) {
    const f = part.split("|").map((s) => s.trim());
    const [slug, name, label, cases, num, moreSlugs, moreNames] = f;
    if (!slug || !name || !label) continue;
    const page = squash(slug);
    const number = num && /^\d{1,6}$/.test(num) && Number(num) > 0 ? Number(num) : null;
    const slugs = unique([page, ...(moreSlugs ?? "").split(",").map(squash).filter(Boolean)]);
    const names = uniqueBy(
      [squashSpaces(name), ...(moreNames ?? "").split("^").map(squashSpaces).filter(Boolean)],
      squash,
    );
    out.push({
      kind,
      slug: page,
      name: squashSpaces(name),
      label,
      cases: unique((cases ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)),
      number,
      slugs,
      names,
    });
  }
  return out;
}

/** Both settings, from an environment (process.env on the server and on Convex). */
export function parseWithheldEnv(env: Readonly<Record<string, string | undefined>>): WithheldEntry[] {
  return [
    ...parseWithheld(env[WITHHELD_ENV.employer], "employer"),
    ...parseWithheld(env[WITHHELD_ENV.firm], "firm"),
  ];
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function uniqueBy<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Labels and neutral pages
// ---------------------------------------------------------------------------

/** The label without "A ", capitalised, the way it reads before a number. */
function baseLabel(e: Pick<WithheldEntry, "label">): string {
  const t = e.label.trim().replace(/^(a|an)\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function slugifyLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** What shows where the name would: "Law firm 3", or the plain label for an entry without a number. */
export function shownLabel(e: Pick<WithheldEntry, "label" | "number">): string {
  return e.number ? `${baseLabel(e)} ${e.number}` : e.label;
}

/** The neutral page's slug ("law-firm-3"), or null for an entry without a number (it links nowhere). */
export function neutralSlug(e: Pick<WithheldEntry, "label" | "number">): string | null {
  return e.number ? `${slugifyLabel(baseLabel(e))}-${e.number}` : null;
}

/** The neutral page's path, or null. */
export function neutralPath(e: Pick<WithheldEntry, "kind" | "label" | "number">): string | null {
  const s = neutralSlug(e);
  return s ? `${NEUTRAL_BASE[e.kind]}/${s}` : null;
}

// ---------------------------------------------------------------------------
// Matching a name
// ---------------------------------------------------------------------------

/**
 * Words that say what kind of company a name is, not which one: "Example Law
 * Group, PLLC" and "EXAMPLE LAW GROUP PLLC" and "Example Law Group P.L.L.C."
 * are one firm. Only trailing ones are dropped.
 */
const FORM_WORDS = new Set([
  "llc", "pllc", "llp", "lllp", "lp", "pc", "pa", "psc", "plc", "apc", "aplc", "alc",
  "inc", "incorporated", "corp", "corporation", "co", "ltd", "limited", "chtd", "chartered",
  "esq", "esquire", "sc",
]);

/** A name reduced to what identifies it: words only, form words off the end. Slugs reduce the same way. */
export function nameKey(s: string): string {
  const t = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ");
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  // "L.L.C." and "P.C." print as runs of single letters: each run is one word.
  const joined: string[] = [];
  let run = "";
  for (const w of words) {
    if (w.length === 1 && /[a-z]/.test(w)) {
      run += w;
      continue;
    }
    if (run) joined.push(run);
    run = "";
    joined.push(w);
  }
  if (run) joined.push(run);
  while (joined.length > 1 && FORM_WORDS.has(joined[joined.length - 1] ?? "")) joined.pop();
  if (joined.length > 1 && joined[0] === "the") joined.shift();
  return joined.join(" ");
}

/** A key shorter than this matches only exactly: "abc" would be any company's initials. */
const MIN_KEY = 5;

/** A text this long in a column that isn't an entity's own is scrubbed for whole names (a title, a note, a summary). */
const PROSE_MIN = 12;

const FIRM = 1;
const EMPLOYER = 2;
const ANY = FIRM | EMPLOYER;
const NONE = 0;
type KindMask = number;

const KIND_BIT: Record<WithheldKind, KindMask> = { firm: FIRM, employer: EMPLOYER };

/** What a column (or a JSON key) holds, from its name alone. */
interface Role {
  kind: "firm" | "employer" | "generic" | "case" | "other";
  /** A slug-like cell takes the neutral slug; any other takes the label. */
  slugLike: boolean;
}

/** Columns whose kind comes from the row or the statement (perm_entities' `slug` and `name`, a facet's `key` and `label`). */
const GENERIC = new Set([
  "slug", "name", "key", "label", "page_slug", "pageslug", "source_slug", "sourceslug", "target_slug",
  "targetslug", "alias", "merge_key", "mergekey", "display_name", "displayname", "legal_name", "legalname",
  "entity", "entity_slug", "entityslug", "entity_name", "entityname", "page", "target", "source",
]);

const roleCache = new Map<string, Role>();

export function roleOf(column: string): Role {
  const hit = roleCache.get(column);
  if (hit) return hit;
  const c = column.toLowerCase();
  const slugLike = /slug|key$|^(page|target|source|alias|href|url|link)$/.test(c);
  let kind: Role["kind"];
  if (/case_?(number|no)$|^case$|^cn$/.test(c)) kind = "case";
  else if (/attorney|firm|atty/.test(c)) kind = "firm";
  else if (/employer|sponsor|petitioner|compan(y|ies)|business_?name|^emp(_|slug|name|$)/.test(c)) kind = "employer";
  else if (GENERIC.has(c)) kind = "generic";
  else kind = "other";
  const role = { kind, slugLike };
  if (roleCache.size < 2000) roleCache.set(column, role);
  return role;
}

/** The kind a row's (or a JSON object's) own `facet` or `kind` says its generic cells are, or null. */
function ownKind(o: Record<string, unknown>): KindMask | null {
  const v = typeof o.facet === "string" ? o.facet : typeof o.kind === "string" ? o.kind : null;
  if (v === null) return null;
  const k = v.toLowerCase();
  if (k === "attorney" || k === "firm") return FIRM;
  if (k === "employer") return EMPLOYER;
  return NONE;
}

/** The kind a JSON key says the objects under it are: `firms: [...]`, `topEmployers: [...]`. */
function keyKind(key: string): KindMask | null {
  const k = key.toLowerCase();
  if (/attorney|firm|atty/.test(k)) return FIRM;
  if (/employer|sponsor|compan/.test(k)) return EMPLOYER;
  if (/occupation|job|soc|state|cit(y|ies)|industr|countr|newspaper|title|program/.test(k)) return NONE;
  return null;
}

const CASE_NUMBER = /^[A-Z]{1,2}(-[A-Z])?-\d{3}-\d{5}-\d{6}$/i;

// ---------------------------------------------------------------------------
// Reading a statement
// ---------------------------------------------------------------------------

/** One `?` in a statement: the column it's compared with, how, and the IN list it sits in. */
interface Bind {
  col: string | null;
  op: string | null;
  /** The offset of the IN list's "(" for a placeholder inside one. */
  list: number | null;
}

interface Scanned {
  positions: number[];
  binds: Bind[];
  tables: Set<string>;
  kindLiterals: string[];
}

/**
 * The statement with every string literal and comment blanked to spaces, so
 * the patterns below can't be fooled by a `?` or a table name inside text.
 */
function blank(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      // Keep the quotes and the literal's text: kind literals are read from it.
      out += sql.slice(i, Math.min(j + 1, sql.length)).replace(/\?/g, " ");
      i = j + 1;
    } else if (ch === "-" && sql[i + 1] === "-") {
      const j = sql.indexOf("\n", i);
      const end = j < 0 ? sql.length : j;
      out += " ".repeat(end - i);
      i = end;
    } else if (ch === "/" && sql[i + 1] === "*") {
      const j = sql.indexOf("*/", i + 2);
      const end = j < 0 ? sql.length : j + 2;
      out += " ".repeat(end - i);
      i = end;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const SQL_WORDS = new Set([
  "where", "on", "left", "right", "inner", "outer", "cross", "join", "order", "group", "limit", "having",
  "union", "select", "as", "using", "natural", "full", "set", "values", "and", "or", "not",
]);

const COMPARE = /([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s*(==|=|!=|<>|>=|<=|>|<|\blike\b|\bglob\b|\bis\b)\s*$/i;
const COMPARE_CALL = /\(\s*([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)[^()]*\)\s*(==|=|!=|<>|>=|<=|>|<|\blike\b|\bglob\b)\s*$/i;
const IN_LIST = /([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s+(?:not\s+)?in\s*\((?:\s*\?\s*,)*\s*$/i;
const BETWEEN = /\bbetween\s*$|\bbetween\s+\?\s+and\s*$/i;

function scan(sql: string): Scanned {
  const b = blank(sql);
  const positions: number[] = [];
  for (let i = 0; i < b.length; i++) {
    // `?NNN` and `:name` aren't used here; a numbered placeholder leaves the statement unrewritten.
    if (b[i] === "?") positions.push(i);
  }
  const binds: Bind[] = positions.map((p) => {
    const before = b.slice(Math.max(0, p - 240), p);
    const strip = (c: string) => c.replace(/^.*\./, "").toLowerCase();
    let m = IN_LIST.exec(before);
    if (m) {
      const open = before.lastIndexOf("(");
      return { col: strip(m[1]!), op: "in", list: Math.max(0, p - 240) + open };
    }
    if (BETWEEN.test(before)) return { col: null, op: "between", list: null };
    m = COMPARE.exec(before) ?? COMPARE_CALL.exec(before);
    if (m) return { col: strip(m[1]!), op: m[2]!.toLowerCase(), list: null };
    return { col: null, op: null, list: null };
  });
  const tables = new Set<string>();
  const tableRe = /\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi;
  let t: RegExpExecArray | null;
  while ((t = tableRe.exec(b))) {
    const name = t[1]!.toLowerCase();
    if (!SQL_WORDS.has(name)) tables.add(name);
  }
  const kindLiterals: string[] = [];
  const litRe = /\b(?:[a-z_][a-z0-9_]*\.)?(?:kind|facet)\s*=\s*'([a-z]+)'/gi;
  let k: RegExpExecArray | null;
  while ((k = litRe.exec(b))) kindLiterals.push(k[1]!.toLowerCase());
  return { positions, binds, tables, kindLiterals };
}

/** Tables whose rows name one kind of entity in their generic columns. */
const FIRM_TABLES = new Set(["firm_page_map", "firm_ranks", "firm_programs", "firm_email_domains"]);
const EMPLOYER_TABLES = new Set([
  "employer_page_map", "perm_live_only_index", "employer_other_index", "seasonal_employer_index",
  "sponsor_index", "sponsor_jobs", "h1b_employer_ranks", "cap_exempt_employers", "perm_employer_years",
  "sevp_top_employers", "warn_notices", "debarments", "whd_cases", "osha_inspections", "sam_exclusions",
  "taa_petitions", "ppp_loans",
]);
/** Tables whose generic columns name places, jobs and groups, never an employer or a firm. */
const OTHER_TABLES = new Set([
  "perm_groups", "lca_cities", "soc_titles", "onet_occupations", "city_geo", "bls_oews", "bls_projections",
  "census_counties", "perm_docs", "data_freshness",
]);

/**
 * Tables that map one slug to another page: an alias, a printed spelling, a
 * sponsor's finder row. A row of theirs that reaches a withheld entity is
 * DROPPED unless the read was asked by the neutral slug: masked, an alias of
 * the old name would redirect to the neutral page, which ties the name to the
 * number, and a finder row would make the neutral page a search result.
 */
const DROP_UNLESS_NEUTRAL = new Set([
  "perm_entity_alias", "employer_page_map", "firm_page_map", "sponsor_index", "sponsor_jobs",
]);

function kindWord(w: string): KindMask {
  if (w === "attorney" || w === "firm") return FIRM;
  if (w === "employer") return EMPLOYER;
  return NONE;
}

/** The kind a statement's generic columns name, or null when it can't be told (both are then possible). */
function statementKind(s: Scanned, args: readonly unknown[]): KindMask | null {
  const seen = new Set<KindMask>();
  for (const t of s.tables) {
    if (FIRM_TABLES.has(t)) seen.add(FIRM);
    else if (EMPLOYER_TABLES.has(t)) seen.add(EMPLOYER);
    else if (OTHER_TABLES.has(t)) seen.add(NONE);
  }
  for (const w of s.kindLiterals) seen.add(kindWord(w));
  s.binds.forEach((b, i) => {
    const a = args[i];
    if (b.col && /^(kind|facet)$/.test(b.col) && typeof a === "string") seen.add(kindWord(a.toLowerCase()));
  });
  // Places and jobs beside an entity table say nothing about the entity's own cells.
  if (seen.size > 1) seen.delete(NONE);
  return seen.size === 1 ? [...seen][0]! : null;
}

/** The kinds a cell can name, from its role and the row's or statement's own kind. */
function kindsFor(role: Role, context: KindMask | null): KindMask {
  if (role.kind === "firm") return FIRM;
  if (role.kind === "employer") return EMPLOYER;
  if (role.kind === "case") return NONE;
  if (role.kind === "generic") return context ?? ANY;
  // Any other column: an exact name only (see `match`), for either kind.
  return ANY;
}

// ---------------------------------------------------------------------------
// The masker
// ---------------------------------------------------------------------------

/** What a statement was asked by, worked out before it runs. */
export interface StatementContext {
  readonly kind: KindMask | null;
  readonly tables: ReadonlySet<string>;
  /** Entries a placeholder named by their real name or slug: their rows are dropped. */
  readonly byReal: ReadonlySet<WithheldEntry>;
  /** Entries a placeholder named by their neutral slug, rewritten to the real slugs. */
  readonly byNeutral: ReadonlySet<WithheldEntry>;
}

export interface PreparedStatement {
  sql: string;
  args: unknown[];
  ctx: StatementContext;
}

export interface MaskOptions {
  /**
   * Drop every row that names a withheld entity instead of masking it. For
   * navigation lists only (the sitemap, the A to Z pages, the name
   * suggestions, a spelling list): a masked row there would make the neutral
   * page a search result of its own, or place it under the real name's letter.
   */
  drop?: boolean;
}

interface Hit {
  entry: WithheldEntry;
  how: "slug" | "name";
}

export interface Masker {
  /** False when nothing is withheld: every function below is then a no-op. */
  readonly active: boolean;
  readonly entries: readonly WithheldEntry[];
  /** Rewrite a statement's neutral slugs to the real ones and note what it was asked by. */
  prepare(sql: string, args?: readonly unknown[]): PreparedStatement;
  /** Rows as the public may see them. */
  mask<T>(rows: T[], ctx: StatementContext, opts?: MaskOptions): T[];
  /** The same, with each kept row's index among the rows read (for paging over the raw rows). */
  maskIndexed<T>(rows: T[], ctx: StatementContext, opts?: MaskOptions): { rows: T[]; kept: number[] };
  /** The employer's name to show on DOL's live answer: the label for a withheld name or case, else as given. */
  shownName(name: string | null | undefined, caseNumber?: string): string | null;
  /** True when a search's or a filter's words are a withheld entity's real name or slug. */
  isWithheldQuery(kind: WithheldKind | "any", text: string | null | undefined): boolean;
  /** The entry a neutral slug stands for, or null. */
  neutralEntry(kind: WithheldKind, slug: string | null | undefined): WithheldEntry | null;
  /** The entry a neutral page's path stands for ("/perm-attorneys/law-firm-3"), or null. */
  neutralForPath(path: string): WithheldEntry | null;
  /** The entry a real slug or a neutral slug names, for refusals (a firm claim): null when neither. */
  withheldBySlug(kind: WithheldKind, slug: string | null | undefined): WithheldEntry | null;
  /** A text with every withheld name in it replaced, for prose and stored summaries. */
  scrubText(text: string): string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FORM_TAIL = `(?:[\\s,.]+(?:${[...FORM_WORDS].join("|")}|l\\.?\\s?l\\.?\\s?c|p\\.?\\s?l\\.?\\s?l\\.?\\s?c|l\\.?\\s?l\\.?\\s?p|p\\.?\\s?c)\\.?)*`;

/** The name's words in order, with anything but letters and digits between them. */
function flexName(name: string): string | null {
  const words = nameKey(name).split(" ").filter(Boolean);
  if (words.join("").length < MIN_KEY) return null;
  return words.map(escapeRe).join("[^a-z0-9]{1,8}");
}

export function makeMasker(entries: readonly WithheldEntry[]): Masker {
  const active = entries.length > 0;
  const bySlug = new Map<string, WithheldEntry[]>();
  const byName = new Map<string, WithheldEntry[]>();
  const byKey = new Map<string, WithheldEntry[]>();
  const byCase = new Map<string, WithheldEntry>();
  const byNeutral = new Map<string, WithheldEntry>();
  /** First words of every key, so most cells never pay for `nameKey`. */
  const keyStarts = new Set<string>();
  const add = (m: Map<string, WithheldEntry[]>, k: string, e: WithheldEntry) => {
    const list = m.get(k);
    if (list) {
      if (!list.includes(e)) list.push(e);
    } else m.set(k, [e]);
  };
  for (const e of entries) {
    for (const s of e.slugs) {
      add(bySlug, s, e);
      const k = nameKey(s);
      if (k.replace(/ /g, "").length >= MIN_KEY) {
        add(byKey, k, e);
        keyStarts.add(k.split(" ")[0]!);
      }
    }
    for (const n of e.names) {
      add(byName, squash(n), e);
      const k = nameKey(n);
      if (k.replace(/ /g, "").length >= MIN_KEY) {
        add(byKey, k, e);
        keyStarts.add(k.split(" ")[0]!);
      }
    }
    if (e.kind === "employer") for (const c of e.cases) byCase.set(c, e);
    const ns = neutralSlug(e);
    if (ns && !byNeutral.has(`${e.kind}:${ns}`)) byNeutral.set(`${e.kind}:${ns}`, e);
  }

  const pick = (list: WithheldEntry[] | undefined, kinds: KindMask): WithheldEntry | null => {
    if (!list) return null;
    for (const e of list) if (KIND_BIT[e.kind] & kinds) return e;
    return null;
  };

  /**
   * The entry a cell's text names. `exactOnly` (a column that isn't an
   * entity's: a job title, a note) matches a whole name exactly and nothing
   * looser, so a common word can never be taken for a firm.
   */
  const match = (value: string, kinds: KindMask, exactOnly = false): Hit | null => {
    if (!kinds || !value) return null;
    const lower = squash(value);
    if (!lower || lower.length > 300) return null;
    if (!exactOnly) {
      const s = pick(bySlug.get(lower), kinds);
      if (s) return { entry: s, how: "slug" };
    }
    const n = pick(byName.get(lower), kinds);
    if (n) return { entry: n, how: "name" };
    if (exactOnly) return null;
    const first = lower.split(/[^a-z0-9]+/).find(Boolean);
    if (!first || !keyStarts.has(first)) {
      // "The Example Law Group" starts with a word the keys drop.
      if (first !== "the") return null;
    }
    const k = nameKey(value);
    const e = pick(byKey.get(k), kinds);
    if (!e) return null;
    // A key from a hyphenated, spaceless value was a slug; anything else a name.
    return { entry: e, how: /\s/.test(value.trim()) || !value.includes("-") ? "name" : "slug" };
  };

  /** A whole slug or a whole name, nothing looser: for a summary's object keys. */
  const matchExact = (value: string, kinds: KindMask): Hit | null => {
    if (!kinds || !value) return null;
    const lower = squash(value);
    const s = pick(bySlug.get(lower), kinds);
    if (s) return { entry: s, how: "slug" };
    const n = pick(byName.get(lower), kinds);
    return n ? { entry: n, how: "name" } : null;
  };

  // Text and stored summaries: one loose test first, so a cell that can't hold
  // a name costs one regular expression and no parse.
  // Every pattern below is built from the server's own withheld lists (never a visitor's input), each value
  // through escapeRe, joined only by fixed, bounded pieces (flexName's [^a-z0-9]{1,8}, FORM_TAIL).
  const looseParts: string[] = [];
  const namePatterns: { re: RegExp; entry: WithheldEntry }[] = [];
  for (const e of entries) {
    for (const s of e.slugs) looseParts.push(escapeRe(s));
    for (const c of e.cases) looseParts.push(escapeRe(c));
    for (const n of e.names) {
      const flex = flexName(n);
      if (!flex) {
        looseParts.push(escapeRe(n));
        // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        namePatterns.push({ re: new RegExp(`\\b${escapeRe(n)}\\b`, "gi"), entry: e });
        continue;
      }
      looseParts.push(flex);
      // Ends at anything but a letter or digit, so "P.L.L.C." keeps its last period.
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      namePatterns.push({ re: new RegExp(`\\b${flex}${FORM_TAIL}(?![a-z0-9])`, "gi"), entry: e });
    }
  }
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const loose = looseParts.length ? new RegExp(looseParts.join("|"), "i") : null;
  const pathPatterns = entries.flatMap((e) =>
    e.slugs.map((s) => ({
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      re: new RegExp(`${escapeRe(NEUTRAL_BASE[e.kind])}/${escapeRe(s)}(?![a-z0-9-])`, "gi"),
      to: neutralPath(e) ?? NEUTRAL_BASE[e.kind],
    })),
  );

  const scrubText = (text: string): string => {
    if (!loose || !loose.test(text)) return text;
    let out = text;
    for (const { re, to } of pathPatterns) out = out.replace(re, to);
    for (const { re, entry } of namePatterns) out = out.replace(re, shownLabel(entry));
    return out;
  };

  /**
   * One JSON value, masked in place. Returns whether anything changed. `kind`
   * is what the enclosing key or object says the value names.
   */
  const walk = (node: unknown, kind: KindMask): boolean => {
    if (Array.isArray(node)) {
      let changed = false;
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === "string") {
          const hit = match(v, kind);
          if (hit) {
            node[i] = hit.how === "slug" ? neutralSlug(hit.entry) : shownLabel(hit.entry);
            changed = true;
          } else if (v.length >= PROSE_MIN) {
            const s = scrubText(v);
            if (s !== v) {
              node[i] = s;
              changed = true;
            }
          }
        } else if (v && typeof v === "object") changed = walk(v, kind) || changed;
      }
      return changed;
    }
    if (!node || typeof node !== "object") return false;
    const o = node as Record<string, unknown>;
    const objKind = ownKind(o) ?? kind;
    let changed = false;
    // A summary keyed by slug or name ({ "<slug>": {...} }) would print the key.
    for (const k of Object.keys(o)) {
      const hit = matchExact(k, objKind);
      if (!hit) continue;
      const to = hit.how === "slug" ? (neutralSlug(hit.entry) ?? shownLabel(hit.entry)) : shownLabel(hit.entry);
      if (!(to in o)) o[to] = o[k];
      delete o[k];
      changed = true;
    }
    let caseEntry: WithheldEntry | null = null;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && roleOf(k).kind === "case") caseEntry ??= byCase.get(v.trim().toUpperCase()) ?? null;
    }
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") {
        const role = roleOf(k);
        if (role.kind === "case") continue;
        const kinds = kindsFor(role, objKind);
        const hit = match(v, kinds, role.kind === "other");
        if (hit) {
          o[k] = role.slugLike ? neutralSlug(hit.entry) : shownLabel(hit.entry);
          changed = true;
        } else if (
          caseEntry &&
          (role.kind === "employer" || (role.kind === "generic" && kindsFor(role, objKind) & EMPLOYER))
        ) {
          o[k] = role.slugLike ? neutralSlug(caseEntry) : shownLabel(caseEntry);
          changed = true;
        } else if (role.kind === "other" && v.length >= PROSE_MIN) {
          const s = scrubText(v);
          if (s !== v) {
            o[k] = s;
            changed = true;
          }
        }
      } else if (v && typeof v === "object") {
        changed = walk(v, keyKind(k) ?? objKind) || changed;
      }
    }
    return changed;
  };

  /** A long cell: a stored summary is walked, any other text scrubbed. */
  const scrubLong = (v: string): string => {
    if (!loose || !loose.test(v)) return v;
    const t = v.trimStart();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(v);
        return walk(parsed, ANY) ? JSON.stringify(parsed) : v;
      } catch {
        // Not JSON after all: scrub it as text.
      }
    }
    return scrubText(v);
  };

  const prepare = (sql: string, args: readonly unknown[] = []): PreparedStatement => {
    const s = scan(sql);
    const kind = statementKind(s, args);
    const real = new Set<WithheldEntry>();
    const neutral = new Set<WithheldEntry>();
    const outArgs = [...args];
    // Only a statement whose placeholders line up with its arguments is rewritten.
    const aligned = s.positions.length === args.length;
    const expansions: { i: number; values: string[] }[] = [];
    args.forEach((a, i) => {
      if (typeof a !== "string" || !a) return;
      const bind = aligned ? s.binds[i]! : { col: null, op: null, list: null };
      const role = bind.col ? roleOf(bind.col) : ({ kind: "generic", slugLike: true } as Role);
      if (role.kind === "case") return;
      const kinds = role.kind === "other" ? ANY : kindsFor(role, kind);
      if (!kinds) return;
      const lower = squash(a);
      for (const k of ["firm", "employer"] as const) {
        const ne = byNeutral.get(`${k}:${lower}`);
        if (!ne || !(KIND_BIT[k] & kinds)) continue;
        // A range or a pattern on a neutral slug is left alone: rewritten, its
        // other bound would still be the label's, and the range would be nonsense.
        if (!aligned || !(bind.op === "=" || bind.op === "==" || bind.op === "is" || bind.op === "in")) return;
        neutral.add(ne);
        if (bind.op === "in") expansions.push({ i, values: [...ne.slugs] });
        else outArgs[i] = ne.slug;
        return;
      }
      // A placeholder that names the real entity: the statement was asked by it.
      const text = bind.op === "like" || bind.op === "glob" ? a.replace(/^[%*]+|[%*]+$/g, "") : a;
      const hit = match(text, kinds, role.kind === "other");
      if (hit) real.add(hit.entry);
    });
    let outSql = sql;
    if (expansions.length) {
      // Each IN list holding a neutral slug is rebuilt once, every neutral slug in
      // it widened to its entity's real slugs and the list de-duplicated: a page
      // map hands the neutral page one neutral slug per spelling, and widening each
      // copy would multiply the list past SQLite's limit on placeholders.
      const blanked = blank(sql);
      const groups = new Map<number, number[]>();
      for (const { i } of expansions) {
        const list = s.binds[i]!.list!;
        if (!groups.has(list)) groups.set(list, s.binds.flatMap((b, j) => (b.list === list ? [j] : [])));
      }
      const widen = new Map(expansions.map((x) => [x.i, x.values]));
      // Right to left, so each offset still points at its own placeholders.
      for (const members of [...groups.values()].sort((a, b) => b[0]! - a[0]!)) {
        const first = members[0]!;
        const last = members[members.length - 1]!;
        const from = s.positions[first]!;
        const to = s.positions[last]! + 1;
        const contiguous = /^[?\s,]*$/.test(blanked.slice(from, to)) && last - first + 1 === members.length;
        if (!contiguous) {
          // A list with literals between its placeholders: widen each in place.
          for (const j of [...members].reverse()) {
            const values = widen.get(j);
            if (!values) continue;
            const pos = s.positions[j]!;
            outSql = outSql.slice(0, pos) + values.map(() => "?").join(", ") + outSql.slice(pos + 1);
            outArgs.splice(j, 1, ...values);
          }
          continue;
        }
        const values = [...new Set(members.flatMap((j) => widen.get(j) ?? [outArgs[j]]))];
        outSql = outSql.slice(0, from) + values.map(() => "?").join(", ") + outSql.slice(to);
        outArgs.splice(first, members.length, ...values);
      }
    }
    return { sql: outSql, args: outArgs, ctx: { kind, tables: s.tables, byReal: real, byNeutral: neutral } };
  };

  const maskIndexed = <T,>(rows: T[], ctx: StatementContext, opts: MaskOptions = {}): { rows: T[]; kept: number[] } => {
    if (!active) return { rows, kept: rows.map((_, i) => i) };
    const dropUnlessNeutral = [...ctx.tables].some((t) => DROP_UNLESS_NEUTRAL.has(t));
    const out: T[] = [];
    const kept: number[] = [];
    rows.forEach((row, idx) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        out.push(row);
        kept.push(idx);
        return;
      }
      const r = row as Record<string, unknown>;
      const rowKind = ownKind(r) ?? ctx.kind;
      const hits: { col: string; hit: Hit; slugLike: boolean }[] = [];
      let caseEntry: WithheldEntry | null = null;
      const longCols: string[] = [];
      for (const [col, v] of Object.entries(r)) {
        if (typeof v !== "string" || !v) continue;
        const role = roleOf(col);
        if (role.kind === "case") {
          caseEntry ??= byCase.get(v.trim().toUpperCase()) ?? null;
          continue;
        }
        const hit = match(v, kindsFor(role, rowKind), role.kind === "other");
        if (hit) hits.push({ col, hit, slugLike: role.slugLike });
        // Prose and stored summaries live in columns that aren't an entity's own:
        // an employer's long name that happens to contain a firm's is left alone.
        else if (role.kind === "other" && v.length >= PROSE_MIN) longCols.push(col);
      }
      const scrubbed = new Map<string, string>();
      for (const col of longCols) {
        const v = r[col] as string;
        const s = scrubLong(v);
        if (s !== v) scrubbed.set(col, s);
      }
      if (!hits.length && !caseEntry && !scrubbed.size) {
        out.push(row);
        kept.push(idx);
        return;
      }
      const named = new Set(hits.map((h) => h.hit.entry));
      if (caseEntry) named.add(caseEntry);
      if (named.size) {
        if (opts.drop) return;
        for (const e of named) if (ctx.byReal.has(e)) return;
        if (dropUnlessNeutral) for (const e of named) if (!ctx.byNeutral.has(e)) return;
      }
      const copy: Record<string, unknown> = { ...r };
      for (const { col, hit, slugLike } of hits) copy[col] = slugLike ? neutralSlug(hit.entry) : shownLabel(hit.entry);
      if (caseEntry) {
        // The case is the withheld employer's, whatever spelling this file printed.
        for (const [col, v] of Object.entries(r)) {
          if (typeof v !== "string" || hits.some((h) => h.col === col)) continue;
          const role = roleOf(col);
          if (role.kind === "employer" || (role.kind === "generic" && kindsFor(role, rowKind) & EMPLOYER)) {
            copy[col] = role.slugLike ? neutralSlug(caseEntry) : shownLabel(caseEntry);
          }
        }
      }
      for (const [col, s] of scrubbed) copy[col] = s;
      out.push(copy as T);
      kept.push(idx);
    });
    return { rows: out, kept };
  };

  const shownName = (name: string | null | undefined, caseNumber?: string): string | null => {
    const byNumber = caseNumber ? byCase.get(caseNumber.trim().toUpperCase()) : undefined;
    if (byNumber) return shownLabel(byNumber);
    if (name == null) return null;
    const hit = match(name, EMPLOYER);
    return hit ? shownLabel(hit.entry) : name;
  };

  const isWithheldQuery = (kind: WithheldKind | "any", text: string | null | undefined): boolean => {
    if (!active || !text) return false;
    const t = text.replace(/^[%*\s]+|[%*\s]+$/g, "");
    if (!t) return false;
    return match(t, kind === "any" ? ANY : KIND_BIT[kind]) !== null;
  };

  const neutralEntry = (kind: WithheldKind, slug: string | null | undefined): WithheldEntry | null =>
    slug ? byNeutral.get(`${kind}:${squash(slug)}`) ?? null : null;

  const neutralForPath = (path: string): WithheldEntry | null => {
    for (const k of ["firm", "employer"] as const) {
      const base = `${NEUTRAL_BASE[k]}/`;
      if (path.startsWith(base)) return neutralEntry(k, path.slice(base.length).split(/[/?#]/)[0]);
    }
    return null;
  };

  const withheldBySlug = (kind: WithheldKind, slug: string | null | undefined): WithheldEntry | null => {
    if (!slug) return null;
    return neutralEntry(kind, slug) ?? pick(bySlug.get(squash(slug)), KIND_BIT[kind]);
  };

  return {
    active,
    entries,
    prepare,
    mask: (rows, ctx, opts) => maskIndexed(rows, ctx, opts).rows,
    maskIndexed,
    shownName,
    isWithheldQuery,
    neutralEntry,
    neutralForPath,
    withheldBySlug,
    scrubText,
  };
}

let cached: { raw: string; masker: Masker } | null = null;

/** A masker for an environment, rebuilt only when either setting's text changes (Convex reads env per call). */
export function maskerForEnv(env: Readonly<Record<string, string | undefined>>): Masker {
  const raw = `${env[WITHHELD_ENV.employer] ?? ""}\u0000${env[WITHHELD_ENV.firm] ?? ""}`;
  if (cached && cached.raw === raw) return cached.masker;
  cached = { raw, masker: makeMasker(parseWithheldEnv(env)) };
  return cached.masker;
}

/** The withheld kind an entity page's kind maps to ("attorney" pages are firms), or null for occupations. */
export function withheldKindOf(entityKind: string): WithheldKind | null {
  if (entityKind === "attorney" || entityKind === "firm") return "firm";
  if (entityKind === "employer") return "employer";
  return null;
}
