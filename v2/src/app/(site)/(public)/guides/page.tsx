/**
 * Guides Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema, generateBreadcrumbSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Comprehensive reference guides for the PERM labor certification process. Filing requirements, recruitment checklists, and best practices.",
  alternates: { canonical: "/guides" },
  openGraph: {
    ...openGraphBase,
    title: "Guides | PERM Tracker",
    description: "Comprehensive PERM process guides and references.",
    url: "/guides",
  },
};

export default function GuidesPage() {
  const posts = getAllPosts("guides");
  // Only tags that actually narrow the list. At 37 guides the raw set was
  // 102 tags, 46 of them on a single article, and the filter row filled a
  // whole screen before the first card. A tag on one article is a keyword,
  // not a category.
  const tags = getAllTags("guides", 2, 24);
  const { '@context': _1, ...itemList } = generateItemListSchema(posts, "guides");
  const { '@context': _2, ...breadcrumb } = generateBreadcrumbSchema([{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }]);
  const schemas = { '@context': 'https://schema.org', '@graph': [itemList, breadcrumb] };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <ContentHero type="guides" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
