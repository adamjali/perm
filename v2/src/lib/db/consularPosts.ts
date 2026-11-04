import "server-only";

import { cache } from "react";

import { embassyForPost, noticeRange, type Embassy } from "@/lib/consular/embassies";
import { IV_CATEGORIES, postName, postSlug, type IvCategory, type IvCell } from "@/lib/consular/scheduling";
import { shiftMonth } from "@convex/lib/months";

import { rows } from "./client";
import { EMPLOYMENT_CATEGORIES, issuanceSummary } from "./visaIssuances";

/**
 * Every consulate that issues immigrant visas: State's IV Scheduling Status Tool
 * (`iv_scheduling`, scripts/ingest_iv_scheduling.py) beside the visas the post issued
 * (`visa_issuances`, dim "post"). Both key a post the same way (the issuance tables' group_key).
 *
 * A failed read throws, so a page keeps its last good render; only a missing table reads as empty.
 */

const missing = (e: unknown) => /no such table/i.test(String(e));

export interface PostSummary {
  key: string;
  slug: string;
  name: string;
  /** The newest reading's three months; null for a post the tool doesn't list. */
  now: Record<IvCategory, IvCell> | null;
  /** Immigrant visas the post issued in the newest 12 published months, all classes and employment. */
  issued: number;
  employment: number;
}

export interface ConsularIndex {
  /** State's newest update day, ISO. */
  asOf: string | null;
  /** Every update held, oldest first. */
  readings: string[];
  posts: PostSummary[];
  /** The newest 12 published months of issuances, YYYY-MM. */
  issuedFrom: string | null;
  issuedTo: string | null;
}

/** How many State updates the history holds, oldest first. */
async function readingDays(): Promise<string[]> {
  try {
    const got = await rows<{ as_of: string }>("SELECT DISTINCT as_of FROM iv_scheduling ORDER BY as_of");
    return got.map((r) => r.as_of);
  } catch (e) {
    if (missing(e)) return [];
    throw e;
  }
}

function cellsOf(list: { category: string; printed: string; month: string | null }[]): Record<IvCategory, IvCell> {
  const out = {} as Record<IvCategory, IvCell>;
  for (const c of IV_CATEGORIES) {
    const r = list.find((x) => x.category === c);
    out[c] = { printed: r?.printed ?? "", month: r?.month ?? null };
  }
  return out;
}

