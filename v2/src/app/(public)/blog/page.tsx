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

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on PERM labor certification, immigration practice tips, and industry trends for immigration attorneys.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | PERM Tracker",
    description:
      "Insights on PERM labor certification, immigration practice tips, and industry trends.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogPage() {
  const posts = getAllPosts("blog");
  const tags = getAllTags("blog");
  // Server-generated from trusted content data (not user input) — safe for JSON-LD
  const schemas = [
    generateItemListSchema(posts, "blog"),
    generateBreadcrumbSchema([
      { name: "Home", href: "/" },
      { name: "Blog", href: "/blog" },
    ]),
  ];

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
