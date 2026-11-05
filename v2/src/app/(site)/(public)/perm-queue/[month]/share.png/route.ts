import { ISO_MONTH_RE } from "@convex/lib/months";
import { getMonthBacklog } from "@/lib/db/backlog";
import { getLiveCensus } from "@/lib/db/liveCensus";
import { getPermLine } from "@/lib/db/permLine";
import { monthMakeup } from "@/lib/monthMakeup";
import { buildMonthShare } from "@/lib/monthShare";
import { loadShareFonts, renderMonthShare } from "@/lib/monthShareImage";

/**
 * GET /perm-queue/<month>/share.png: one filing month as a dated picture,
 * offered under "Share this month" on the month page.
 *
 * It isn't the page's social card. A card is cached by link previews for weeks
 * and never carries a live figure; this is a reading that says which day it's
 * from, made from the same census the page prints, on the page's own window.
 *
 * Built on its first request and kept six hours, like the page (the badge
 * routes' shape: force-static with an empty generateStaticParams). A month that
 * isn't one, or holds no cases, is a 404 like the page. A census that can't be
 * read throws instead of answering, so a failed rebuild keeps the last good
 * picture rather than caching an error for six hours.
 */

export const dynamic = "force-static";
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

const CACHE = "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!ISO_MONTH_RE.test(month)) return new Response("Not found", { status: 404 });

  const census = await getLiveCensus();
  if (!census) throw new Error(`[perm-queue/share] no census to draw ${month} from`);
  const backlog = await getMonthBacklog(month);
  if (!backlog || backlog.total === 0) return new Response("Not found", { status: 404 });
  const line = await getPermLine();

  const share = buildMonthShare({
    month,
    makeup: monthMakeup(backlog.statuses),
    asOf: census.asOf,
    line: line ? { month: line.month, asOf: line.asOf } : null,
  });
  const image = renderMonthShare(share, await loadShareFonts());
  return new Response(await image.arrayBuffer(), {
    headers: { "Content-Type": "image/png", "Cache-Control": CACHE },
  });
}
