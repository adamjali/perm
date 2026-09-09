import { BADGE_DEFS, BADGE_THEMES, badgeSpec } from "@/lib/badge";
import { renderBadge, renderUnavailable } from "@/lib/badgeRender";
import { getBadgeData } from "@/lib/badgeData";
import { parseBadgePath } from "./parse";

/**
 * GET /badge/<kind>[.<style>][.<theme>].svg
 *
 *   /badge/perm-queue.svg              shield, dark - the frozen canonical form
 *   /badge/perm-queue.card.svg         card, dark
 *   /badge/perm-queue.card.light.svg   card, light
 *
 * THE VARIANT IS IN THE PATH, NOT A QUERY STRING, and that is what keeps every
 * one of these static. A route that reads `searchParams` becomes dynamic, and
 * a dynamic badge is a function invocation per cold edge region per day for an
 * image whose content changes once. Path variants are prerendered, are
 * addressable by `revalidatePath` when DOL republishes, and 404 on anything
 * not in the list rather than letting an unbounded URL space accumulate cache
 * entries.
 *
 * A dot is the separator because badge ids contain dashes (`perm-queue`,
 * `bulletin-eb2-india`) and never dots, so the split is unambiguous.
 *
 * Static and regenerated daily, so a hot-linked badge costs one read a day
 * rather than one per viewer.
 */

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 86400;

/** Every addressable badge: the canonical form plus each supported variant. */
export function generateStaticParams() {
  const out: { kind: string }[] = [];
  for (const def of BADGE_DEFS) {
    out.push({ kind: `${def.id}.svg` });
    for (const style of def.styles) {
      for (const theme of BADGE_THEMES) out.push({ kind: `${def.id}.${style}.${theme}.svg` });
    }
  }
  return out;
}

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const parsed = parseBadgePath(raw);
  if (!parsed) return new Response("Not found", { status: 404 });

  const data = await getBadgeData();
  const spec = badgeSpec(parsed.kind, data);
  const svg = spec
    ? renderBadge(spec, parsed.style, parsed.theme)
    : renderUnavailable(parsed.kind, parsed.style, parsed.theme);
  return new Response(svg, { headers: HEADERS });
}
