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
