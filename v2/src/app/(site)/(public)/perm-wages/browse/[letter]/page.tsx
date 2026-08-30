/**
 * One letter's worth of occupations, every one of them a crawlable link.
 *
 * `dynamicParams = false` is the 404 mechanism here, and it is the cheapest
 * one available: the letter set is 27 strings known at build time, so Next
 * answers `/perm-wages/browse/zz` with a real 404 and renders nothing at all.
 * The entity detail routes have to throw `notFound()` from `generateMetadata`
 * because their slug set is a table read; this one does not.
 *
 * Three letters here are genuinely empty. No SOC title begins with X, Y or Z,
 * so those chips render as plain text, the pages carry a noindex and the
 * sitemap omits them.
 */

import type { Metadata } from "next";

import {
  BrowseLetterBody,
  browseLetterMetadata,
  browseStaticParams,
} from "@/components/entities/BrowseBody";

// Quarterly data, same window as the hub. 27 pages per kind, so a daily
// window costs 27 regenerations rather than the ~21,000 entity detail pages
// that pushed that surface out to a thirty-day window.
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return browseStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ letter: string }>;
}): Promise<Metadata> {
  const { letter } = await params;
  return browseLetterMetadata("occupation", letter);
}

export default async function PermWagesLetterPage({
  params,
}: {
  params: Promise<{ letter: string }>;
}) {
  const { letter } = await params;
  return <BrowseLetterBody kind="occupation" letter={letter} />;
}
