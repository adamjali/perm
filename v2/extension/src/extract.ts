/**
 * Who's hiring, read off a job posting.
 *
 * FIRST the page's own structured data: a schema.org JobPosting's
 * `hiringOrganization`, which Greenhouse, Lever, Ashby, Workday, Wellfound and
 * most applicant-tracking pages publish for search engines. It's the site's
 * own statement of the employer, so it wins wherever it exists.
 *
 * THEN, on the listed job sites only, a few selectors per site, kept in the
 * one table below. They will break when a site redesigns. Each has a fixture
 * in __tests__/fixtures; when a site changes, update its fixture first.
 *
 * Nothing here reads anything but the employer's name.
 */

export type SiteId = "linkedin" | "indeed" | "glassdoor" | "handshake" | "wellfound";

export interface SiteRule {
  id: SiteId;
  label: string;
  /** Chrome match patterns: the content script runs here, and the manifest's host permissions are these. */
  matches: string[];
  /** Hosts, for reading a URL without a match-pattern parser. A leading "." means any subdomain. */
  hosts: string[];
  /** A job posting on this site. Off it, the selectors aren't read. */
  jobPage: RegExp;
  /** Tried in order; the first that yields a usable name wins. */
  selectors: string[];
}

export const SITES: SiteRule[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    // All of LinkedIn, because it opens a posting from the feed without a page
    // load, which a script limited to /jobs/ would never see. `jobPage` keeps
    // it from reading anything but a posting.
    matches: ["https://www.linkedin.com/*"],
    hosts: ["www.linkedin.com"],
    jobPage: /^\/jobs\//,
    selectors: [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      "a.topcard__org-name-link",
      ".topcard__org-name-link",
    ],
  },
  {
    id: "indeed",
    label: "Indeed",
    matches: ["https://*.indeed.com/*"],
    hosts: [".indeed.com"],
    jobPage: /^\/(viewjob|jobs|q-|cmp\/[^/]+\/jobs|m\/viewjob)/,
    selectors: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-CompanyInfoContainer a"],
  },
  {
    id: "glassdoor",
    label: "Glassdoor",
    matches: ["https://www.glassdoor.com/*"],
    hosts: ["www.glassdoor.com"],
    jobPage: /^\/(job-listing|Job)\//,
    selectors: ['[class*="EmployerProfile_employerNameHeading"]', '[data-test="employer-name"]', '[data-test="employerName"]'],
  },
  {
    id: "handshake",
    label: "Handshake",
    matches: ["https://*.joinhandshake.com/*"],
    hosts: [".joinhandshake.com"],
    jobPage: /\/(jobs|job-search)\b/,
    selectors: ['[data-hook="employer-profile-link"]', 'a[href*="/employers/"]'],
  },
  {
    id: "wellfound",
    label: "Wellfound",
    matches: ["https://wellfound.com/*"],
    hosts: ["wellfound.com"],
    jobPage: /^\/(jobs|company\/[^/]+\/jobs)/,
    selectors: ['a[href^="/company/"] h2', 'a[href^="/company/"]'],
  },
];

export function siteFor(url: URL): SiteRule | null {
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  return (
    SITES.find((s) => s.hosts.some((h) => (h.startsWith(".") ? host.endsWith(h) || host === h.slice(1) : host === h))) ?? null
  );
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A printed name, tidied; null when it can't be an employer's name. */
export function cleanName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length > 600) return null;
  let s = raw
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
      if (body[0] === "#") {
        const n = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[body.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
  // "Acme Corp · 3 days ago": the name is the part before the separator.
  s = s.split(/\s[·•|]\s/)[0]!.trim();
  // An image's alt text ("Deloitte Logo") sometimes stands in for the name.
  s = s.replace(/\s+logo$/i, "").trim();
  return s.length >= 2 && s.length <= 120 ? s : null;
}

function isJobPosting(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  return t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
}

function hiringName(node: Record<string, unknown>): string | null {
  const org = node.hiringOrganization;
  if (typeof org === "string") return cleanName(org);
  if (org && typeof org === "object" && !Array.isArray(org)) {
    return cleanName((org as Record<string, unknown>).name as string | undefined);
  }
  if (Array.isArray(org) && org[0]) return hiringName({ hiringOrganization: org[0] });
  return null;
}

/** The first JobPosting's employer in the page's JSON-LD, or null. */
export function employerFromJsonLd(doc: Document): string | null {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const text = script.textContent ?? "";
    if (text.length > 500_000) continue;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    for (let seen = 0; queue.length > 0 && seen < 500; seen++) {
      const node = queue.shift();
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      if (isJobPosting(obj)) {
        const name = hiringName(obj);
        if (name) return name;
      }
      if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
    }
  }
  return null;
}

export interface Extracted {
  name: string;
  source: "json-ld" | SiteId;
}

/** The employer of the posting on this page, or null when there isn't one to read. */
export function extractEmployer(doc: Document, url: URL): Extracted | null {
  const fromData = employerFromJsonLd(doc);
  if (fromData) return { name: fromData, source: "json-ld" };
  const site = siteFor(url);
  if (!site || !site.jobPage.test(url.pathname)) return null;
  for (const selector of site.selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector))) {
      const name = cleanName(el.textContent);
      if (name) return { name, source: site.id };
    }
  }
  return null;
}
