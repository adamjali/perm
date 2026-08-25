/**
 * Changelog Page
 *
 * Product updates, new features, and improvements.
 * Single listing page (no individual detail routes).
 */

import type { Metadata } from "next";
import { getAllPosts } from "@/lib/content";
import { generateBreadcrumbSchema, generateItemListSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ChangelogTimeline from "@/components/content/ChangelogTimeline";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Product updates, new features, and improvements to PERM Tracker. See what’s new and what’s coming next.",
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

  // Reuse the shared generator with a changelog-specific URL strategy:
  // changelog has no per-entry detail routes (sitemap.ts filters them out),
  // so items point to on-page anchors that resolve via id={post.slug} on
  // each ChangelogTimeline entry — NOT 404-ing /changelog/<slug> URLs.
  const { "@context": _2, ...itemList } = generateItemListSchema(
    posts,
    "changelog",
    (post) => `${baseUrl}/changelog#${post.slug}`,
  );

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
