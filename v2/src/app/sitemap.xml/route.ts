import {
  childNames,
  indexXml,
  pagesEntries,
} from "@/lib/sitemap/build";

/**
 * The sitemap INDEX, at the URL Search Console already has.
 *
 * Hand-rolled rather than Next's `sitemap.ts` convention for two reasons.
 * Next does not generate an index at all (discussion #61448), and adding
 * `generateSitemaps()` to a root `app/sitemap.ts` makes /sitemap.xml return
 * 404 (issue #77304, open, no maintainer response). That URL is the one
 * declared in robots.txt and submitted in Search Console, so breaking it
 * would forfeit the submission and its history for a cosmetic gain.
 */
export const revalidate = 86400;

export async function GET() {
  // The freshest date any child carries, so the index does not claim a
  // change the children do not have.
  const [names, pages] = await Promise.all([childNames(), pagesEntries()]);
  const lastmod = pages.reduce(
    (acc, e) => (e.lastModified > acc ? e.lastModified : acc),
    pages[0]?.lastModified ?? new Date().toISOString().slice(0, 10),
  );

  return new Response(indexXml(names, lastmod), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Vercel already serves application/xml compressed, so no .gz here:
      // both size limits in play are measured on the UNCOMPRESSED bytes, so
      // gzipping the file itself would buy exactly nothing.
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
