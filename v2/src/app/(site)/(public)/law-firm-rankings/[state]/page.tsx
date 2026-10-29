import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FirmRankingsPage, firmRanksMetadata } from "@/components/firms/FirmRankingsPage";
import { getFirmRanksSummary } from "@/lib/db/firmRanks";
import { rankedStates } from "@/lib/firmRanks";
import { stateFromSlug, stateSlug } from "@/lib/h1bRanks";
import { withSocialCard } from "@/lib/socialCard";

/**
 * One state's busiest immigration law firms, counted by where each job is.
 * Every ranked state prerenders; the window and the expiry match the national page.
 */

export const revalidate = 604800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const summary = await getFirmRanksSummary();
  return summary ? rankedStates(summary).map((code) => ({ state: stateSlug(code) })) : [];
}

async function resolve(slug: string): Promise<string> {
  const code = stateFromSlug(slug);
  const summary = await getFirmRanksSummary();
  if (!code || (summary && !rankedStates(summary).includes(code))) notFound();
  return code;
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params;
  return withSocialCard(await firmRanksMetadata(await resolve(state)), "law-firm-rankings");
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <FirmRankingsPage state={await resolve(state)} />;
}
