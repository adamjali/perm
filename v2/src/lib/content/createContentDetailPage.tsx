/**
 * Factory for content detail pages (blog, guides, changelog).
 *
 * Each content type's [slug]/page.tsx was nearly identical, same imports,
 * same generateStaticParams, same generateMetadata, same render.
 * This factory produces all three exports from a single content type string.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getPostSlugs, getRelatedPosts, extractHeadings, extractVideoRefs } from "@/lib/content";
import { mdxComponents } from "@/lib/content/mdx-components";
import { ArticleLayout } from "@/components/content";
import StructuredData from "@/components/content/StructuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkGfm from "remark-gfm";
import type { ContentType } from "./types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const MDX_OPTIONS = {
  mdxOptions: {
    remarkPlugins: [remarkGfm] as import("unified").Pluggable[],
    rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings] as import("unified").Pluggable[],
  },
};

export function createContentDetailPage(type: ContentType) {
  function generateStaticParams() {
    return getPostSlugs(type).map((slug) => ({ slug }));
  }

  async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostBySlug(type, slug);
    // The route files export `dynamicParams = false`, which answers a junk
    // slug with a real 404 and no render - that is the load-bearing half.
    // This throw is the backstop for a route that forgets the export, and it
    // only sets the status when no loading boundary sits above the segment
    // (with one, Next streams a 200 before any page code runs - measured).
    if (!post) notFound();

    return {
      title: post.meta.seoTitle ?? post.meta.title,
      description: post.meta.seoDescription ?? post.meta.description,
      alternates: { canonical: `/${type}/${slug}` },
      openGraph: (() => {
        // CRITICAL: omit `images` here so Next.js can merge the per-slug
        // file-based opengraph-image.tsx at this route segment. Next 16.2.6
        // (node_modules/next/dist/lib/metadata/resolve-metadata.js:148) skips
        // the file-based image merge whenever `source.openGraph.hasOwnProperty('images')`
        // is true — and that’s exactly what would happen if we spread
        // `openGraphBase` (which carries a default image) verbatim.
        const { images: _omitImagesForPerSlugOG, ...ogBaseNoImages } = openGraphBase;
        return {
          ...ogBaseNoImages,
          type: "article",
          title: post.meta.title,
          description: post.meta.description,
          url: `/${type}/${slug}`,
          publishedTime: post.meta.date,
          modifiedTime: post.meta.updated ?? post.meta.date,
          authors: [post.meta.author],
          tags: post.meta.tags,
        };
      })(),
      twitter: {
        card: "summary_large_image",
        title: post.meta.title,
        description: post.meta.description,
      },
    };
  }

  async function Page({ params }: PageProps) {
    const { slug } = await params;
    const post = getPostBySlug(type, slug);
    if (!post) notFound();

    const related = getRelatedPosts({ slug, type, meta: post.meta });
    const steps = type === "guides" ? extractHeadings(post.content) : undefined;
    const videos = extractVideoRefs(post.content);

    return (
      <>
        <StructuredData
          type={type}
          slug={slug}
          meta={post.meta}
          steps={steps}
          videos={videos.length > 0 ? videos : undefined}
        />
        <ArticleLayout meta={post.meta} type={type} slug={slug} related={related}>
          <MDXRemote
            source={post.content}
            components={mdxComponents}
            options={MDX_OPTIONS}
          />
        </ArticleLayout>
      </>
    );
  }

  return { generateStaticParams, generateMetadata, Page };
}
