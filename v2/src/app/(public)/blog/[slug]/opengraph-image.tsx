import { getPostBySlug } from "@/lib/content";
import { generateArticleOG, OG_SIZE } from "@/lib/content/og-image";

export const runtime = "nodejs";
export const revalidate = false;
export const alt = "PERM Tracker Blog";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug("blog", slug);
  if (!post) return new Response("Not found", { status: 404 });
  return generateArticleOG(post.meta, "blog");
}
