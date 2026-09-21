import { getPostBySlug } from "@/lib/content";
import { generateArticleOG, OG_SIZE } from "@/lib/content/og-image";

/**
 * The card a changelog post shows when it is shared.
 *
 * MISSING UNTIL 2026-09-21, and the only content family without one: `blog`
 * and `guides` have had this route since they shipped, so their posts served
 * an `og:image` and every changelog post served none. The generator already
 * understood `changelog` - `ContentType` includes it and `TYPE_COLORS` gives
 * it its own grey - so the whole gap was this file. Ahrefs found it as "Open
 * Graph tags incomplete", 9 pages, which is exactly the number of changelog
 * posts.
 *
 * `createContentDetailPage` destructures `images` off `openGraphBase` so that
 * Next merges this file convention in; that is what makes the route enough on
 * its own, with no metadata change beside it.
 */
export const runtime = "nodejs";
export const revalidate = false;
export const alt = "PERM Tracker Changelog";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug("changelog", slug);
  if (!post) return new Response("Not found", { status: 404 });
  return generateArticleOG(post.meta, "changelog");
}
