/**
 * Guides Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
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

  return (
    <>
      <ContentHero type="guides" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
