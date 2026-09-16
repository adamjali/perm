import "server-only";

import { rows } from "./client";

/**
 * Federal Register documents that touch the PERM, H-1B and green-card
 * process, as `ingest_policy_notices.py` selected them. Nothing here is
 * written by the site: the title, type, agencies and abstract are the
 * Register's own, and the topics are the search terms a document matched.
 */

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
}

function parseList(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Newest first, over the indexed date column; `LIMIT`-capped.
 *
 * The default reads the whole table (627 rows on 2026-09-16) because the page
 * partitions it in memory: OFLC announcements on this site's programs are
 * listed and the H-2A/H-2B ones are counted, and a SQL-side split would put
 * the topic vocabulary in two places. ~630 rows six times a day is nothing
 * against a corpus that reads 143k rows per entity page.
 */
export async function listPolicyNotices(limit = 1000): Promise<PolicyNotice[]> {
  const r = await rows<DbRow>(
    "SELECT document_number, publication_date, type, title, abstract, html_url, agencies, topics, " +
      "effective_on, comments_close_on, comment_url, citation, action, dates, correction_of, pdf_url " +
      "FROM policy_notices ORDER BY publication_date DESC, document_number DESC LIMIT ?",
    [Math.min(Math.max(1, limit), 2000)],
  ).catch(() => [] as DbRow[]);
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
  }));
}
