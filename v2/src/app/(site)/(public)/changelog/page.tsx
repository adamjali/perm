/**
 * Changelog Page
 *
 * Product updates, new features, and improvements.
 * Single listing page (no individual detail routes).
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { getAllPosts } from "@/lib/content";
import { generateItemListSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ChangelogTimeline from "@/components/content/ChangelogTimeline";
import { openGraphBase } from "@/lib/openGraphBase";
import { SITE_URL } from "@/lib/constants/site";

export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "Changelog",
  description:
    "Every change to PERM Tracker, newest first: new datasets and tools, what each one measures, and the corrections we have published since launch.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    ...openGraphBase,
    title: "Changelog | PERM Tracker",
    description: "PERM Tracker product updates and new features.",
    url: "/changelog",
  },
}, "changelog");

export default function ChangelogPage() {
  const posts = getAllPosts("changelog");
  const baseUrl = SITE_URL;

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
    "@graph": [itemList],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <ContentHero type="changelog" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        {/* One dated history. The corrections log is one entry in it
            (`content/changelog/corrections.mdx`, category "Correction"), in
            the same shape as every release note. */}
        <ChangelogTimeline posts={posts} />
      </section>
    </>
  );
}
