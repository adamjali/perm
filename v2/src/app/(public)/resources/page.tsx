/**
 * Resources Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Tools, checklists, comparisons, and reference materials for PERM practitioners. Everything you need to manage labor certification cases.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Resources | PERM Tracker",
    description: "PERM tools, checklists, and reference materials.",
    url: "/resources",
    type: "website",
  },
};

export default function ResourcesPage() {
  const posts = getAllPosts("resources");
  const tags = getAllTags("resources");

  return (
    <>
      <ContentHero type="resources" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
