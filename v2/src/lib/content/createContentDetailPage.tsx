/**
 * Factory for content detail pages (blog, tutorials, guides, resources).
 *
 * Each content type's [slug]/page.tsx was nearly identical — same imports,
 * same generateStaticParams, same generateMetadata, same render.
 * This factory produces all three exports from a single content type string.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getPostSlugs, getRelatedPosts } from "@/lib/content";
import { mdxComponents } from "@/lib/content/mdx-components";
import { ArticleLayout } from "@/components/content";
import StructuredData from "@/components/content/StructuredData";
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
    if (!post) return {};

    return {
      title: post.meta.seoTitle ?? post.meta.title,
      description: post.meta.seoDescription ?? post.meta.description,
      alternates: { canonical: `/${type}/${slug}` },
      openGraph: {
        title: post.meta.title,
        description: post.meta.description,
        url: `/${type}/${slug}`,
        type: "article",
        publishedTime: post.meta.date,
        modifiedTime: post.meta.updated ?? post.meta.date,
        authors: [post.meta.author],
        tags: post.meta.tags,
        images: post.meta.image ? [{ url: post.meta.image }] : undefined,
      },
    };
  }

  async function Page({ params }: PageProps) {
    const { slug } = await params;
    const post = getPostBySlug(type, slug);
    if (!post) notFound();

    const related = getRelatedPosts({ slug, type, meta: post.meta });

    return (
      <>
        <StructuredData type={type} slug={slug} meta={post.meta} />
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
