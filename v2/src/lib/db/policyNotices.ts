import "server-only";

import { rows } from "./client";

/**
 * The policy feed, every source in one table (`scripts/lib_policy_feed.py`):
 * Federal Register documents (published, filed for public inspection, or
 * withdrawn before publication), the White House's presidential actions,
 * and announcements from OFLC, USCIS (its newsroom and Policy Manual) and
 * DOL's newsroom. Nothing here is written by the site: titles, types,
 * agencies and abstracts are the agencies' own, and the topics are the words
 * a document matched.
 */

/** Where a row came from, as the writer stores it. */
export type PolicySource =
  | "federal-register"
  | "public-inspection"
  | "white-house"
  | "oflc"
  | "uscis-news"
  | "uscis-policy-manual"
  | "dol-news"
  | "state-news"
  | "congress"
  | "courtlistener"
  | "balca";

export interface PolicyNotice {
  documentNumber: string;
  publicationDate: string;
  type: string;
  title: string;
  abstract: string | null;
  url: string;
  agencies: string[];
  topics: string[];
  /** The Register's own dates, null when the document states none. */
  effectiveOn: string | null;
  commentsCloseOn: string | null;
  commentUrl: string | null;
  /** "91 FR 57807": volume and first page. */
  citation: string | null;
  /** The ACTION line, e.g. "Final rule." or "Notice of proposed rulemaking." */
  action: string | null;
  /** The DATES paragraph verbatim, for documents whose effective date is stated in words. */
  dates: string | null;
  /** The document this one corrects, by number. The page folds it into that entry. */
  correctionOf: string | null;
  pdfUrl: string | null;
  source: PolicySource | null;
  /** A Register document's stage. Null for a source with no stages. */
  status: "public-inspection" | "published" | "withdrawn" | null;
  /** The Eastern day the Register filed it for public inspection. */
  piFiled: string | null;
  /** A presidential document's signing day. */
  signingDate: string | null;
  /** A White House action's Register document, once published. */
  supersededBy: string | null;
}

interface DbRow {
  document_number: string;
  publication_date: string;
  type: string;
  title: string;
  abstract: string | null;
  html_url: string;
  agencies: string;
  topics: string;
  effective_on: string | null;
  comments_close_on: string | null;
  comment_url: string | null;
  citation: string | null;
  action: string | null;
  dates: string | null;
  correction_of: string | null;
  pdf_url: string | null;
  source: string | null;
  status: string | null;
  pi_filed: string | null;
  signing_date: string | null;
  superseded_by: string | null;
}

const SOURCES: readonly PolicySource[] = [
  "federal-register", "public-inspection", "white-house", "oflc", "uscis-news", "uscis-policy-manual", "dol-news",
  "state-news", "congress", "courtlistener", "balca",
];
const STATUSES = ["public-inspection", "published", "withdrawn"] as const;

function parseList(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Newest first, over the indexed date column; `LIMIT`-capped. A failed read
 * throws, so the page keeps its last good render: an empty feed would read as
 * "no policy changes", which is never true.
 *
 * The default reads the whole table (under a thousand rows) because the page
 * partitions it in memory by source and stage (`lib/policyFeed`), and a
 * SQL-side split would put those rules in two places. A few hundred rows a
 * few times a day costs nothing.
 */
export async function listPolicyNotices(limit = 3000): Promise<PolicyNotice[]> {
  const r = await rows<DbRow>(
    "SELECT document_number, publication_date, type, title, abstract, html_url, agencies, topics, " +
      "effective_on, comments_close_on, comment_url, citation, action, dates, correction_of, pdf_url, " +
      "source, status, pi_filed, signing_date, superseded_by " +
      "FROM policy_notices ORDER BY publication_date DESC, document_number DESC LIMIT ?",
    [Math.min(Math.max(1, limit), 3000)],
  );
  return r.map((x) => ({
    documentNumber: x.document_number,
    publicationDate: x.publication_date,
    type: x.type,
    title: x.title,
    abstract: x.abstract,
    url: x.html_url,
    agencies: parseList(x.agencies),
    topics: parseList(x.topics),
    effectiveOn: x.effective_on ?? null,
    commentsCloseOn: x.comments_close_on ?? null,
    commentUrl: x.comment_url ?? null,
    citation: x.citation ?? null,
    action: x.action ?? null,
    dates: x.dates ?? null,
    correctionOf: x.correction_of ?? null,
    pdfUrl: x.pdf_url ?? null,
    source: (SOURCES as readonly string[]).includes(x.source ?? "") ? (x.source as PolicySource) : null,
    status: (STATUSES as readonly string[]).includes(x.status ?? "") ? (x.status as PolicyNotice["status"]) : null,
    piFiled: x.pi_filed ?? null,
    signingDate: x.signing_date ?? null,
    supersededBy: x.superseded_by ?? null,
  }));
}
