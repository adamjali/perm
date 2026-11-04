import list from "../../../scripts/data/embassy_feeds.json";

/**
 * The embassies whose own visa notices this site reads (`scripts/data/embassy_feeds.json`, read in the owner's
 * Chrome by `scripts/ingest_embassy_notices.py`), each with the consulates it speaks for, keyed as the consulate
 * pages are (the issuance tables' group_key). A notice is stored as `embassy-<code>-<slug>`.
 */
export interface Embassy {
  code: string;
  host: string;
  name: string;
  posts: string[];
}

export const EMBASSIES: readonly Embassy[] = list.embassies.map((e) => ({
  code: e.code,
  host: e.host,
  name: e.name,
  posts: e.posts,
}));

/** The embassy that speaks for a consulate, or null when this site reads none for it. */
export function embassyForPost(postKey: string): Embassy | null {
  const key = postKey.trim().toLowerCase();
  return EMBASSIES.find((e) => e.posts.includes(key)) ?? null;
}

/** The embassy's own list of its visa posts: the category whose feed is read, so it exists wherever a feed does. */
export function embassyVisasUrl(e: Embassy): string {
  return `https://${e.host}${list.path.replace(/feed\/?$/, "")}`;
}

/** The range of stored document numbers that hold one embassy's notices: `embassy-<code>-` up to, not including, `embassy-<code>.`. */
export function noticeRange(e: Embassy): [string, string] {
  return [`embassy-${e.code}-`, `embassy-${e.code}.`];
}

/**
 * An excerpt shortened for a list: whole sentences up to about 260 characters, or the words that fit, with an
 * ellipsis. The full post is one click away on the embassy's own site.
 */
export function shortExcerpt(text: string, max = 260): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // Sentence ends: a period, question or exclamation mark followed by a space and a capital or a digit.
  let end = 0;
  for (const m of t.matchAll(/[.!?](?=\s+[A-Z0-9])/g)) {
    const at = (m.index ?? 0) + 1;
    if (at > max) break;
    // "U.S." and other single-letter abbreviations aren't a sentence's end.
    if (/(^|[\s.])[A-Z]\.$/.test(t.slice(Math.max(0, at - 3), at))) continue;
    end = at;
  }
  if (end >= 80) return t.slice(0, end);
  const head = t.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;:]+$/, "");
  return `${head}...`;
}
