/**
 * Changelog Page
 *
 * Product updates, new features, and improvements.
 * Single listing page (no individual detail routes).
 */

import type { Metadata } from "next";
import { getAllPosts } from "@/lib/content";
import { ContentHero } from "@/components/content";
import ChangelogTimeline from "@/components/content/ChangelogTimeline";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Product updates, new features, and improvements to PERM Tracker. See what's new and what's coming next.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog | PERM Tracker",
    description: "PERM Tracker product updates and new features.",
    url: "/changelog",
    type: "website",
  },
};

export default function ChangelogPage() {
  const posts = getAllPosts("changelog");

  return (
    <>
      <ContentHero type="changelog" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <ChangelogTimeline posts={posts} />
      </section>
    </>
  );
}
