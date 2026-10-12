import { notFound } from "next/navigation";

import {
  ChunkNotListed,
  entityEntries,
  groupEntries,
  liveEmployerEntries,
  otherEmployerEntries,
  pagesEntries,
  parseChildName,
  urlsetXml,
} from "@/lib/sitemap/build";

/**
 * One child sitemap: /sitemaps/pages.xml, /sitemaps/employer-1.xml, etc.
 *
 * Children must live in the same directory as the index or below it, which a
 * root index satisfies for anything on the site.
 */
export const revalidate = 86400;

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (!name.endsWith(".xml")) notFound();
  const key = name.slice(0, -4);

  const entries =
    key === "pages" ? await pagesEntries() : key === "groups" ? await groupEntries() : await (async () => {
      const parsed = parseChildName(key);
      // An unparseable name is a 404, not an empty sitemap. An empty urlset
      // for a typo would be indexed as a legitimately empty section.
      if (!parsed) notFound();
      try {
        if (parsed.kind === "live-employer") return await liveEmployerEntries(parsed.chunk);
        if (parsed.kind === "other-employer") return await otherEmployerEntries(parsed.chunk);
        return await entityEntries(parsed.kind, parsed.chunk);
      } catch (e) {
        // A chunk past the family's last one was never listed: a 404.
        if (e instanceof ChunkNotListed) notFound();
        throw e;
      }
    })();

  return new Response(urlsetXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
