/**
 * Changelog Page
 *
 * Product updates, new features, and improvements.
 * Single listing page (no individual detail routes).
 */

import type { Metadata } from "next";
import { getAllPosts } from "@/lib/content";
import { generateBreadcrumbSchema, toISO8601 } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ChangelogTimeline from "@/components/content/ChangelogTimeline";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Product updates, new features, and improvements to PERM Tracker. See what's new and what's coming next.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    ...openGraphBase,
    title: "Changelog | PERM Tracker",
    description: "PERM Tracker product updates and new features.",
    url: "/changelog",
  },
};

export default function ChangelogPage() {
  const posts = getAllPosts("changelog");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
  const { "@context": _1, ...breadcrumb } = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Changelog", href: "/changelog" },
  ]);

  // Inline ItemList — changelog has no per-entry detail routes (sitemap.ts
  // filters them out), so items point to page-anchor URLs (resolved by the
  // id={post.slug} on each ChangelogTimeline entry) rather than 404-ing
  // /changelog/<slug> URLs.
  const itemList = {
    "@type": "ItemList",
    name: "PERM Tracker Changelog",
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${baseUrl}/changelog#${post.slug}`,
      name: post.meta.title,
      datePublished: toISO8601(post.meta.date),
      dateModified: toISO8601(post.meta.updated || post.meta.date),
    })),
  };

  const schemas = {
    "@context": "https://schema.org",
    "@graph": [breadcrumb, itemList],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <ContentHero type="changelog" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ChangelogTimeline posts={posts} />
      </section>
    </>
  );
}
