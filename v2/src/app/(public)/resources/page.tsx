/**
 * Resources Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema, generateBreadcrumbSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Tools, checklists, comparisons, and reference materials for PERM practitioners. Everything you need to manage labor certification cases.",
  alternates: { canonical: "/resources" },
  openGraph: {
    ...openGraphBase,
    title: "Resources | PERM Tracker",
    description: "PERM tools, checklists, and reference materials.",
    url: "/resources",
  },
};

export default function ResourcesPage() {
  const posts = getAllPosts("resources");
  const tags = getAllTags("resources");
  const { '@context': _1, ...itemList } = generateItemListSchema(posts, "resources");
  const { '@context': _2, ...breadcrumb } = generateBreadcrumbSchema([{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }]);
  const schemas = { '@context': 'https://schema.org', '@graph': [itemList, breadcrumb] };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <ContentHero type="resources" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
