import { BADGE_KINDS, badgeSpec, renderBadgeSvg, renderUnavailableSvg, type BadgeKind } from "@/lib/badge";
import { badgeInputsFrom } from "@/lib/badgeInputs";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

/**
 * GET /badge/<kind>.svg
 *
 * Static and regenerated daily, so a hot-linked badge costs one Turso read a
 * day rather than one per viewer. Unknown kinds 404 at build time through
 * `dynamicParams = false`; a kind DOL printed no figure for renders a badge
 * that says so, never a stale number.
 */

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return BADGE_KINDS.map((kind) => ({ kind: `${kind}.svg` }));
}

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const kind = raw.replace(/\.svg$/, "") as BadgeKind;
  if (!BADGE_KINDS.includes(kind)) return new Response("Not found", { status: 404 });

  const snap = await getProcessingTimes().catch(() => null);
  const spec = badgeSpec(kind, badgeInputsFrom(snap));
  return new Response(spec ? renderBadgeSvg(spec) : renderUnavailableSvg(kind), { headers: HEADERS });
}
