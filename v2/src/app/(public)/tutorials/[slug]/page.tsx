/**
 * Tutorial Detail Page
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

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostSlugs("tutorials").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug("tutorials", slug);
  if (!post) return {};

  return {
    title: post.meta.seoTitle ?? post.meta.title,
    description: post.meta.seoDescription ?? post.meta.description,
    alternates: { canonical: `/tutorials/${slug}` },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      url: `/tutorials/${slug}`,
      type: "article",
      publishedTime: post.meta.date,
      modifiedTime: post.meta.updated ?? post.meta.date,
      authors: [post.meta.author],
      tags: post.meta.tags,
      images: post.meta.image ? [{ url: post.meta.image }] : undefined,
    },
  };
}

export default async function TutorialPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug("tutorials", slug);
  if (!post) notFound();

  const related = getRelatedPosts({ slug, type: "tutorials", meta: post.meta });

  return (
    <>
      <StructuredData type="tutorials" slug={slug} meta={post.meta} />
      <ArticleLayout meta={post.meta} type="tutorials" slug={slug} related={related}>
        <MDXRemote
          source={post.content}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
            },
          }}
        />
      </ArticleLayout>
    </>
  );
}
