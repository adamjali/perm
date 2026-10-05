/**
 * What a law firm may publish on its own page, and how a claim is checked.
 *
 * A firm claims its `/perm-attorneys/<slug>` page with an address at its own
 * domain (convex/firmClaims.ts). The words it adds are shown apart from DOL's
 * figures and marked as the firm's own. This module is the one set of rules
 * for both halves: the browser form checks with it before sending, and the
 * backend checks again with the same function, because a rule the server
 * doesn't enforce isn't a rule.
 *
 * Deliberately narrow, by the owner's standing calls: law firms only (no
 * attorney's name is ever published by this site), no phone numbers, no
 * affiliate links, and no links in the description. The one outbound link is
 * the firm's website, which must be on the domain the firm verified with,
 * unless the admin approves another.
 */

import { US_STATE_NAMES } from "./usStateNames";

export const FOCUS_OPTIONS = [
  { id: "perm", label: "PERM" },
  { id: "h1b", label: "H-1B" },
  { id: "eb1", label: "EB-1" },
  { id: "eb2niw", label: "EB-2 NIW" },
  { id: "eb3", label: "EB-3" },
  { id: "l1", label: "L-1" },
  { id: "o1", label: "O-1" },
  { id: "family", label: "Family" },
  { id: "consular", label: "Consular processing" },
  { id: "other", label: "Other" },
] as const;

export type FocusId = (typeof FOCUS_OPTIONS)[number]["id"];

export const DESCRIPTION_MAX = 600;
export const WEBSITE_MAX = 200;
export const ROLE_MAX = 120;
export const LANGUAGES_MAX = 12;
export const LANGUAGE_MAX = 40;
export const OFFICES_MAX = 10;
export const CITY_MAX = 60;

export interface FirmOffice {
  city: string;
  state: string;
}

export interface FirmProfile {
  website?: string;
  description?: string;
  languages: string[];
  offices: FirmOffice[];
  focus: FocusId[];
}

export type ProfileField = "website" | "description" | "languages" | "offices" | "focus";

export type ProfileCheck =
  | { ok: true; profile: FirmProfile }
  | { ok: false; errors: Partial<Record<ProfileField, string>> };

/** The raw shape a form or a request body carries. Every field may be junk. */
export interface ProfileInput {
  website?: unknown;
  description?: unknown;
  languages?: unknown;
  offices?: unknown;
  focus?: unknown;
}

const FOCUS_IDS = new Set<string>(FOCUS_OPTIONS.map((f) => f.id));
const LANGUAGE_RE = /^[\p{L}][\p{L} ()'-]*$/u;
const CITY_RE = /^[\p{L}][\p{L}0-9 .'-]*$/u;

/** A link, a bare domain, an address or markup: none belongs in the description. */
const LINKISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|law|legal|us|io|co|info|biz)\b|@|<|>)/i;
/**
 * Seven or more digits in one run, however they're spaced or punctuated
 * (spaces, parentheses, dots, hyphens), reads as a phone number. A scan, not a
 * nested-quantifier pattern, so no input can make it backtrack.
 */
function looksLikePhone(text: string): boolean {
  let digits = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      digits += 1;
      if (digits >= 7) return true;
    } else if (!" \t().-".includes(ch)) {
      digits = 0;
    }
  }
  return false;
}

function text(v: unknown, max: number): string {
  // The cap comes BEFORE any pattern runs (a long string through a regex is
  // the cheap way to make a server busy), and collapses runs of spaces while
  // keeping up to one blank line between paragraphs.
  if (typeof v !== "string") return "";
  return v
    .slice(0, max * 2)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function list(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max + 1) : [];
}

/** The website as stored: https, no credentials, no port, at most WEBSITE_MAX characters. */
export function normalizeWebsite(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > WEBSITE_MAX) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
  url.hash = "";
  const out = url.toString();
  return out.length <= WEBSITE_MAX ? out : null;
}

/** "www.firm.com" -> "firm.com". */
export function bareHost(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h.startsWith("www.") ? h.slice(4) : h;
}

/**
 * Whether a website is on the domain the firm verified with: the same host, or
 * one of its subdomains, either way round (immigration.firm.com for an address
 * at firm.com, or firm.com for an address at us.firm.com).
 */
