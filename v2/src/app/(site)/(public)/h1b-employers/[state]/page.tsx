import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { H1bEmployersPage, h1bMetadata } from "@/components/h1b/H1bEmployersPage";
import { rankedStates, stateFromSlug, stateSlug } from "@/lib/h1bRanks";
import { withSocialCard } from "@/lib/socialCard";
import { getH1bSummary } from "@/lib/turso/h1bRanks";

/**
 * One state's busiest H-1B employers: DOL's LCAs by worksite, USCIS's
 * approvals by the petitioner's address. Every state with a ranking
 * prerenders; the window and the expiry match the national page.
 */

export const revalidate = 604800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const summary = await getH1bSummary();
  return summary ? rankedStates(summary).map((code) => ({ state: stateSlug(code) })) : [];
}

async function resolve(slug: string): Promise<string> {
  const code = stateFromSlug(slug);
  const summary = await getH1bSummary();
  if (!code || (summary && !rankedStates(summary).includes(code))) notFound();
  return code;
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params;
  return withSocialCard(await h1bMetadata(await resolve(state)), "h1b-employers");
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <H1bEmployersPage state={await resolve(state)} />;
}
