/**
 * The social card for one Employer page, generated from the entity's own row.
 * A shared link shows the name and the filing count instead of the site-wide
 * card. Cached for the page's own window.
 *
 * It resolves in the SAME order the page does: the published record first,
 * then the live-only record, then the seasonal-only record. A file-based
 * image is attached to every page in the segment, so stopping early would make
 * those pages advertise an og:image that answers 404 to every link-preview
 * agent. A slug in none of the three has no page either, so it stays a 404.
 */
import { ENTITY_OG_SIZE, generateEntityOG, generateLiveEmployerOG, generateSeasonalEmployerOG } from "@/lib/entityOg";
import { seasonalVisas } from "@/lib/seasonalForms";
import { resolveEntity } from "@/lib/turso/entityDetail";
import { liveEmployerRecord } from "@/lib/turso/liveEmployers";
import { seasonalEmployerRecord } from "@/lib/turso/seasonalEmployers";

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
  const seasonal = await seasonalEmployerRecord(slug);
  if (seasonal) return generateSeasonalEmployerOG(seasonal.name, seasonal.cases, seasonalVisas(seasonal));
  return new Response("Not found", { status: 404 });
}
