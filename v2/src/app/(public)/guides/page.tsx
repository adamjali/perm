/**
 * Guides Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Comprehensive reference guides for the PERM labor certification process. Filing requirements, recruitment checklists, and best practices.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Guides | PERM Tracker",
    description: "Comprehensive PERM process guides and references.",
    url: "/guides",
    type: "website",
  },
};

export default function GuidesPage() {
  const posts = getAllPosts("guides");
  const tags = getAllTags("guides");
  /* ItemList schema — server-generated from trusted frontmatter, safe for JSON-LD */
  const itemListSchema = generateItemListSchema(posts, "guides");

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- Trusted server-generated JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <ContentHero type="guides" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
