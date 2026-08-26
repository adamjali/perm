import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/content'
import { fetchAllEntitiesServer } from '@/lib/entitySeed'
import { hasOwnPage } from '@/lib/entityPayload'
import { captureError } from '@/lib/sentry'
import { getDisclosureStats } from '@/lib/turso/publicData'
import { getProcessingTimes } from '@/lib/turso/processingTimes'

// Next.js sitemap routes are cached by default and only regenerated when
// Next.js revalidates them (or a request-time API forces dynamic). Daily
// revalidation keeps the sitemap fresh between deploys without per-request
// regeneration cost — without it, the route would be frozen to build time.
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // Use the most recent content date for listing pages (not build time).
  const allPosts = getAllPosts()
  if (allPosts.length === 0) {
    // Build-time content failure (missing content/ dir, all parse errors swallowed
    // upstream, etc.) would silently fall back to today's date for every URL —
    // teaching Google to ignore our lastmod values. Surface it to Sentry so an
    // empty-posts deploy can be triaged instead of shipping a misleading sitemap.
    captureError(new Error('Sitemap built with zero content posts: content/ may be missing or all MDX parses failed'))
  }
  const latestPostDate = allPosts.length > 0
    ? allPosts.reduce((latest, post) => {
        const date = post.meta.updated ?? post.meta.date
        return date > latest ? date : latest
      }, allPosts[0]!.meta.date)
    : new Date().toISOString().split('T')[0]!

  // DOL's own as-of stamp for the processing-times page. Wrapped because the
  // sitemap must still build if Convex is unreachable: a sitemap with one
  // slightly stale lastmod is fine, a failed build is not.
  // The entity pages come from the same aggregates the pages read, through
  // the same slug helper, so the sitemap can never list a URL that does not
  // resolve or miss one that does.
  const disclosure = await getDisclosureStats().catch(() => null)

  const permAsOf = await getProcessingTimes()
    .then((snap) => snap?.permAsOf ?? null)
    .catch(() => null)

  // Static pages.
  // - Homepage lastModified is derived from latestPostDate (was hardcoded):
  //   home content references the latest posts, so freshness tracks content.
  // - /login and /signup intentionally omitted: their page metadata sets
  //   `robots: { index: false }`. Advertising them in the sitemap would be
  //   contradictory and risks Search Console "noindex'd URL in sitemap" warnings.
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: latestPostDate },
    { url: `${baseUrl}/blog`, lastModified: latestPostDate },
    { url: `${baseUrl}/guides`, lastModified: latestPostDate },
    { url: `${baseUrl}/changelog`, lastModified: latestPostDate },
    { url: `${baseUrl}/faq`, lastModified: '2026-08-24' },
    // Live DOL figures, refreshed weekly by convex/dolProcessingTimes.ts.
    // lastmod is DOL's own as-of date, which is the only thing that actually
    // changes this page. It previously used latestPostDate, so the date moved
    // whenever an unrelated blog post shipped and stayed put when DOL published
    // — backwards on both counts, and the fastest way to teach a crawler that
    // our lastmod values mean nothing.
    { url: `${baseUrl}/perm-processing-times`, lastModified: permAsOf ?? latestPostDate },
    // Calculators. Their lastmod tracks DOL's own as-of stamp where they render
    // live figures, for the same reason /perm-processing-times does: the date
    // should move when the numbers move, not when an unrelated post ships.
    { url: `${baseUrl}/tools`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/green-card-timeline`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/perm-timeline-calculator`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/pwd-calculator`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/i140-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/priority-date-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/perm-deadline-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/calculators`, lastModified: '2026-08-24' },
    { url: `${baseUrl}/methodology`, lastModified: '2026-08-24' },
    // The disclosure aggregates: lastmod tracks the quarterly ingest.
    { url: `${baseUrl}/perm-by-state`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/perm-wages`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/perm-employers`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/perm-attorneys`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/perm-cases`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/perm-denial-risk`, lastModified: permAsOf ?? '2026-08-24' },
    { url: `${baseUrl}/contact`, lastModified: '2026-08-24' },
    { url: `${baseUrl}/terms`, lastModified: '2026-06-15' },
    { url: `${baseUrl}/privacy`, lastModified: '2026-08-24' },
    { url: `${baseUrl}/security`, lastModified: '2026-06-15' },
  ]

  // One page per entity, for EVERY entity: 12,240 sponsors, 3,208 firms, 762
  // occupations. This used to read the aggregate document, which is capped at
  // 250 rows per kind so it fits Convex's 1 MB limit, and so submitted 750 of
  // 16,210 real pages.
  //
  // Slugs come from the entity TABLE, which is the same source the pages and
  // the index tables read. Deriving them here instead would be a second
  // implementation of the collision rule, and a slug computed two ways is a
  // sitemap entry that 404s.
  const entityDate = permAsOf ?? '2026-08-24'
  const [employers, firms, occupations] = await Promise.all([
    fetchAllEntitiesServer('employer').catch(() => []),
    fetchAllEntitiesServer('attorney').catch(() => []),
    fetchAllEntitiesServer('occupation').catch(() => []),
  ])
  // A build whose Convex is unreachable, or pointed at a deployment holding a
  // handful of test rows, silently drops 16,210 URLs and still emits a
  // perfectly valid sitemap. That is exactly what a local build did: 61 URLs
  // instead of 16,255, because it read the dev deployment. `revalidate` heals
  // it within a day, but a silent 99.6% loss should never be silent.
  const entityTotal = employers.length + firms.length + occupations.length
  if (entityTotal < 500) {
    const detail =
      `Sitemap built with only ${entityTotal} entity URLs ` +
      `(employers ${employers.length}, firms ${firms.length}, ` +
      `occupations ${occupations.length}). The Turso read failed or returned ` +
      `almost nothing.`
    captureError(new Error(detail))
    // THROW, do not emit. This guard already existed and already fired: while
    // Convex was disabled it reported "0 entity URLs" on every build, and the
    // 46-URL sitemap shipped anyway, telling Google this site has 46 pages.
    // Reporting a catastrophic loss is not a response to it.
    //
    // Throwing is the SAFER failure. On revalidation Next keeps serving the
    // last good sitemap, so a transient outage costs freshness rather than
    // 21,178 URLs; on a cold build it fails loudly, which is the correct
    // outcome when the alternative is publishing a sitemap that is 99.8%
    // wrong and looks perfectly valid.
    throw new Error(detail)
  }

  // Only entities that HAVE a page. Everything below the threshold is stored
  // and searchable but has no URL, and a sitemap must never advertise one
  // that 404s.
  const pageworthy = (rows: { slug: string; total: number }[]) =>
    rows.filter(hasOwnPage)
  const entityUrls: MetadataRoute.Sitemap = [
    ...pageworthy(employers).map(({ slug }) => ({
      url: `${baseUrl}/perm-employers/${slug}`,
      lastModified: entityDate,
    })),
    ...pageworthy(firms).map(({ slug }) => ({
      url: `${baseUrl}/perm-attorneys/${slug}`,
      lastModified: entityDate,
    })),
    ...pageworthy(occupations).map(({ slug }) => ({
      url: `${baseUrl}/perm-wages/${slug}`,
      lastModified: entityDate,
    })),
  ]

  // Dynamic content pages (blog, tutorials, guides, resources)
  const contentPages: MetadataRoute.Sitemap = getAllPosts()
    .map((post) => ({
      url: `${baseUrl}/${post.type}/${post.slug}`,
      lastModified: post.meta.updated ?? post.meta.date,
    }))

  return [...staticPages, ...entityUrls, ...contentPages]
}
