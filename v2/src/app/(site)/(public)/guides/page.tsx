/**
 * Guides Listing Page
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";
import { openGraphBase } from "@/lib/openGraphBase";

export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "PERM Guides: Statuses, Deadlines, Next Steps",
  description:
    "Plain-English guides to the PERM process: what each status means, what to do after an RFI or a denial, and how long each step takes.",
  alternates: { canonical: "/guides" },
  openGraph: {
    ...openGraphBase,
    title: "PERM Guides: Statuses, Deadlines, Next Steps | PERM Tracker",
    description:
      "Plain-English guides to the PERM process: what each status means, what to do after an RFI or a denial, and how long each step takes.",
    url: "/guides",
  },
}, "guides");

export default function GuidesPage() {
  const posts = getAllPosts("guides");
  // Only tags that actually narrow the list. At 37 guides the raw set was
  // 102 tags, 46 of them on a single article, and the filter row filled a
  // whole screen before the first card. A tag on one article is a keyword,
  // not a category.
  const tags = getAllTags("guides", 2, 24);
  const { '@context': _1, ...itemList } = generateItemListSchema(posts, "guides");
  const schemas = { '@context': 'https://schema.org', '@graph': [itemList] };

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
