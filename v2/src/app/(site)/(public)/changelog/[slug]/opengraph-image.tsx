import { getPostBySlug } from "@/lib/content";
import { generateArticleOG, OG_SIZE } from "@/lib/content/og-image";

/**
 * The card a changelog post shows when it is shared.
 *
 * Every content family needs this route, or its posts serve no `og:image`
 * (an SEO audit reports each as "Open Graph tags incomplete"). The generator
 * understands `changelog` - `ContentType` includes it and `TYPE_COLORS` gives
 * it its own grey - so this file is all the family needs.
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
