/**
 * How the article listings (guides, blog, changelog) sort and filter, beside their search box (owner, Nov 2
 * 2026: "content ... all should have filter and sort next to search"). Both live in the address (?sort=,
 * ?for=), so a sorted or filtered list can be linked. Plain module: the listings and their tests read it.
 */

import type { PostSummary } from "./types";

export const SORTS = [
  { id: "topic", label: "By topic", phrase: "by topic" },
  { id: "newest", label: "Newest first", phrase: "newest first" },
  { id: "updated", label: "Recently updated", phrase: "recently updated first" },
  { id: "oldest", label: "Oldest first", phrase: "oldest first" },
  { id: "title", label: "A to Z", phrase: "A to Z" },
  { id: "shortest", label: "Shortest read", phrase: "shortest read first" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export const AUDIENCES = [
  { id: "", label: "Everyone" },
  { id: "waiting", label: "Waiting on a case" },
  { id: "practice", label: "Attorneys and HR" },
] as const;
export type AudienceId = (typeof AUDIENCES)[number]["id"];

/** A sort named in the address, or the listing's own default. */
export function sortOf(raw: string, fallback: SortId): SortId {
  return SORTS.some((s) => s.id === raw) ? (raw as SortId) : fallback;
}

export function audienceOf(raw: string): AudienceId {
  return AUDIENCES.some((a) => a.id === raw) ? (raw as AudienceId) : "";
}

/** Written for people filing cases: tagged or filed under practice. Everything else is for the person waiting. */
export function isForPractice(p: PostSummary): boolean {
  return p.meta.category === "practice" || p.meta.tags.includes("practice");
}

export function forAudience(posts: readonly PostSummary[], audience: AudienceId): PostSummary[] {
  if (!audience) return [...posts];
  return posts.filter((p) => isForPractice(p) === (audience === "practice"));
}

/** Minutes from "5 min read"; an unreadable one sorts last. */
export function readMinutes(p: PostSummary): number {
  const m = /(\d+)/.exec(p.meta.readingTime ?? "");
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

const lastChanged = (p: PostSummary) => p.meta.updated ?? p.meta.date;

/** The posts in the order asked for; "topic" keeps the order given. Ties fall to the title. */
export function sortPosts(posts: readonly PostSummary[], sort: SortId): PostSummary[] {
  const byTitle = (a: PostSummary, b: PostSummary) => a.meta.title.localeCompare(b.meta.title);
  const out = [...posts];
  switch (sort) {
    case "newest":
      return out.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || byTitle(a, b));
    case "updated":
      return out.sort((a, b) => lastChanged(b).localeCompare(lastChanged(a)) || byTitle(a, b));
    case "oldest":
      return out.sort((a, b) => a.meta.date.localeCompare(b.meta.date) || byTitle(a, b));
    case "title":
      return out.sort(byTitle);
    case "shortest":
      return out.sort((a, b) => readMinutes(a) - readMinutes(b) || byTitle(a, b));
    default:
      return out;
  }
}

/** The heading over a sorted list: "All 88 guides, newest first". */
export function sortedHeading(count: number, noun: string, sort: SortId): string {
  return `All ${count} ${noun}, ${SORTS.find((s) => s.id === sort)?.phrase ?? ""}`;
}
