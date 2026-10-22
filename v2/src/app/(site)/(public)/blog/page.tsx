/**
 * Blog Listing Page
 *
 * SEO articles about PERM, immigration law, industry trends.
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { getAllPosts } from "@/lib/content";
import { generateItemListSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";
import { TopicStack } from "@/components/content/TopicStack";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "Blog",
  description:
    "Insights on PERM labor certification, DOL processing data, and practical guidance for applicants and attorneys.",
  alternates: { canonical: "/blog" },
  openGraph: {
    ...openGraphBase,
    title: "Blog | PERM Tracker",
    description:
      "Insights on PERM labor certification, immigration practice tips, and industry trends.",
    url: "/blog",
  },
}, "blog");

export default function BlogPage() {
  const posts = getAllPosts("blog");
  const { '@context': _1, ...itemList } = generateItemListSchema(posts, "blog");
  const schemas = { '@context': 'https://schema.org', '@graph': [itemList] };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />
      <ContentHero type="blog" postCount={posts.length} />
      <TopicStack posts={posts} type="blog" />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} type="blog" />
      </section>
    </>
  );
}
