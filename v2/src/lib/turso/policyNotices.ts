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
}

function parseList(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Newest first, over the indexed date column; `LIMIT`-capped. */
export async function listPolicyNotices(limit = 200): Promise<PolicyNotice[]> {
  const r = await rows<DbRow>(
    "SELECT document_number, publication_date, type, title, abstract, html_url, agencies, topics " +
      "FROM policy_notices ORDER BY publication_date DESC, document_number DESC LIMIT ?",
    [Math.min(Math.max(1, limit), 500)],
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
  }));
}
