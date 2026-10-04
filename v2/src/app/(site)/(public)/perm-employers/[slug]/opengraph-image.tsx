/**
 * The social card for one Employer page, generated from the entity's own row.
 * A shared link shows the name and the filing count instead of the site-wide
 * card. Cached for the page's own window.
 *
 * It resolves in the SAME order the page does: the published record first,
 * then the live-only record, then the record of an employer with no PERM
 * case (employer_other_index). A file-based
 * image is attached to every page in the segment, so stopping early would make
 * those pages advertise an og:image that answers 404 to every link-preview
 * agent. A slug in none of the three has no page either, so it stays a 404.
 */
import { ENTITY_OG_SIZE, generateEntityOG, generateLiveEmployerOG, generateOtherEmployerOG } from "@/lib/entityOg";
import { programsShort } from "@/lib/otherEmployers";
import { resolveEntity } from "@/lib/turso/entityDetail";
import { liveEmployerRecord } from "@/lib/turso/liveEmployers";
import { otherEmployerRecord } from "@/lib/turso/otherEmployers";

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
  const other = await otherEmployerRecord(slug);
  if (other) return generateOtherEmployerOG(other.name, other.cases, programsShort(other));
  return new Response("Not found", { status: 404 });
}
