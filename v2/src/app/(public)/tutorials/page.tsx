/**
 * Tutorials Listing Page
 */

import type { Metadata } from "next";
import { getAllPosts, getAllTags } from "@/lib/content";
import { generateItemListSchema, generateBreadcrumbSchema } from "@/lib/content/seo";
import { ContentHero } from "@/components/content";
import ContentListing from "@/components/content/ContentListing";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Tutorials",
  description:
    "Step-by-step guides to get the most out of PERM Tracker. Learn how to track deadlines, manage recruitment, and streamline your practice.",
  alternates: { canonical: "/tutorials" },
  openGraph: {
    title: "Tutorials | PERM Tracker",
    description: "Step-by-step guides for PERM Tracker.",
    url: "/tutorials",
    type: "website",
  },
};

export default function TutorialsPage() {
  const posts = getAllPosts("tutorials");
  const tags = getAllTags("tutorials");
  const schemas = [
    generateItemListSchema(posts, "tutorials"),
    generateBreadcrumbSchema([
      { name: "Home", href: "/" },
      { name: "Tutorials", href: "/tutorials" },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />
      <ContentHero type="tutorials" postCount={posts.length} />
      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <ContentListing posts={posts} tags={tags} />
      </section>
    </>
  );
}
