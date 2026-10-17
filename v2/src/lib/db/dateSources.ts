import "server-only";

import { cache } from "react";

import { latestPostDate } from "@/lib/content";
import type { DateSources } from "@/lib/pageDates";

import { one } from "./client";
import { getFreshness } from "./publicData";
import { getSweepCoverage } from "./sweepCoverage";

/**
 * The days a page's figures last moved, for `pageDate` (src/lib/pageDates.ts).
 *
 * Read once per render by the public layout, which hands them to the
 * breadcrumb bar, and by the sitemap, so the "Updated" line and the lastmod
 * come from the same values. Each is a point read or a per-request cached one
 * the pages already make; a read that fails leaves its source out, and the
 * page is then dated by its code alone.
 *
 * The H-1B rankings' date isn't here: its doc is 138 KB, read only by the two
 * pages that use it, which date themselves.
 */

/** DOL's own as-of stamp, from the indexed column rather than the snapshot's JSON. */
async function dolAsOf(): Promise<string | null> {
  const r = await one<{ d: string | null }>(
    "SELECT perm_as_of AS d FROM processing_times ORDER BY perm_as_of DESC LIMIT 1",
  ).catch(() => null);
  return r?.d ? String(r.d) : null;
}

function postsDay(): string | null {
  try {
    return latestPostDate();
  } catch {
    return null;
  }
}

/** A read that fails, however it fails, leaves its source out. */
async function safely(read: () => Promise<string | null>): Promise<string | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export const getDateSources = cache(async (): Promise<DateSources> => {
  const [dol, sweep, corpus] = await Promise.all([
    safely(dolAsOf),
    safely(async () => (await getSweepCoverage())?.finishedOn ?? null),
    safely(async () => (await getFreshness())["perm-cases"]?.asOf ?? null),
  ]);
  return { dol, sweep, corpus, posts: postsDay() };
});
