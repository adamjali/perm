import "server-only";

import { rows } from "./client";

/**
 * How many comments each open proposed rule has on regulations.gov, as
 * `scripts/ingest_regulations_gov.py` stores them (`policy_comment_counts`,
 * keyed by the Federal Register document number).
 *
 * The count is of comments POSTED: an agency posts a comment after it screens
 * it, so the number trails what people sent. `countedBy` says whose number it
 * is: regulations.gov's own, or the Federal Register's copy of it, which fills
 * a rule only until regulations.gov answers.
 */
export interface CommentCount {
  documentNumber: string;
  comments: number;
  countedBy: "regulations.gov" | "federalregister.gov";
  /** When the count last changed, epoch milliseconds. */
  changedAt: number | null;
  /** The docket's posted-comments page. */
  docketUrl: string | null;
  /** The comment form. */
  commentUrl: string | null;
  /** The Eastern day comments close. */
  commentEnd: string | null;
}

interface DbRow {
  document_number: string;
  comments: number | string | null;
  counted_by: string | null;
  counted_at: number | string | null;
  url: string | null;
  comment_url: string | null;
  comment_end: string | null;
}

const toNumber = (v: number | string | null): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Every stored count, by document number. A table that doesn't exist yet
 * (the reader has never run) is no counts; any other failed read throws, so
 * the page keeps its last good render instead of dropping every count.
 */
export async function getCommentCounts(): Promise<Map<string, CommentCount>> {
  let r: DbRow[];
  try {
    r = await rows<DbRow>(
      "SELECT document_number, comments, counted_by, counted_at, url, comment_url, comment_end " +
        "FROM policy_comment_counts",
    );
  } catch (e) {
    if (/no such table/i.test(e instanceof Error ? e.message : String(e))) return new Map();
    throw e;
  }
  const out = new Map<string, CommentCount>();
  for (const x of r) {
    const comments = toNumber(x.comments);
    if (comments === null || comments < 0) continue;
    const by = x.counted_by === "federalregister.gov" ? "federalregister.gov" : x.counted_by === "regulations.gov" ? "regulations.gov" : null;
    if (!by) continue;
    out.set(x.document_number, {
      documentNumber: x.document_number,
      comments,
      countedBy: by,
      changedAt: toNumber(x.counted_at),
      docketUrl: x.url ?? null,
      commentUrl: x.comment_url ?? null,
      commentEnd: x.comment_end ?? null,
    });
  }
  return out;
}