export function websiteMatchesDomain(website: string, domain: string): boolean {
  let host: string;
  try {
    host = bareHost(new URL(website).hostname);
  } catch {
    return false;
  }
  const d = bareHost(domain);
  return host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`);
}

/** Check and normalise everything a firm submits. */
export function checkProfile(input: ProfileInput): ProfileCheck {
  const errors: Partial<Record<ProfileField, string>> = {};
  const profile: FirmProfile = { languages: [], offices: [], focus: [] };

  if (typeof input.website === "string" && input.website.trim()) {
    const site = normalizeWebsite(input.website);
    if (site) profile.website = site;
    else errors.website = "Use the firm's full https:// address, like https://www.yourfirm.com.";
  }

  const description = text(input.description, DESCRIPTION_MAX);
  if (description) {
    if (description.length > DESCRIPTION_MAX) {
      errors.description = `Keep it to ${DESCRIPTION_MAX} characters.`;
    } else if (LINKISH.test(description)) {
      errors.description = "Leave links, web addresses and email addresses out of the description.";
    } else if (looksLikePhone(description)) {
      errors.description = "Leave phone numbers out. Your website can carry them.";
    } else {
      profile.description = description;
    }
  }

  const languages = list(input.languages, LANGUAGES_MAX);
  if (languages.length > LANGUAGES_MAX) errors.languages = `List up to ${LANGUAGES_MAX} languages.`;
  else {
    const seen = new Set<string>();
    for (const raw of languages) {
      const lang = text(raw, LANGUAGE_MAX);
      if (!lang) continue;
      if (lang.length > LANGUAGE_MAX || !LANGUAGE_RE.test(lang)) {
        errors.languages = "Write each language as a word, like Spanish or Mandarin.";
        break;
      }
      const key = lang.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        profile.languages.push(lang);
      }
    }
  }

  const offices = list(input.offices, OFFICES_MAX);
  if (offices.length > OFFICES_MAX) errors.offices = `List up to ${OFFICES_MAX} offices.`;
  else {
    const seen = new Set<string>();
    for (const raw of offices) {
      const o = (typeof raw === "object" && raw !== null ? raw : {}) as { city?: unknown; state?: unknown };
      const city = text(o.city, CITY_MAX);
      const state = typeof o.state === "string" ? o.state.trim().toUpperCase() : "";
      if (!city && !state) continue;
      if (!city || city.length > CITY_MAX || !CITY_RE.test(city) || !(state in US_STATE_NAMES)) {
        errors.offices = "Give each office a city and a US state.";
        break;
      }
      const key = `${city.toLowerCase()}|${state}`;
      if (!seen.has(key)) {
        seen.add(key);
        profile.offices.push({ city, state });
      }
    }
  }

  for (const raw of list(input.focus, FOCUS_OPTIONS.length)) {
    if (typeof raw === "string" && FOCUS_IDS.has(raw) && !profile.focus.includes(raw as FocusId)) {
      profile.focus.push(raw as FocusId);
    }
  }
  // Fixed order, whatever order the boxes were ticked in.
  profile.focus.sort((a, b) => FOCUS_OPTIONS.findIndex((f) => f.id === a) - FOCUS_OPTIONS.findIndex((f) => f.id === b));

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, profile };
}

/** Whether a profile has anything to show. */
export function hasContent(p: FirmProfile): boolean {
  return Boolean(p.website || p.description || p.languages.length || p.offices.length || p.focus.length);
}

export function focusLabel(id: string): string {
  return FOCUS_OPTIONS.find((f) => f.id === id)?.label ?? id;
}

// ============================================================================
// The claim check
// ============================================================================

/**
 * Mail anyone can hold. MUST match PERSONAL_DOMAINS and PERSONAL_FIRST_LABELS
 * in scripts/build_firm_domains.py, which builds the table this check reads;
 * firmProfile.test.ts reads that file and holds the two together.
 */
export const PERSONAL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "ymail.com", "rocketmail.com", "aol.com", "aim.com",
  "icloud.com", "me.com", "mac.com", "msn.com", "proton.me", "pm.me", "protonmail.com",
  "protonmail.ch", "gmx.com", "gmx.net", "gmx.de", "mail.com", "usa.com", "lawyer.com",
  "zoho.com", "zohomail.com", "yandex.com", "yandex.ru", "qq.com", "163.com", "126.com",
  "sina.com", "rediffmail.com", "fastmail.com", "hey.com", "tutanota.com", "tuta.io",
  "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net", "charter.net",
  "earthlink.net", "bellsouth.net", "optonline.net", "frontier.com", "windstream.net",
  "centurylink.net", "juno.com", "netzero.net", "roadrunner.com", "rr.com", "spectrum.net",
  "example.com", "example.org", "test.com", "none.com", "na.com",
]);
export const PERSONAL_FIRST_LABELS: ReadonlySet<string> = new Set([
  "gmail", "yahoo", "hotmail", "outlook", "live", "msn", "aol", "icloud", "protonmail",
  "proton", "gmx", "yandex", "rediffmail", "zoho",
]);
/** A domain DOL prints beside more firms than this is a shared service. Same as the builder's. */
export const SHARED_LIMIT = 3;

export function isPersonalDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return PERSONAL_DOMAINS.has(d) || PERSONAL_FIRST_LABELS.has(d.split(".", 1)[0] ?? "");
}

/** The domain of a plausible address, lowercased; null otherwise. */
export function emailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e.length > 254) return null;
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const d = e.slice(at + 1);
  // Label by label, so no pattern repeats over the whole domain.
  const labels = d.split(".");
  if (labels.length < 2) return null;
  const ok = (l: string) => l.length >= 1 && l.length <= 63 && /^[a-z0-9-]+$/.test(l) && !l.startsWith("-") && !l.endsWith("-");
  return labels.every(ok) ? d : null;
}

/** One row of `firm_email_domains` for the claimant's domain. */
export interface DomainRow {
  page_slug: string;
  program: string;
  filings: number;
  firm_filings: number;
}

export type ClaimVerdict =
  | { verified: true; filings: number }
  | { verified: false; reason: "personal" | "shared" | "not_listed" | "too_few"; filings: number };

/**
 * Whether DOL's own files tie the claimant's domain to this firm.
 *
 * Tied when DOL prints the domain beside the firm on at least two filings, or
 * on every filing of the firm's that carries an address (a small firm with
 * one emailed filing). Never for personal mail, and never for a domain DOL
 * prints beside more than SHARED_LIMIT firms. Anything else is a manual
 * review, not a refusal.
 */
export function claimVerdict(domain: string, slug: string, rows: readonly DomainRow[]): ClaimVerdict {
  const mine = rows.filter((r) => r.page_slug === slug);
  const filings = mine.reduce((n, r) => n + Number(r.filings || 0), 0);
  if (isPersonalDomain(domain)) return { verified: false, reason: "personal", filings };
  const pages = new Set(rows.map((r) => r.page_slug));
  if (pages.size > SHARED_LIMIT) return { verified: false, reason: "shared", filings };
  if (filings === 0) return { verified: false, reason: "not_listed", filings };
  const firmFilings = mine.reduce((n, r) => n + Number(r.firm_filings || 0), 0);
  if (filings >= 2 || filings === firmFilings) return { verified: true, filings };
  return { verified: false, reason: "too_few", filings };
}

// ============================================================================
// The edit page's plain HTML form
// ============================================================================

/**
 * A profile from the edit page's form fields. Languages are one comma-separated
 * line and offices one "City, ST" per line, because the page is plain HTML
 * with no script. Lengths are capped here, before `checkProfile` runs.
 */
export function profileFromForm(get: (name: string) => string | null, getAll: (name: string) => string[]): ProfileInput {
  const languages = (get("languages") ?? "")
    .slice(0, LANGUAGES_MAX * (LANGUAGE_MAX + 2))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const offices = (get("offices") ?? "")
    .slice(0, OFFICES_MAX * (CITY_MAX + 8))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.lastIndexOf(",");
      return at < 0 ? { city: line, state: "" } : { city: line.slice(0, at).trim(), state: line.slice(at + 1).trim() };
    });
  return {
    website: (get("website") ?? "").slice(0, WEBSITE_MAX * 2),
    description: (get("description") ?? "").slice(0, DESCRIPTION_MAX * 2),
    languages,
    offices,
    focus: getAll("focus").slice(0, FOCUS_OPTIONS.length),
  };
}
