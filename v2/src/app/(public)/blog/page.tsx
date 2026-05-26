/**
 * Blog Listing Page
 *
 * SEO articles about PERM, immigration law, industry trends.
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema, generateBreadcrumbSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on PERM labor certification, immigration practice tips, and industry trends for immigration attorneys.",
  alternates: { canonical: "/blog" },
  openGraph: {
    ...openGraphBase,
    title: "Blog | PERM Tracker",
    description:
      "Insights on PERM labor certification, immigration practice tips, and industry trends.",
    url: "/blog",
  },
};

export default function BlogPage() {
  const posts = getAllPosts("blog");
  const tags = getAllTags("blog");
  const { '@context': _1, ...itemList } = generateItemListSchema(posts, "blog");
  const { '@context': _2, ...breadcrumb } = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
  ]);
  const schemas = { '@context': 'https://schema.org', '@graph': [itemList, breadcrumb] };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />
      <ContentHero type="blog" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
