import { api } from "@convex/_generated/api";
import { renderBadge } from "@/lib/badgeRender";
import { queryStatic } from "@/lib/convexStatic";
import { firmBadgeSpec, parseFirmBadgeFile } from "@/lib/firmBadge";
import { resolveEntity } from "@/lib/db/entityDetail";

/**
 * GET /badge/firm/<slug>[.light].svg: a law firm's badge for its own site.
 * "Verified firm" only with a verified claim; see src/lib/firmBadge.ts.
 *
 * Rendered on first request and kept a day, like the figure badges, so a
 * badge on a busy firm site costs one read a day.
 */

export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const parsed = parseFirmBadgeFile((await params).file);
  if (!parsed) return new Response("Not found", { status: 404 });
  const found = await resolveEntity("attorney", parsed.slug);
  if (!found) return new Response("Not found", { status: 404 });
  const profile = await queryStatic(api.firmClaims.publishedProfile, { slug: found.canonicalSlug }, revalidate).catch(
    () => null,
  );
  const spec = firmBadgeSpec(found.row.name, found.canonicalSlug, profile != null);
  return new Response(renderBadge(spec, "shield", parsed.theme), { headers: HEADERS });
}
