/**
 * The site's one fuzzy matcher, frontend re-export layer. The canonical module
 * is convex/lib/fuzzy.ts, because the app's case searches run in Convex and
 * must match exactly as the site's searches do. Components import from
 * "@/lib/fuzzy".
 *
 * @see convex/lib/fuzzy.ts
 * @module
 */

export * from "@convex/lib/fuzzy";
