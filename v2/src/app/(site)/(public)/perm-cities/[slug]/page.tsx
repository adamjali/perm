import type { Metadata } from "next";

import { GroupDetailPage, groupDetailMetadata, groupStaticParams } from "@/components/groups/GroupPages";
import { withSocialCard } from "@/lib/socialCard";

/**
 * One city's PERM record. The busiest prerender at build; the rest render
 * on first visit and are cached like the entity pages (30 days), since the
 * figures move only when DOL publishes a quarter.
 */

export const revalidate = 2592000;
export const dynamicParams = true;

export async function generateStaticParams() {
  return groupStaticParams("city");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return withSocialCard(await groupDetailMetadata("city", slug), "perm-cities");
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GroupDetailPage kind="city" slug={slug} />;
}
