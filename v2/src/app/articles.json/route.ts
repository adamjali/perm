import { getAllPosts } from "@/lib/content";

export const dynamic = "force-static";

/**
 * Every article's title, address and kind, for the search palette and the 404
 * page's "did you mean". Built once per deploy and fetched only when someone
 * opens search or lands on a 404 (src/lib/search/articleList.ts). Until Oct 21
 * 2026 the list rode inside every page: four copies, 17 KB each, because the
 * site's layout and both 404 pages (which Next ships inside every page) each
 * passed it to the browser.
 */
export function GET(): Response {
  const list = getAllPosts().map((p) => ({ title: p.meta.title, href: `/${p.type}/${p.slug}`, kind: p.type }));
  return Response.json(list, { headers: { "X-Robots-Tag": "noindex" } });
}
