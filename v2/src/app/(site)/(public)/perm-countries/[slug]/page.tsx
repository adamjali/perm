import type { Metadata } from "next";

import { GroupDetailPage, groupDetailMetadata, groupStaticParams } from "@/components/groups/GroupPages";

/**
 * One country's PERM record. The busiest prerender at build; the rest render
 * on first visit and are cached like the entity pages (30 days), since the
 * figures move only when DOL publishes a quarter.
 */

export const revalidate = 2592000;
export const dynamicParams = true;

export async function generateStaticParams() {
  return groupStaticParams("country");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return groupDetailMetadata("country", slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GroupDetailPage kind="country" slug={slug} />;
}