export const getConsularIndex = cache(async (): Promise<ConsularIndex> => {
  const [readings, summary] = await Promise.all([readingDays(), issuanceSummary()]);
  const asOf = readings[readings.length - 1] ?? null;
  const issuedTo = summary?.newest ?? null;
  const issuedFrom = issuedTo ? shiftMonth(issuedTo, -11) : null;

  const [tool, issued] = await Promise.all([
    asOf
      ? rows<{ post_key: string; post: string; category: string; printed: string; month: string | null }>(
          "SELECT post_key, post, category, printed, month FROM iv_scheduling WHERE as_of = ?",
          [asOf],
        )
      : Promise.resolve([]),
    issuedTo && issuedFrom
      ? rows<{ group_key: string; label: string; newest: string; n: unknown; eb: unknown }>(
          // SQLite's bare-column rule: with one max() the label comes from the newest month's row.
          `SELECT group_key, key AS label, max(month) AS newest, sum(n) AS n,
             sum(CASE WHEN category IN (${EMPLOYMENT_CATEGORIES.map(() => "?").join(",")}) THEN n ELSE 0 END) AS eb
           FROM visa_issuances WHERE dim = 'post' AND month >= ? AND month <= ? GROUP BY group_key`,
          [...EMPLOYMENT_CATEGORIES, issuedFrom, issuedTo],
        )
      : Promise.resolve([]),
  ]);

  const byKey = new Map<string, { tool: typeof tool; toolName: string | null; label: string | null; issued: number; eb: number }>();
  const entry = (k: string) => {
    let e = byKey.get(k);
    if (!e) {
      e = { tool: [], toolName: null, label: null, issued: 0, eb: 0 };
      byKey.set(k, e);
    }
    return e;
  };
  for (const r of tool) {
    const e = entry(r.post_key);
    e.tool.push(r);
    e.toolName = r.post;
  }
  for (const r of issued) {
    const e = entry(r.group_key);
    e.label = r.label;
    e.issued = Number(r.n);
    e.eb = Number(r.eb);
  }
  const posts: PostSummary[] = [...byKey.entries()]
    // A post the tool doesn't list and that issued nothing in the year has nothing to show.
    .filter(([, e]) => e.tool.length || e.issued > 0)
    .map(([key, e]) => {
      const name = postName(key, e.label, e.toolName);
      return { key, slug: postSlug(name), name, now: e.tool.length ? cellsOf(e.tool) : null, issued: e.issued, employment: e.eb };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { asOf, readings, posts, issuedFrom, issuedTo };
});

export interface PostReading {
  asOf: string;
  cells: Record<IvCategory, IvCell>;
}

export interface PostDetail extends PostSummary {
  /** Every State update held for the post, oldest first. */
  history: PostReading[];
  /** Visas issued at the post each month by category, oldest first. */
  months: { month: string; byCategory: Record<string, number> }[];
}

/** How many published months a post page draws. */
const POST_MONTHS = 36;

export async function getPostDetail(slug: string): Promise<PostDetail | null> {
  const index = await getConsularIndex();
  const post = index.posts.find((p) => p.slug === slug);
  if (!post) return null;
  const from = index.issuedTo ? shiftMonth(index.issuedTo, -(POST_MONTHS - 1)) : null;
  const [hist, issued] = await Promise.all([
    rows<{ as_of: string; category: string; printed: string; month: string | null }>(
      "SELECT as_of, category, printed, month FROM iv_scheduling WHERE post_key = ? ORDER BY as_of",
      [post.key],
    ).catch((e) => {
      if (missing(e)) return [];
      throw e;
    }),
    from
      ? rows<{ month: string; category: string; n: unknown }>(
          "SELECT month, category, sum(n) AS n FROM visa_issuances WHERE dim = 'post' AND group_key = ? AND month >= ? GROUP BY month, category ORDER BY month",
          [post.key, from],
        )
      : Promise.resolve([]),
  ]);
  const byDay = new Map<string, typeof hist>();
  for (const r of hist) byDay.set(r.as_of, [...(byDay.get(r.as_of) ?? []), r]);
  const history = [...byDay.entries()].map(([asOf, list]) => ({ asOf, cells: cellsOf(list) }));
  const byMonth = new Map<string, Record<string, number>>();
  for (const r of issued) {
    const m = byMonth.get(r.month) ?? {};
    m[r.category] = (m[r.category] ?? 0) + Number(r.n);
    byMonth.set(r.month, m);
  }
  const months = [...byMonth.entries()].map(([month, byCategory]) => ({ month, byCategory }));
  return { ...post, history, months };
}

export interface EmbassyNotice {
  title: string;
  url: string;
  /** The embassy's own day for the post (its time zone). */
  day: string;
  excerpt: string | null;
}

export interface EmbassyNotices {
  embassy: Embassy;
  /** The newest notices kept from the embassy's Visas feed, newest first. */
  notices: EmbassyNotice[];
}

/** How many of an embassy's notices a consulate page lists. */
const NOTICES_SHOWN = 5;

/**
 * The newest visa notices from the embassy that speaks for a consulate (`scripts/ingest_embassy_notices.py`, type
 * "Embassy notice"), read by the primary key's range. Null for a post with no embassy feed read; an empty list
 * before the first load or when the embassy posted nothing kept in the year.
 */
export async function getEmbassyNotices(postKey: string): Promise<EmbassyNotices | null> {
  const embassy = embassyForPost(postKey);
  if (!embassy) return null;
  const [lo, hi] = noticeRange(embassy);
  const list = await rows<{ title: string; html_url: string; publication_date: string; abstract: string | null }>(
    "SELECT title, html_url, publication_date, abstract FROM policy_notices " +
      "WHERE document_number >= ? AND document_number < ? AND type = 'Embassy notice' " +
      "ORDER BY publication_date DESC, document_number DESC LIMIT ?",
    [lo, hi, NOTICES_SHOWN],
  ).catch((e) => {
    if (missing(e)) return [];
    throw e;
  });
  return {
    embassy,
    notices: list.map((r) => ({ title: r.title, url: r.html_url, day: r.publication_date, excerpt: r.abstract?.trim() || null })),
  };
}
