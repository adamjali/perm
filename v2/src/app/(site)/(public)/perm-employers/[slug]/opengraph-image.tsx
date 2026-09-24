/**
 * The social card for one Employer page, generated from the entity's own row.
 * A shared link shows the name and the filing count instead of the site-wide
 * card. Cached for the page's own window.
 *
 * It resolves in the SAME order the page does: the published record first,
 * then the live-only record. It used to stop at the first, and because a
 * file-based image is attached to every page in the segment, all ~22,600
 * live-only employer pages advertised an og:image that answered 404 to every
 * link-preview agent (measured 2026-09-23). A slug in neither has no page
 * either, so it stays a 404 here.
 */
import { ENTITY_OG_SIZE, generateEntityOG, generateLiveEmployerOG } from "@/lib/entityOg";
import { resolveEntity } from "@/lib/turso/entityDetail";
import { liveEmployerRecord } from "@/lib/turso/liveEmployers";

export const runtime = "nodejs";
export const revalidate = 2592000;
export const alt = "Employer PERM filings, from DOL's disclosure files";
export const size = ENTITY_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await resolveEntity("employer", slug);
  if (found) return generateEntityOG("employer", found.row);
  const live = await liveEmployerRecord(slug);
  if (live) return generateLiveEmployerOG(live.name, live.cases);
  return new Response("Not found", { status: 404 });
}
