/**
 * The social card for one Employer page, generated from the entity's own row.
 * A shared link shows the name and the filing count instead of the site-wide
 * card. Cached for the page's own window; a missing entity is a 404 here too.
 */
import { ENTITY_OG_SIZE, generateEntityOG } from "@/lib/entityOg";
import { resolveEntity } from "@/lib/turso/entityDetail";

export const runtime = "nodejs";
export const revalidate = 2592000;
export const alt = "Employer PERM filings, from DOL's disclosure files";
export const size = ENTITY_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await resolveEntity("employer", slug);
  if (!found) return new Response("Not found", { status: 404 });
  return generateEntityOG("employer", found.row);
}
